import os
from typing import List, Tuple
import openai

openai.api_key = os.environ.get('OPENAI_API_KEY')
MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

def llm_summarize(chunks: List[Tuple[str, dict]]) -> str:
    body = "\n".join([f"[{k}] {v}" for k, v in chunks])
    prompt = f"""
You are an SRE incident commander. Summarize the following agent outputs into a concise situation report (<=10 lines):
- What happened
- Probable cause
- Immediate actions
- Next steps

Data:\n{body}
"""
    resp = openai.chat.completions.create(model=MODEL, messages=[
        {"role":"system","content":"You are a pragmatic SRE."},
        {"role":"user","content":prompt}
    ])
    return resp.choices[0].message.content