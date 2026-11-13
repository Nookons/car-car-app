"""Read-only platform monitoring. Secrets never enter the JSON response."""
from __future__ import annotations

import copy
import json
import math
import os
import re
import shutil
import subprocess
import time
from datetime import UTC, date, datetime
from pathlib import Path
from threading import Lock
from typing import Any, Callable

import httpx
from psycopg.conninfo import conninfo_to_dict

PROJECT_ID = "eecf3f89-2cfe-4c3d-b6e2-877f460c2696"
ENVIRONMENT_ID = "8c77c810-73ca-4a34-95f0-3602df5a8918"
ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = Path(__file__).parent / "config" / "supabase_usage.json"

RAILWAY_QUERY = """query PlatformStatus($id: String!) {
  project(id: $id) { id name environments { edges { node {
    id name serviceInstances { edges { node {
      serviceId serviceName numReplicas
      latestDeployment { id status createdAt deploymentStopped instances { id status } }
      activeDeployments { id status createdAt deploymentStopped instances { id status } }
    } } }
  } } } }
}"""


def utcnow() -> datetime:
    return datetime.now(UTC)


def project_ref(db_url: str | None) -> str | None:
    if not db_url:
        return None
    try:
        config = conninfo_to_dict(db_url)
    except Exception:
        return None
    for value, pattern in (
        (config.get("host", ""), r"^db\.([a-z]{20})\.supabase\.co$"),
        (config.get("user", ""), r"^postgres\.([a-z]{20})$"),
    ):
        match = re.match(pattern, value)
        if match:
            return match[1]
    return None


