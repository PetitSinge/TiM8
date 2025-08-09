import os, json, openai
from fastapi import FastAPI
from pydantic import BaseModel
import pymysql
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

@app.post('/suggest')
async def suggest(r: Req):
    inc = q('SELECT * FROM incidents WHERE id=%s', r.incident_id)[0]
    
    # Get relevant runbooks based on service/app
    primary_runbooks = q('''
        SELECT id, service, title, body, tags, updated_at 
        FROM runbooks 
        WHERE service=%s 
        ORDER BY updated_at DESC 
        LIMIT 5
    ''', inc['app'])
    
    # Get runbooks based on tags/keywords from incident title
    incident_keywords = inc['title'].lower().split()
    keyword_runbooks = []
    
    for keyword in ['oom', 'crash', 'timeout', 'network', 'storage', 'cpu', 'memory']:
        if any(keyword in word for word in incident_keywords):
            keyword_runbooks.extend(q('''
                SELECT id, service, title, body, tags, updated_at 
                FROM runbooks 
                WHERE JSON_CONTAINS(LOWER(tags), %s)
                OR LOWER(title) LIKE %s
                OR LOWER(body) LIKE %s
                LIMIT 3
            ''', f'"{keyword}"', f'%{keyword}%', f'%{keyword}%'))
    
    # Get runbooks based on successful resolutions of similar incidents
    historical_resolutions = q('''
        SELECT resolution, title, app, namespace, cluster 
        FROM incidents 
        WHERE status='resolved' 
        AND (app=%s OR namespace=%s OR cluster=%s)
        AND resolution IS NOT NULL 
        AND resolution != ''
        ORDER BY created_at DESC 
        LIMIT 10
    ''', inc['app'], inc['namespace'], inc['cluster'])
    
    # Get cluster health status to recommend specific runbooks
    cluster_health = q('''
        SELECT component, component_type, status, details 
        FROM cluster_health 
        WHERE cluster_name=%s AND workspace=%s 
        AND status IN ('warning', 'critical')
        ORDER BY last_check DESC 
        LIMIT 10
    ''', inc['cluster'], inc.get('workspace', 'TiM8-Local'))
    
    # Prepare context for AI-powered runbook recommendations
    context = {
        "incident": inc,
        "primary_runbooks": primary_runbooks,
        "keyword_runbooks": keyword_runbooks[:5],  # Limit duplicates
        "historical_resolutions": historical_resolutions,
        "cluster_health_issues": cluster_health
    }
    
    # Generate AI-powered recommendations
    prompt = f"""
You are an expert DevOps runbook specialist. Based on the incident details and available data, recommend the most relevant runbooks and procedures.

INCIDENT DETAILS:
- Title: {inc['title']}
- App: {inc['app']}
- Namespace: {inc['namespace']}  
- Cluster: {inc['cluster']}
- Workspace: {inc.get('workspace', 'TiM8-Local')}

AVAILABLE RUNBOOKS FOR THIS SERVICE:
{json.dumps(primary_runbooks, indent=2, default=str)}

KEYWORD-MATCHED RUNBOOKS:
{json.dumps(keyword_runbooks[:5], indent=2, default=str)}

SUCCESSFUL RESOLUTIONS FROM SIMILAR INCIDENTS:
{json.dumps([{{
    "resolution": res['resolution'][:200] + "..." if len(res['resolution']) > 200 else res['resolution'],
    "context": f"{res['app']}/{res['namespace']}/{res['cluster']}"
}} for res in historical_resolutions], indent=2)}

CURRENT CLUSTER HEALTH ISSUES:
{json.dumps(cluster_health, indent=2, default=str)}

Provide recommendations in JSON format:
{{
  "recommended_runbooks": [
    {{
      "id": "runbook_id",
      "title": "runbook_title", 
      "relevance_score": 0.95,
      "why_relevant": "explanation of why this runbook is relevant",
      "priority": "high|medium|low"
    }}
  ],
  "custom_procedures": [
    {{
      "title": "Custom procedure based on historical data",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "estimated_time": "15 minutes",
      "based_on": "historical resolution pattern"
    }}
  ],
  "health_based_actions": [
    {{
      "component": "component_name",
      "issue": "warning/critical status",
      "recommended_action": "specific action to take",
      "urgency": "high|medium|low"
    }}
  ],
  "prevention_recommendations": [
    "Recommendation 1 to prevent similar incidents",
    "Recommendation 2 based on patterns"
  ]
}}
"""
    
    resp = openai.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )
    
    ai_recommendations = resp.choices[0].message.content
    
    # Combine all runbooks with relevance scoring
    all_runbooks = []
    
    # Add primary runbooks with high relevance
    for rb in primary_runbooks:
        all_runbooks.append({
            **rb,
            "relevance_score": 0.9,
            "source": "service_match",
            "last_updated": rb['updated_at'].isoformat() if rb['updated_at'] else None
        })
    
    # Add keyword runbooks with medium relevance
    for rb in keyword_runbooks:
        if rb['id'] not in [existing['id'] for existing in all_runbooks]:
            all_runbooks.append({
                **rb,
                "relevance_score": 0.7,
                "source": "keyword_match",
                "last_updated": rb['updated_at'].isoformat() if rb['updated_at'] else None
            })
    
    return {
        "incident_id": r.incident_id,
        "runbooks": all_runbooks,
        "ai_recommendations": ai_recommendations,
        "historical_insights": {
            "similar_incidents_resolved": len(historical_resolutions),
            "common_resolution_patterns": [res['resolution'][:100] + "..." if len(res['resolution']) > 100 else res['resolution'] for res in historical_resolutions[:3]],
            "cluster_health_issues": len(cluster_health)
        },
        "metadata": {
            "total_runbooks_found": len(all_runbooks),
            "service_specific_runbooks": len(primary_runbooks),
            "keyword_matched_runbooks": len(keyword_runbooks),
            "historical_resolutions_analyzed": len(historical_resolutions)
        }
    }