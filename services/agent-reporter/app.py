import os
from fastapi import FastAPI
from pydantic import BaseModel
import httpx

SLACK_WEBHOOK = os.environ.get('SLACK_WEBHOOK')
app = FastAPI()

class Report(BaseModel):
    incident_id: int
    text: str

@app.post('/notify')
async def notify(r: Report):
    if SLACK_WEBHOOK:
        async with httpx.AsyncClient() as http:
            await http.post(SLACK_WEBHOOK, json={"text": r.text})
    return {"ok": True}