def quota(used: float | None, limit: float | None, informational: bool = False) -> dict:
    valid = lambda v: isinstance(v, (float, int)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0
    used = used if valid(used) else None
    limit = limit if valid(limit) and limit > 0 else None
    percent = used / limit * 100 if used is not None and limit is not None else None
    state = "unknown" if percent is None else "info" if informational else (
        "exceeded" if percent > 100 else "critical" if percent >= 95 else "warning" if percent >= 80 else "ok"
    )
    return {"used": used, "limit": limit, "percent": round(percent, 3) if percent is not None else None,
            "remaining": max(0, limit - used) if percent is not None else None, "state": state}


class CachedMonitor:
    def __init__(self, ttl: float = 60):
        self.ttl = ttl
        self.lock = Lock()
        self.cached: dict | None = None
        self.checked = 0.0

    def get(self) -> dict:
        with self.lock:
            if self.cached is None or time.monotonic() - self.checked >= self.ttl:
                try:
                    self.cached = {**self.fetch(), "updated_at": utcnow().isoformat(), "stale": False}
                except Exception:
                    # Preserve a clearly labelled last successful reading on provider failure.
                    self.cached = {**(self.cached or {}), "stale": True,
                                   "error": "Не удалось обновить данные. Проверьте подключение к источнику."}
                self.checked = time.monotonic()
            return copy.deepcopy(self.cached)

    def fetch(self) -> dict:
        raise NotImplementedError


class SupabaseMonitor(CachedMonitor):
    def __init__(self, repo: Any, db_url: str | None, snapshot_path: Path = SNAPSHOT, ttl: float = 60):
        super().__init__(ttl)
        self.repo = repo
        self.ref = project_ref(db_url)
        self.snapshot_path = snapshot_path

    def fetch(self) -> dict:
        live = self.repo.resource_usage()
        snapshot: dict = {}
        try:
            raw = json.loads(self.snapshot_path.read_text())
            if self.ref and raw.get("project_ref") == self.ref:
                snapshot = raw
        except (OSError, ValueError, TypeError):
            pass
        now = utcnow()
        valid_period = False
        stale_snapshot = True
        try:
            start = date.fromisoformat(snapshot["period_start"])
            end = date.fromisoformat(snapshot["period_end"])
            verified = datetime.fromisoformat(snapshot["verified_at"].replace("Z", "+00:00"))
            valid_period = start <= now.date() < end and verified <= now
            stale_snapshot = (now - verified).total_seconds() > 7200
        except (KeyError, ValueError, TypeError):
            pass
        metrics = []
        for metric in snapshot.get("metrics", []):
            metrics.append({**metric, **quota(metric.get("used") if valid_period else None,
                                             metric.get("limit"), metric.get("informational", False))})
        max_clients = max(0, live["max_connections"] - live["reserved_connections"])
        return {
            "project_ref": self.ref, "plan": snapshot.get("plan", "Pro"),
            "database_bytes": live["database_bytes"],
            "connections": {**quota(live["connections"], max_clients),
                            "active": live["active_connections"], "server_max": live["max_connections"],
                            "reserved": live["reserved_connections"]},
            "billing": {"available": bool(snapshot), "valid_period": valid_period,
                        "stale": stale_snapshot, "verified_at": snapshot.get("verified_at"),
                        "period_start": snapshot.get("period_start"), "period_end": snapshot.get("period_end"),
                        "allocated_disk_gb": snapshot.get("allocated_disk_gb"),
                        "included_disk_gb": snapshot.get("included_disk_gb"),
                        "overage_policy": snapshot.get("overage_policy"), "metrics": metrics},
            "usage_url": f"https://supabase.com/dashboard/org/{snapshot['organization_slug']}/usage"
                         if snapshot.get("organization_slug") else "https://supabase.com/dashboard",
        }


def railway_services(project: dict, environment_id: str) -> dict:
    environment = next((edge["node"] for edge in project.get("environments", {}).get("edges", [])
                        if edge["node"]["id"] == environment_id), None)
    if environment is None:
        raise ValueError("Configured Railway environment was not found")
    pending = {"INITIALIZING", "QUEUED", "BUILDING", "DEPLOYING", "WAITING", "NEEDS_APPROVAL"}
    failed = {"FAILED", "CRASHED"}
    services = []
    for edge in environment.get("serviceInstances", {}).get("edges", []):
        service = edge["node"]
        latest = service.get("latestDeployment") or {}
        active = [d for d in service.get("activeDeployments", []) if not d.get("deploymentStopped")]
        running = [d for d in active if d.get("status") == "SUCCESS" and
                   any(i.get("status") == "RUNNING" for i in d.get("instances", []))]
        if running:
            state = "running"
        elif latest.get("status") in pending:
            state = "deploying"
        elif latest.get("status") in failed:
            state = "failed"
        elif not latest:
            state = "not_deployed"
        elif latest.get("status") == "SLEEPING":
            state = "sleeping"
        elif latest.get("deploymentStopped") or latest.get("status") in {"REMOVED", "CANCELED", "SUCCESS"}:
            state = "stopped"
        else:
            state = "unknown"
        services.append({"id": service["serviceId"], "name": service["serviceName"], "state": state,
                         "latest_status": latest.get("status"), "deployed_at": latest.get("createdAt"),
                         "deployment_id": latest.get("id"), "replicas": sum(1 for d in running for instance in d.get("instances", []) if instance.get("status") == "RUNNING"),
                         "latest_failed": latest.get("status") in failed,
                         "url": f"https://railway.com/project/{project['id']}/service/{service['serviceId']}?environmentId={environment_id}"})
    return {"project_id": project["id"], "project_name": project.get("name"),
            "environment": environment["name"], "services": sorted(services, key=lambda row: row["name"].lower())}


class RailwayMonitor(CachedMonitor):
    def __init__(self, *, local_cli: bool = False, loader: Callable | None = None,
                 project_id: str | None = None, environment_id: str | None = None, ttl: float = 60):
        super().__init__(ttl)
        self.local_cli = local_cli
        self.loader = loader
        self.project_id = project_id or os.environ.get("RAILWAY_PROJECT_ID") or PROJECT_ID
        self.environment_id = environment_id or os.environ.get("RAILWAY_ENVIRONMENT_ID") or ENVIRONMENT_ID

    def fetch(self) -> dict:
        if self.loader:
            project = self.loader()
        elif self.local_cli:
            command = shutil.which("railway")
            if not command:
                raise RuntimeError("Railway CLI unavailable")
            result = subprocess.run([command, "status", "--json"], cwd=ROOT, env=os.environ.copy(),
                                    capture_output=True, text=True, check=True, timeout=12)
            project = json.loads(result.stdout)
        else:
            token = os.environ.get("CARCAR_RAILWAY_PROJECT_TOKEN")
            if not token:
                return {"configured": False, "services": [], "project_id": self.project_id,
                        "error": "Мониторинг Railway не подключён. Нужен токен среды проекта на сервере Dashboard."}
            with httpx.Client(timeout=10, follow_redirects=False) as client:
                response = client.post("https://backboard.railway.com/graphql/v2",
                                       headers={"Project-Access-Token": token},
                                       json={"query": RAILWAY_QUERY, "variables": {"id": self.project_id}})
                response.raise_for_status()
                payload = response.json()
            if payload.get("errors"):
                raise RuntimeError("Railway rejected the monitoring query")
            project = payload["data"]["project"]
        if project["id"] != self.project_id:
            raise ValueError("Railway project mismatch")
        return {"configured": True, **railway_services(project, self.environment_id)}
