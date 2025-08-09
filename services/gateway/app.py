import os, json, asyncio
from typing import Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from tidb import TiDB
from llm import llm_summarize
from k8s import K8s
import httpx
from app_clusters import r as clusters_router
from poller import start_poller

AGENTS = {
    'detective': os.environ.get('DETECTIVE_URL', 'http://agent-detective:8000'),
    'context':   os.environ.get('CONTEXT_URL',   'http://agent-context:8000'),
    'runbook':   os.environ.get('RUNBOOK_URL',   'http://agent-runbook:8000'),
    'remed':     os.environ.get('REMED_URL',     'http://agent-remediator:8000'),
    'report':    os.environ.get('REPORT_URL',    'http://agent-reporter:8000'),
}

app = FastAPI(title='Incident Co‑Pilot Gateway')
tidb = TiDB()
k8s = K8s()

# Include clusters router
app.include_router(clusters_router)

class IncidentOpen(BaseModel):
    cluster: str
    namespace: str
    app: str
    title: str
    seed_event_id: int | None = None

# simple in‑memory ws hub
clients: set[WebSocket] = set()

@app.websocket('/ws')
async def ws(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.remove(ws)

async def broadcast(event: Dict[str, Any]):
    dead = []
    for c in list(clients):
        try:
            await c.send_text(json.dumps(event))
        except Exception:
            dead.append(c)
    for d in dead:
        clients.discard(d)

@app.get('/healthz')
async def healthz():
    return {'ok': True}

@app.post('/incidents')
async def open_incident(req: IncidentOpen):
    iid = tidb.create_incident(req.title, req.cluster, req.namespace, req.app)
    await broadcast({'type':'incident_opened','id':iid,'title':req.title})
    # fan‑out to agents
    async with httpx.AsyncClient(timeout=30) as http:
        detective = await http.post(f"{AGENTS['detective']}/hypothesis", json={'incident_id': iid})
        context   = await http.post(f"{AGENTS['context']}/context", json={'incident_id': iid})
        runbook   = await http.post(f"{AGENTS['runbook']}/suggest", json={'incident_id': iid})
    # summarize
    summary = llm_summarize([
        ('detective', detective.json()),
        ('context', context.json()),
        ('runbook', runbook.json())
    ])
    tidb.update_incident_summary(iid, summary)
    await broadcast({'type':'incident_updated','id':iid,'summary':summary})
    return {'id': iid, 'summary': summary}

@app.post('/incidents/{iid}/remediate')
async def remediate(iid: int):
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.post(f"{AGENTS['remed']}/propose", json={'incident_id': iid})
    plan = r.json()
    await broadcast({'type':'remediation_plan','id':iid,'plan':plan})
    return plan

@app.post('/incidents/{iid}/resolve')
async def resolve(iid: int):
    tidb.resolve_incident(iid)
    await broadcast({'type':'incident_resolved','id':iid})
    return {'ok': True}

@app.get('/search')
async def search(q: str, k: int = 10):
    return tidb.search_events(q, k)

# New TiM8 API endpoints
@app.get('/api/workspaces')
async def get_workspaces():
    """Get all workspaces"""
    return tidb.get_workspaces()

@app.get('/api/workspaces/{workspace_name}/clusters')
async def get_workspace_clusters(workspace_name: str):
    """Get clusters in a workspace"""
    return tidb.get_workspace_clusters(workspace_name)

@app.get('/api/cluster/{cluster_name}/health')
async def get_cluster_health(cluster_name: str, workspace: str = 'TiM8-Local'):
    """Get cluster health status"""
    return tidb.get_cluster_health(cluster_name, workspace)

@app.get('/api/incidents/recent')
async def get_recent_incidents(workspace: str = None, limit: int = 5):
    """Get recent incidents, optionally filtered by workspace"""
    return tidb.get_recent_incidents(workspace, limit)

@app.get('/api/stats/mttr')
async def get_mttr_stats(workspace: str = None):
    """Get MTTR statistics, optionally filtered by workspace"""
    return tidb.get_mttr_stats(workspace)

@app.get('/api/dashboard/overview')
async def get_dashboard_overview():
    """Get dashboard overview with workspaces health and recent incidents"""
    workspaces = tidb.get_workspaces()
    recent_incidents = tidb.get_recent_incidents(None, 5)
    mttr_stats = tidb.get_mttr_stats()
    
    return {
        'workspaces': workspaces,
        'recent_incidents': recent_incidents,
        'mttr_stats': mttr_stats
    }

class WorkspaceCreate(BaseModel):
    name: str
    description: str
    clusters: list[str]

@app.post('/api/workspaces')
async def create_workspace(workspace: WorkspaceCreate):
    """Create a new workspace"""
    return tidb.create_workspace(workspace.name, workspace.description, workspace.clusters)

@app.delete('/api/workspaces/{workspace_id}')
async def delete_workspace(workspace_id: str):
    """Delete a workspace"""
    return tidb.delete_workspace(workspace_id)

@app.on_event("startup")
async def startup_event():
    """Start the cluster poller on app startup"""
    start_poller()