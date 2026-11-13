"""Local Dashboard preview with live reload and read-only production data.

Run: .venv/bin/python scripts/dev_dashboard.py
Open: http://localhost:8078
"""

from pathlib import Path
import sys
import os
import re

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def preview_app():
    from fastapi.responses import HTMLResponse, JSONResponse
    from psycopg.conninfo import make_conninfo
    from carcar.config import load_env_file
    from carcar.db import database_url
    from carcar.dashboard.app import create_app

    load_env_file()
    if not os.environ.get("CARCAR_DASHBOARD_PASSWORD"):
        os.environ["CARCAR_DASHBOARD_PASSWORD"] = "carcar-local"
    url = database_url()
    if not url:
        raise RuntimeError("Configure the existing database connection before previewing")
    # Enforced by PostgreSQL, including connections opened by the pool.
    readonly_url = make_conninfo(url, options="-c default_transaction_read_only=on -c statement_timeout=15000")
    app = create_app(use_db=True, db_url=readonly_url)

    def revision():
        return str(max(p.stat().st_mtime_ns for p in (ROOT / "carcar" / "dashboard").rglob("*") if p.is_file() and "__pycache__" not in p.parts))

    @app.middleware("http")
    async def local_preview(request, call_next):
        if request.url.path == "/_dev/revision":
            return JSONResponse({"revision": revision()}, headers={"Cache-Control": "no-store"})
        if request.method not in {"GET", "HEAD", "OPTIONS"} and request.url.path not in {"/api/session", "/api/session/logout"}:
            return JSONResponse({"detail": "Локальный предпросмотр: рабочая база доступна только для чтения"}, status_code=403)
        response = await call_next(request)
        if "text/html" not in response.headers.get("content-type", ""):
            return response
        body = b"".join([part async for part in response.body_iterator]).decode("utf-8")
        notice = '<div id="local-preview-banner" style="background:#eef2ff;color:#3730a3;padding:6px 16px;font:12px system-ui;text-align:center">Локальный предпросмотр · рабочие данные только для чтения · обновляется автоматически</div>'
        reload_script = """<script>(()=>{let version;setInterval(async()=>{try{const r=await fetch('/_dev/revision',{cache:'no-store'});const d=await r.json();if(version&&version!==d.revision)location.reload();version=d.revision;}catch{}},1000)})()</script>"""
        stamp = revision()
        for asset in ("style.css", "app.js", "listing.js"):
            body = re.sub(rf'/static/{re.escape(asset)}(?:\?[^" ]*)?"', f'/static/{asset}?v={stamp}"', body)
        return HTMLResponse(body.replace("<body>", '<body data-read-only-preview="true">' + notice).replace("</body>", reload_script + "</body>"), status_code=response.status_code, headers={"Cache-Control": "no-store"})

    return app


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("dev_dashboard:preview_app", factory=True, host="127.0.0.1", port=8078,
                reload=True, reload_dirs=[str(ROOT / "carcar" / "dashboard"), str(ROOT / "scripts")])
