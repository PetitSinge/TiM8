import os, math, json
from fastapi import FastAPI
from pydantic import BaseModel
import pymysql, openai
from datetime import datetime, timedelta

openai.api_key = os.environ.get('OPENAI_API_KEY')
MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

app = FastAPI()

class Req(BaseModel):
    incident_id: int

conn_args = dict(
    host=os.environ['TIDB_HOST'],
    port=int(os.environ.get('TIDB_PORT', 4000)),
    user=os.environ['TIDB_USER'],
    password=os.environ['TIDB_PASSWORD'],
    database=os.environ.get('TIDB_DB','test'),
    cursorclass=pymysql.cursors.DictCursor,
    ssl={'ssl':{}}
)

def q(sql, *params):
    with pymysql.connect(**conn_args) as c:
        with c.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

@app.post('/hypothesis')
async def hypothesis(r: Req):
    inc = q('SELECT * FROM incidents WHERE id=%s', r.incident_id)[0]
    
    # Get current cluster health data
    cluster_health = q('''
        SELECT component, component_type, status, details, last_check 
        FROM cluster_health 
        WHERE cluster_name=%s AND workspace=%s 
        ORDER BY last_check DESC LIMIT 20
    ''', inc['cluster'], inc.get('workspace', 'TiM8-Local'))
    
    # Get historical incidents for pattern analysis
    similar_incidents = q('''
        SELECT title, cluster, namespace, app, status, mttr_seconds, resolution, created_at
        FROM incidents 
        WHERE (cluster=%s OR namespace=%s OR app=%s) 
        AND status='resolved' 
        AND id != %s
        ORDER BY created_at DESC LIMIT 10
    ''', inc['cluster'], inc['namespace'], inc['app'], r.incident_id)
    
    # Get recent raw events
    last_logs = q('''
        SELECT ts, level, body_text FROM raw_events 
        WHERE namespace=%s AND app=%s 
        ORDER BY ts DESC LIMIT 50
    ''', inc['namespace'], inc['app'])
    
    # Analyze patterns
    health_issues = [h for h in cluster_health if h['status'] in ['warning', 'critical']]
    avg_mttr = sum(s['mttr_seconds'] for s in similar_incidents if s['mttr_seconds']) / max(len([s for s in similar_incidents if s['mttr_seconds']]), 1)
    
    # Enhanced heuristics
    hints = []
    if any('OOMKilled' in (row['body_text'] or '') for row in last_logs):
        hints.append('OOM (Out of Memory) detected in logs')
    if any(h['component_type'] == 'pod' and h['status'] == 'critical' for h in health_issues):
        hints.append('Pod(s) in critical state')
    if any(h['component_type'] == 'node' and h['status'] == 'warning' for h in health_issues):
        hints.append('Node(s) showing warning signs')
    
    prompt = f"""
You are an expert DevOps detective with access to comprehensive cluster data. Analyze this incident:

INCIDENT DETAILS:
- Title: {inc['title']}
- Cluster: {inc['cluster']} 
- Namespace: {inc['namespace']}
- App: {inc['app']}
- Workspace: {inc.get('workspace', 'TiM8-Local')}

CURRENT CLUSTER HEALTH ({len(cluster_health)} components):
{json.dumps(cluster_health, indent=2, default=str)}

SIMILAR PAST INCIDENTS ({len(similar_incidents)} resolved):
{json.dumps(similar_incidents, indent=2, default=str)}
Average MTTR for similar incidents: {avg_mttr:.0f} seconds

RECENT LOGS (last 50 entries):
{json.dumps(last_logs, indent=2, default=str)}

DETECTED PATTERNS:
{json.dumps(hints, indent=2)}

Based on this comprehensive data, provide your expert analysis in JSON format:
{{
  "suspect": "most likely root cause",
  "confidence": 0.85,
  "reasoning": "detailed explanation based on health data, patterns, and historical incidents",
  "health_correlation": "how current health status relates to the incident",
  "similar_patterns": "patterns found in historical incidents",
  "estimated_mttr": "estimated resolution time based on historical data",
  "recommended_queries": ["SQL query 1", "SQL query 2"],
  "priority": "low|medium|high|critical"
}}
"""
    
    resp = openai.chat.completions.create(
        model=MODEL, 
        messages=[{"role":"user","content":prompt}],
        temperature=0.1
    )
    
    return {
        "incident_id": r.incident_id, 
        "analysis": resp.choices[0].message.content,
        "metadata": {
            "health_components_analyzed": len(cluster_health),
            "similar_incidents_found": len(similar_incidents),
            "log_entries_analyzed": len(last_logs),
            "avg_historical_mttr": avg_mttr
        }
    }