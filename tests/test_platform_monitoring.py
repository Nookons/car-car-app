from datetime import UTC, datetime
import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from carcar.dashboard.app import create_app
from carcar.dashboard.platform import (
    ENVIRONMENT_ID, PROJECT_ID, CachedMonitor, RailwayMonitor, SupabaseMonitor,
    project_ref, quota, railway_services,
)

REF = 'aiqmqmhqbhufcybrccxt'


class Repo:
    def __init__(self): self.calls = 0
    def resource_usage(self):
        self.calls += 1
        return dict(database_bytes=1024**3, connections=17, active_connections=5,
                    max_connections=60,reserved_connections=3)
    def close(self): pass


def test_project_binding_works_for_direct_and_pooler_connections():
    assert project_ref(f'postgresql://postgres:secret@db.{REF}.supabase.co/postgres') == REF
    assert project_ref(f'postgresql://postgres.{REF}:secret@pooler.supabase.com/postgres') == REF
    assert project_ref('postgresql://postgres:secret@other.example/postgres') is None


@pytest.mark.parametrize('used,limit,state',[(None,250,'unknown'),(0,250,'ok'),(200,250,'warning'),
                                           (240,250,'critical'),(300,250,'exceeded'),(1,0,'unknown'),
                                           (float('nan'),250,'unknown'),(-1,250,'unknown')])
def test_quota_headroom_and_unknown_states(used,limit,state):
    result = quota(used,limit)
    assert result['state'] == state
    if state == 'exceeded': assert result['remaining'] == 0 and result['percent'] == 120
    if state == 'unknown': assert result['percent'] is None and result['remaining'] is None
    assert quota(300,250,True)['state'] == 'info'


def make_snapshot(tmp_path):
    path=tmp_path/'usage.json'
    path.write_text(json.dumps(dict(project_ref=REF,organization_slug='carcar',plan='Pro',
        verified_at='2026-11-13T08:00:00Z',period_start='2026-11-12',period_end='2026-12-12',
        metrics=[dict(key='egress',label='Egress',used=0.471,limit=250,unit='GB')],allocated_disk_gb=8,included_disk_gb=8)))
    return path


def test_supabase_separates_billing_from_database_and_caches_reads(tmp_path,monkeypatch):
    monkeypatch.setattr('carcar.dashboard.platform.utcnow',lambda:datetime(2026,11,13,9,tzinfo=UTC))
    repo=Repo();monitor=SupabaseMonitor(repo,f'postgresql://postgres@db.{REF}.supabase.co/postgres',make_snapshot(tmp_path))
    data=monitor.get()
    assert data['connections']['limit']==57  # Reserved slots are not normal application capacity.
    assert data['database_bytes']==1024**3
    assert data['billing']['valid_period']
    assert data['billing']['metrics'][0]['used']==0.471
    data['billing']['metrics'][0]['used']=200  # Callers cannot mutate the cache.
    assert monitor.get()['billing']['metrics'][0]['used']==0.471
    assert repo.calls==1


def test_snapshot_is_not_reused_after_billing_cycle_or_for_other_projects(tmp_path,monkeypatch):
    monkeypatch.setattr('carcar.dashboard.platform.utcnow',lambda:datetime(2026,12,13,tzinfo=UTC))
    path=make_snapshot(tmp_path)
    monitor=SupabaseMonitor(Repo(),f'postgresql://postgres@db.{REF}.supabase.co/postgres',path)
    data=monitor.get()
    assert not data['billing']['valid_period']
    assert data['billing']['metrics'][0]['used'] is None
    assert data['billing']['metrics'][0]['state']=='unknown'
    other=SupabaseMonitor(Repo(),'postgresql://postgres@db.aaaaaaaaaaaaaaaaaaaa.supabase.co/postgres',path)
    assert not other.get()['billing']['available']
    assert other.get()['billing']['metrics']==[]


def test_provider_outage_preserves_labelled_last_success_and_hides_error_details():
    class Monitor(CachedMonitor):
        failed=False
        def fetch(self):
            if self.failed: raise RuntimeError('Authorization: super-secret-token')
            return {'services':[{'name':'api'}]}
    monitor=Monitor(ttl=0)
    first=monitor.get()
    monitor.failed=True
    failed=monitor.get()
    assert failed['stale']
    assert failed['services']==first['services']
    assert failed['updated_at']==first['updated_at']
    assert 'super-secret-token' not in json.dumps(failed)
    monitor.failed=False
    assert 'error' not in monitor.get()


