import os, json, time, asyncio
from datetime import datetime, timedelta
from fastapi import FastAPI
from kubernetes import client, config
import pymysql
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title='TiM8 Agent Collector')

# K8s client
try:
    config.load_incluster_config()
    logger.info("Loaded in-cluster K8s config")
except Exception:
    try:
        config.load_kube_config()
        logger.info("Loaded local K8s config")
    except Exception as e:
        logger.error(f"Failed to load K8s config: {e}")

v1 = client.CoreV1Api()
apps_v1 = client.AppsV1Api()

# TiDB connection
conn_args = dict(
    host=os.environ['TIDB_HOST'],
    port=int(os.environ.get('TIDB_PORT', 4000)),
    user=os.environ['TIDB_USER'],
    password=os.environ['TIDB_PASSWORD'],
    database=os.environ.get('TIDB_DB','test'),
    cursorclass=pymysql.cursors.DictCursor,
    ssl={'ssl':{}}
)

def get_cluster_name():
    """Get cluster name from environment or default to 'incident-copilot'"""
    return os.environ.get('CLUSTER_NAME', 'incident-copilot')

def get_workspace():
    """Get workspace from environment or default to 'TiM8-Local'"""
    return os.environ.get('WORKSPACE', 'TiM8-Local')

def insert_cluster_health(cluster_name, workspace, component, component_type, status, details):
    """Insert or update cluster health data"""
    try:
        with pymysql.connect(**conn_args) as conn:
            with conn.cursor() as cursor:
                # Delete old entry for this component
                cursor.execute(
                    "DELETE FROM cluster_health WHERE cluster_name=%s AND component=%s", 
                    (cluster_name, component)
                )
                # Insert new health data
                cursor.execute(
                    """INSERT INTO cluster_health(cluster_name, workspace, component, component_type, status, details) 
                       VALUES(%s, %s, %s, %s, %s, %s)""",
                    (cluster_name, workspace, component, component_type, status, json.dumps(details))
                )
                conn.commit()
                logger.info(f"Updated health for {component}: {status}")
    except Exception as e:
        logger.error(f"Failed to insert cluster health: {e}")

def check_pods_health():
    """Check health of all pods in cluster"""
    cluster_name = get_cluster_name()
    workspace = get_workspace()
    
    try:
        # Get all pods
        pods = v1.list_pod_for_all_namespaces()
        namespace_stats = {}
        
        for pod in pods.items:
            ns = pod.metadata.namespace
            if ns not in namespace_stats:
                namespace_stats[ns] = {'total': 0, 'ready': 0, 'failed': 0}
            
            namespace_stats[ns]['total'] += 1
            
            # Check pod status
            if pod.status.phase == 'Running':
                # Check if all containers are ready
                ready = True
                if pod.status.container_statuses:
                    ready = all(c.ready for c in pod.status.container_statuses)
                if ready:
                    namespace_stats[ns]['ready'] += 1
                else:
                    namespace_stats[ns]['failed'] += 1
            else:
                namespace_stats[ns]['failed'] += 1
        
        # Insert health data for each namespace
        for ns, stats in namespace_stats.items():
            status = 'healthy' if stats['failed'] == 0 else ('warning' if stats['failed'] < stats['total'] // 2 else 'critical')
            details = {
                'pods_total': stats['total'],
                'pods_ready': stats['ready'],
                'pods_failed': stats['failed']
            }
            insert_cluster_health(cluster_name, workspace, ns, 'namespace', status, details)
            
    except Exception as e:
        logger.error(f"Failed to check pods health: {e}")

def check_deployments_health():
    """Check health of deployments"""
    cluster_name = get_cluster_name()
    workspace = get_workspace()
    
    try:
        deployments = apps_v1.list_deployment_for_all_namespaces()
        
        for deploy in deployments.items:
            name = deploy.metadata.name
            namespace = deploy.metadata.namespace
            spec_replicas = deploy.spec.replicas or 0
            ready_replicas = deploy.status.ready_replicas or 0
            
            status = 'healthy' if ready_replicas == spec_replicas else ('warning' if ready_replicas > 0 else 'critical')
            details = {
                'replicas_desired': spec_replicas,
                'replicas_ready': ready_replicas,
                'namespace': namespace
            }
            
            insert_cluster_health(cluster_name, workspace, name, 'deployment', status, details)
            
    except Exception as e:
        logger.error(f"Failed to check deployments health: {e}")

def check_nodes_health():
    """Check health of cluster nodes"""
    cluster_name = get_cluster_name()
    workspace = get_workspace()
    
    try:
        nodes = v1.list_node()
        total_nodes = len(nodes.items)
        ready_nodes = 0
        
        for node in nodes.items:
            # Check node conditions
            ready = False
            if node.status.conditions:
                for condition in node.status.conditions:
                    if condition.type == 'Ready' and condition.status == 'True':
                        ready = True
                        break
            if ready:
                ready_nodes += 1
        
        status = 'healthy' if ready_nodes == total_nodes else ('warning' if ready_nodes > 0 else 'critical')
        details = {
            'nodes_total': total_nodes,
            'nodes_ready': ready_nodes
        }
        
        insert_cluster_health(cluster_name, workspace, 'cluster-nodes', 'node', status, details)
        
    except Exception as e:
        logger.error(f"Failed to check nodes health: {e}")

async def health_check_loop():
    """Main health check loop"""
    logger.info("Starting health check loop...")
    
    while True:
        try:
            logger.info("Running health checks...")
            check_pods_health()
            check_deployments_health()  
            check_nodes_health()
            logger.info("Health checks completed")
            
            # Wait 30 seconds before next check
            await asyncio.sleep(30)
            
        except Exception as e:
            logger.error(f"Error in health check loop: {e}")
            await asyncio.sleep(30)

@app.on_event("startup")
async def startup_event():
    """Start background health checking"""
    asyncio.create_task(health_check_loop())

@app.get('/health')
async def health():
    return {'status': 'healthy', 'service': 'agent-collector'}

@app.get('/metrics')
async def metrics():
    """Get current cluster metrics"""
    cluster_name = get_cluster_name()
    workspace = get_workspace()
    
    try:
        with pymysql.connect(**conn_args) as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM cluster_health WHERE cluster_name=%s AND workspace=%s ORDER BY last_check DESC",
                    (cluster_name, workspace)
                )
                return cursor.fetchall()
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        return []