import os, json
from fastapi import FastAPI
from pydantic import BaseModel
import openai, pymysql

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
    database=os.environ.get('TIDB_DB','incidentdb'),
    cursorclass=pymysql.cursors.DictCursor,
    ssl={'ssl':{}}
)

@app.post('/propose')
async def propose(r: Req):
    with pymysql.connect(**conn_args) as c:
        with c.cursor() as cur:
            cur.execute('SELECT * FROM incidents WHERE id=%s', (r.incident_id,))
            inc = cur.fetchone()
            cur.execute('SELECT body_text FROM raw_events WHERE namespace=%s AND app=%s ORDER BY ts DESC LIMIT 30', (inc['namespace'], inc['app']))
            logs = [row['body_text'] for row in cur.fetchall()]
    prompt = f"""
Given these logs, propose a minimal Kubernetes patch (JSON strategic merge) to mitigate an OOMCrashLoop for app {inc['app']} in ns {inc['namespace']}.
Only output JSON with keys: action ('patch'|'scale'|'restart'), target ('deployment/name'), patch (object), rollout_cmd.
Logs:\n{logs}
"""
    try:
        resp = openai.chat.completions.create(model=MODEL, messages=[{"role":"user","content":prompt}])
        return json.loads(resp.choices[0].message.content)
    except json.JSONDecodeError:
        # Fallback if LLM doesn't return valid JSON
        return {
            "action": "patch",
            "target": f"deployment/{inc['app']}",
            "patch": {
                "spec": {
                    "template": {
                        "spec": {
                            "containers": [
                                {
                                    "name": inc['app'],
                                    "resources": {
                                        "limits": {
                                            "memory": "512Mi"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            "rollout_cmd": f"kubectl -n {inc['namespace']} patch deployment/{inc['app']} -p '{{\"spec\":{{\"template\":{{\"spec\":{{\"containers\":[{{\"name\":\"{inc['app']}\",\"resources\":{{\"limits\":{{\"memory\":\"512Mi\"}}}}}}]}}}}}}}}'"
        }