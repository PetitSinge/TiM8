import os, json
from fastapi import FastAPI, Request
import pymysql, openai, numpy as np

openai.api_key = os.environ.get('OPENAI_API_KEY')
EMBED_MODEL = os.environ.get('EMBED_MODEL','text-embedding-3-small')

app = FastAPI()

conn_args = dict(
    host=os.environ['TIDB_HOST'],
    port=int(os.environ.get('TIDB_PORT', 4000)),
    user=os.environ['TIDB_USER'],
    password=os.environ['TIDB_PASSWORD'],
    database=os.environ.get('TIDB_DB','incidentdb'),
    cursorclass=pymysql.cursors.DictCursor,
    ssl={'ssl':{}}
)

def embed(text: str) -> bytes:
    if not text:
        text = ""
    e = openai.embeddings.create(model=EMBED_MODEL, input=text).data[0].embedding
    arr = np.array(e, dtype=np.float32)
    return arr.tobytes()

@app.post('/ingest')
async def ingest(req: Request):
    payload = await req.json()
    # Expect Fluent Bit/OTEL compatible fields; map to schema
    row = dict(
        cluster=payload.get('cluster','local'),
        namespace=payload.get('kubernetes',{}).get('namespace_name') or payload.get('namespace') or 'default',
        app=payload.get('kubernetes',{}).get('labels',{}).get('app') or payload.get('app') or 'unknown',
        pod=payload.get('kubernetes',{}).get('pod_name') or payload.get('pod') or 'unknown',
        type='log',
        level=payload.get('level') or payload.get('severity') or 'info',
        body_json=json.dumps(payload),
        body_text=payload.get('log') or payload.get('message') or json.dumps(payload)
    )
    with pymysql.connect(**conn_args) as c:
        with c.cursor() as cur:
            cur.execute("INSERT INTO raw_events(cluster,namespace,app,pod,type,level,body_json,body_text) VALUES(%(cluster)s,%(namespace)s,%(app)s,%(pod)s,%(type)s,%(level)s,%(body_json)s,%(body_text)s)", row)
            eid = cur.lastrowid
            vec = embed(row['body_text'])
            cur.execute("INSERT INTO events_embeddings(event_id, embedding) VALUES(%s, %s)", (eid, vec))
            c.commit()
    return {"id": eid}