def project(services):
    return dict(id=PROJECT_ID,name='CarCar',environments={'edges':[{'node':dict(id=ENVIRONMENT_ID,name='production',serviceInstances={'edges':[{'node':s} for s in services]})}]})


def service(name, latest=None, active=None):
    return dict(serviceId=name,serviceName=name,latestDeployment=latest,activeDeployments=active or [])


def deployment(status,instances=None,stopped=False):
    return dict(id='deployment-id',status=status,createdAt='2026-11-13T08:00:00Z',deploymentStopped=stopped,instances=instances or [])


def test_railway_does_not_confuse_successful_deployment_with_running_process():
    running=deployment('SUCCESS',[{'id':'instance','status':'RUNNING'},{'id':'old-instance','status':'REMOVED'}])
    data=railway_services(project([
        service('api',deployment('FAILED'),[running]),
        service('enricher3'),
        service('job',deployment('SUCCESS')),
        service('stopped',deployment('SUCCESS',[{'status':'RUNNING'}],True)),
        service('building',deployment('BUILDING')),
        service('crashed',deployment('CRASHED')),
    ]),ENVIRONMENT_ID)
    states={s['name']:s for s in data['services']}
    assert states['api']['state']=='running' and states['api']['latest_failed']
    assert states['api']['replicas']==1
    assert states['enricher3']['state']=='not_deployed'
    assert states['job']['state']=='stopped'
    assert states['stopped']['state']=='stopped'
    assert states['building']['state']=='deploying'
    assert states['crashed']['state']=='failed'
    assert len(data['services'])==6


def test_railway_rejects_other_environment_and_project():
    with pytest.raises(ValueError): railway_services(project([]),'other-environment')
    monitor=RailwayMonitor(loader=lambda:{**project([]),'id':'other-project'})
    result=monitor.get()
    assert result['stale'] and 'services' not in result


def test_unconfigured_railway_does_not_report_everything_healthy(monkeypatch):
    monkeypatch.delenv('CARCAR_RAILWAY_PROJECT_TOKEN',raising=False)
    result=RailwayMonitor().get()
    assert result['configured'] is False
    assert result['services']==[] and result['error']


def test_platform_routes_require_dashboard_login_and_do_not_cache_private_data(monkeypatch,tmp_path):
    repo=Repo()
    monkeypatch.setattr('carcar.dashboard.app.DatabaseRepo',lambda url:repo)
    monkeypatch.setenv('CARCAR_DASHBOARD_PASSWORD','admin-test-password')
    app=create_app(root=tmp_path,use_db=True,db_url=f'postgresql://postgres@db.{REF}.supabase.co/postgres')
    with TestClient(app,base_url='https://testserver') as client:
        assert client.get('/api/platform/supabase').status_code==401
        assert client.get('/api/platform/railway').status_code==401
        assert repo.calls==0
        client.post('/api/session',json={'password':'admin-test-password'})
        response=client.get('/api/platform/supabase')
        assert response.status_code==200
        assert response.headers['cache-control']=='private, no-store'
        client.get('/api/platform/supabase')
        assert repo.calls==1


def test_project_token_stays_on_server_and_only_status_query_is_sent(monkeypatch):
    token='test-secret-not-for-browser'
    monkeypatch.setenv('CARCAR_RAILWAY_PROJECT_TOKEN',token)
    original_client=httpx.Client
    def handler(request):
        assert request.headers['Project-Access-Token']==token
        body=json.loads(request.content)
        assert body['query'].strip().startswith('query ')
        assert 'mutation' not in body['query']
        assert body['variables']['id']==PROJECT_ID
        return httpx.Response(200,json={'data':{'project':project([service('api')])}})
    monkeypatch.setattr('carcar.dashboard.platform.httpx.Client',
                        lambda **kwargs:original_client(transport=httpx.MockTransport(handler),**kwargs))
    result=RailwayMonitor().get()
    assert result['configured']
    assert result['services'][0]['name']=='api'
    assert token not in json.dumps(result)
