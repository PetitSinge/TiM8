import os, json
from fastapi import FastAPI
from pydantic import BaseModel
import pymysql
from datetime import datetime, timedelta

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

@app.post('/context')
async def build_context(r: Req):
    inc = q('SELECT * FROM incidents WHERE id=%s', r.incident_id)[0]
    
    # Enhanced context gathering
    context = {
        "incident": inc,
        "events_in_scope": 0,
        "cluster_health": {},
        "historical_patterns": {},
        "workspace_context": {},
        "related_incidents": []
    }
    
    # Count events
    event_count = q('SELECT COUNT(*) as cnt FROM raw_events WHERE namespace=%s AND app=%s', inc['namespace'], inc['app'])
    context["events_in_scope"] = event_count[0]['cnt'] if event_count else 0
    
    # Current cluster health context
    cluster_health = q('''
        SELECT component_type, status, COUNT(*) as count
        FROM cluster_health 
        WHERE cluster_name=%s AND workspace=%s 
        GROUP BY component_type, status
    ''', inc['cluster'], inc.get('workspace', 'TiM8-Local'))
    
    health_summary = {}
    for h in cluster_health:
        comp_type = h['component_type']
        if comp_type not in health_summary:
            health_summary[comp_type] = {}
        health_summary[comp_type][h['status']] = h['count']
    
    context["cluster_health"] = health_summary
    
    # Workspace context
    workspace_info = q('SELECT * FROM workspaces WHERE name=%s', inc.get('workspace', 'TiM8-Local'))
    if workspace_info:
        ws = workspace_info[0]
        context["workspace_context"] = {
            "name": ws['name'],
            "description": ws['description'], 
            "total_clusters": len(json.loads(ws['clusters'] or '[]')),
            "clusters": json.loads(ws['clusters'] or '[]')
        }
    
    # Historical incident patterns
    historical = q('''
        SELECT 
            COUNT(*) as total_incidents,
            AVG(mttr_seconds) as avg_mttr,
            COUNT(CASE WHEN status='resolved' THEN 1 END) as resolved_count,
            COUNT(CASE WHEN status='open' THEN 1 END) as open_count
        FROM incidents 
        WHERE workspace=%s AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ''', inc.get('workspace', 'TiM8-Local'))
    
    if historical:
        h = historical[0]
        context["historical_patterns"] = {
            "last_30_days": {
                "total_incidents": h['total_incidents'] or 0,
                "avg_mttr_seconds": h['avg_mttr'] or 0,
                "resolved_count": h['resolved_count'] or 0,
                "open_count": h['open_count'] or 0,
                "resolution_rate": (h['resolved_count'] or 0) / max(h['total_incidents'] or 1, 1)
            }
        }
    
    # Related incidents (same app/namespace/cluster)
    related = q('''
        SELECT id, title, status, created_at, mttr_seconds, resolution
        FROM incidents 
        WHERE (app=%s OR namespace=%s OR cluster=%s) 
        AND id != %s 
        ORDER BY created_at DESC 
        LIMIT 5
    ''', inc['app'], inc['namespace'], inc['cluster'], r.incident_id)
    
    context["related_incidents"] = [
        {
            "id": rel['id'],
            "title": rel['title'],
            "status": rel['status'],
            "created_at": rel['created_at'].isoformat() if rel['created_at'] else None,
            "mttr_seconds": rel['mttr_seconds'],
            "resolution_summary": rel['resolution'][:100] + "..." if rel['resolution'] and len(rel['resolution']) > 100 else rel['resolution']
        }
        for rel in related
    ]
    
    # MTTR statistics for this workspace
    mttr_stats = q('SELECT * FROM mttr_stats WHERE workspace=%s ORDER BY calculated_at DESC LIMIT 1', inc.get('workspace', 'TiM8-Local'))
    if mttr_stats:
        stats = mttr_stats[0]
        context["workspace_context"]["mttr_stats"] = {
            "avg_mttr_seconds": stats['avg_mttr_seconds'],
            "incident_count": stats['incident_count'],
            "last_calculated": stats['calculated_at'].isoformat() if stats['calculated_at'] else None
        }
    
    # Time-based context
    now = datetime.now()
    hour = now.hour
    day_of_week = now.weekday()
    
    context["temporal_context"] = {
        "current_time": now.isoformat(),
        "hour_of_day": hour,
        "day_of_week": day_of_week,
        "is_business_hours": 9 <= hour <= 17 and day_of_week < 5,
        "is_weekend": day_of_week >= 5,
        "shift": "night" if hour < 6 or hour > 22 else "day"
    }
    
    return {
        "incident_id": r.incident_id, 
        "context": context,
        "summary": {
            "scope": f"Incident in {inc['cluster']}/{inc['namespace']}/{inc['app']}",
            "health_status": f"{sum(sum(statuses.values()) for statuses in health_summary.values())} components monitored",
            "historical_trend": f"{context['historical_patterns']['last_30_days']['total_incidents']} incidents in last 30 days" if context.get('historical_patterns') else "No historical data",
            "related_incidents": f"{len(context['related_incidents'])} related incidents found",
            "business_impact": "High" if not context["temporal_context"]["is_business_hours"] else "Medium"
        }
    }