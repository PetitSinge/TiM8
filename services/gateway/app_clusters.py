from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .tidb import TiDB
import secrets, datetime as dt, json, logging

logger = logging.getLogger("tim8.clusters")
r = APIRouter(prefix="/api", tags=["clusters"])
db = TiDB()

class EnrollReq(BaseModel):
    workspace: str
    ttl_minutes: int = 60

@r.post("/enroll-token")
def enroll_token(req: EnrollReq):
    """Generate enrollment token for agent-based clusters"""
    logger.info(f"Generating enrollment token for workspace: {req.workspace}")
    
    token = secrets.token_urlsafe(32)
    exp = dt.datetime.utcnow() + dt.timedelta(minutes=req.ttl_minutes)
    
    try:
        db.save_enroll_token(token, req.workspace, exp)
        logger.info(f"Enrollment token generated successfully for {req.workspace}")
        return {
            "token": token, 
            "workspace": req.workspace, 
            "expires_at": exp.isoformat() + "Z"
        }
    except Exception as e:
        logger.error(f"Failed to save enrollment token: {e}")
        raise HTTPException(500, "Failed to generate token")

class AgentHello(BaseModel):
    token: str
    cluster_name: str
    workspace: str | None = None
    namespaces: list[str]

@r.post("/agent/hello")
def agent_hello(a: AgentHello):
    """Agent registration endpoint"""
    logger.info(f"Agent hello from cluster: {a.cluster_name}")
    
    try:
        tok = db.get_enroll_token(a.token)
        if not tok: 
            logger.warning(f"Invalid token used by {a.cluster_name}")
            raise HTTPException(401, "invalid token")
        
        if tok["expires_at"] and tok["expires_at"] < dt.datetime.utcnow():
            logger.warning(f"Expired token used by {a.cluster_name}")
            raise HTTPException(401, "token expired")
        
        ws = a.workspace or tok["workspace"]
        db.upsert_cluster(a.cluster_name, ws, "agent", a.namespaces)
        
        logger.info(f"Agent {a.cluster_name} registered in workspace {ws}")
        return {"workspace": ws}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Agent hello error: {e}")
        raise HTTPException(500, "Registration failed")

class AgentHealth(BaseModel):
    cluster_name: str
    workspace: str
    health: dict

@r.post("/agent/health")
def agent_health(h: AgentHealth):
    """Receive health data from agent"""
    try:
        db.store_cluster_health(h.cluster_name, h.workspace, h.health)
        db.mark_cluster_sync(h.cluster_name, h.workspace, "connected")
        return {"ok": True}
    except Exception as e:
        logger.error(f"Failed to store health from {h.cluster_name}: {e}")
        raise HTTPException(500, "Failed to store health data")

class RegisterReq(BaseModel):
    name: str
    workspace: str
    mode: str  # 'kubeconfig'
    kubeconfig: str
    namespaces: list[str]

@r.post("/clusters/register")
def register_cluster(req: RegisterReq):
    """Register a kubeconfig-based cluster"""
    logger.info(f"Registering cluster {req.name} in workspace {req.workspace}")
    
    if req.mode != "kubeconfig":
        raise HTTPException(400, "unsupported mode")
    
    try:
        ref = db.create_kubeconfig_secret_ref(req.workspace, req.name, req.kubeconfig)
        db.upsert_cluster(req.name, req.workspace, "kubeconfig", req.namespaces, kube_ref=ref)
        
        logger.info(f"Cluster {req.name} registered successfully with secret ref {ref}")
        return {"registered": True, "secret_ref": ref}
        
    except Exception as e:
        logger.error(f"Failed to register cluster {req.name}: {e}")
        raise HTTPException(500, f"Registration failed: {str(e)}")

@r.get("/clusters")
def list_clusters():
    """List all registered clusters"""
    try:
        rows = db.list_clusters()
        # Convert IDs to strings for frontend compatibility
        for r_ in rows:
            r_["id"] = str(r_["id"])
        logger.debug(f"Listed {len(rows)} clusters")
        return rows
    except Exception as e:
        logger.error(f"Failed to list clusters: {e}")
        raise HTTPException(500, "Failed to list clusters")