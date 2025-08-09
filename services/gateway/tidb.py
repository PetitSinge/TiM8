import os, time, json, datetime as dt, logging
import pymysql
from .k8s_secret import create_or_replace_secret

logger = logging.getLogger("tim8.tidb")

class TiDB:
    def __init__(self):
        self.conn_args = dict(
            host=os.environ['TIDB_HOST'],
            port=int(os.environ.get('TIDB_PORT', 4000)),
            user=os.environ['TIDB_USER'],
            password=os.environ['TIDB_PASSWORD'],
            database=os.environ.get('TIDB_DB','test'),
            cursorclass=pymysql.cursors.DictCursor,
            ssl={'ssl':{}}
        )

    def _conn(self):
        return pymysql.connect(**self.conn_args)

    def create_incident(self, title, cluster, namespace, app):
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("INSERT INTO incidents(title, cluster, namespace, app) VALUES(%s,%s,%s,%s)", (title, cluster, namespace, app))
                c.commit()
                return cur.lastrowid

    def update_incident_summary(self, iid, summary):
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("UPDATE incidents SET summary=%s WHERE id=%s", (summary, iid))
                c.commit()

    def resolve_incident(self, iid):
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("UPDATE incidents SET status='resolved', mttr_seconds=TIMESTAMPDIFF(SECOND, created_at, NOW()) WHERE id=%s", (iid,))
                c.commit()

    def search_events(self, q, k):
        # naive FT: LIKE + order by ts desc (for demo). Vector search handled by detective agent.
        like = f"%{q}%"
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("SELECT id, cluster, namespace, app, pod, level, ts, LEFT(body_text, 300) AS snippet FROM raw_events WHERE body_text LIKE %s ORDER BY ts DESC LIMIT %s", (like, k))
                return cur.fetchall()

    def get_workspaces(self):
        """Get all workspaces"""
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("SELECT * FROM workspaces ORDER BY name")
                workspaces = cur.fetchall()
                # Convert BIGINT IDs to strings to preserve precision
                for workspace in workspaces:
                    workspace['id'] = str(workspace['id'])
                return workspaces

    def get_workspace_clusters(self, workspace_name):
        """Get clusters in a workspace"""
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("SELECT clusters FROM workspaces WHERE name=%s", (workspace_name,))
                result = cur.fetchone()
                if result and result['clusters']:
                    import json
                    clusters = json.loads(result['clusters'])
                    return {'workspace': workspace_name, 'clusters': clusters}
                return {'workspace': workspace_name, 'clusters': []}

    def get_cluster_health(self, cluster_name, workspace):
        """Get cluster health status"""
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    "SELECT * FROM cluster_health WHERE cluster_name=%s AND workspace=%s ORDER BY last_check DESC", 
                    (cluster_name, workspace)
                )
                health_data = cur.fetchall()
                
                # Calculate overall status
                if not health_data:
                    overall_status = 'unknown'
                else:
                    statuses = [h['status'] for h in health_data]
                    if 'critical' in statuses:
                        overall_status = 'critical'
                    elif 'warning' in statuses:
                        overall_status = 'warning'
                    else:
                        overall_status = 'healthy'
                
                return {
                    'cluster_name': cluster_name,
                    'workspace': workspace,
                    'overall_status': overall_status,
                    'components': health_data,
                    'last_check': health_data[0]['last_check'] if health_data else None
                }

    def get_recent_incidents(self, workspace, limit):
        """Get recent incidents"""
        with self._conn() as c:
            with c.cursor() as cur:
                if workspace:
                    cur.execute(
                        "SELECT * FROM incidents WHERE workspace=%s ORDER BY created_at DESC LIMIT %s", 
                        (workspace, limit)
                    )
                else:
                    cur.execute("SELECT * FROM incidents ORDER BY created_at DESC LIMIT %s", (limit,))
                return cur.fetchall()

    def get_mttr_stats(self, workspace=None):
        """Get MTTR statistics"""
        with self._conn() as c:
            with c.cursor() as cur:
                if workspace:
                    cur.execute(
                        "SELECT * FROM mttr_stats WHERE workspace=%s ORDER BY calculated_at DESC LIMIT 1", 
                        (workspace,)
                    )
                else:
                    cur.execute("SELECT * FROM mttr_stats ORDER BY workspace, calculated_at DESC")
                return cur.fetchall()

    def create_workspace(self, name, description, clusters):
        """Create a new workspace"""
        import json
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    "INSERT INTO workspaces (name, description, clusters, created_at) VALUES (%s, %s, %s, NOW())",
                    (name, description, json.dumps(clusters))
                )
                c.commit()
                workspace_id = cur.lastrowid
                
                # Return the created workspace
                cur.execute("SELECT * FROM workspaces WHERE id = %s", (workspace_id,))
                workspace = cur.fetchone()
                # Convert BIGINT ID to string to preserve precision
                if workspace:
                    workspace['id'] = str(workspace['id'])
                return workspace

    def delete_workspace(self, workspace_id):
        """Delete a workspace"""
        with self._conn() as c:
            with c.cursor() as cur:
                # Convert to int for database query but keep original string for response
                cur.execute("DELETE FROM workspaces WHERE id = %s", (int(workspace_id),))
                c.commit()
                return {"deleted": cur.rowcount > 0, "workspace_id": workspace_id}

    # ===============================
    # CLUSTER MANAGEMENT METHODS
    # ===============================
    
    def save_enroll_token(self, token, workspace, expires_at):
        """Save enrollment token for agent registration"""
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("""
                  CREATE TABLE IF NOT EXISTS enroll_tokens(
                    id BIGINT AUTO_RANDOM PRIMARY KEY,
                    token VARCHAR(255) UNIQUE,
                    workspace VARCHAR(255),
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                  )""")
                cur.execute("INSERT INTO enroll_tokens(token,workspace,expires_at) VALUES(%s,%s,%s)",
                            (token, workspace, expires_at))
                c.commit()
                logger.debug(f"Saved enrollment token for workspace {workspace}")

    def get_enroll_token(self, token):
        """Retrieve enrollment token data"""
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("SELECT token, workspace, expires_at FROM enroll_tokens WHERE token=%s", (token,))
                row = cur.fetchone()
                return row

    def upsert_cluster(self, name, workspace, mode, namespaces, kube_ref=None):
        """Insert or update cluster record"""
        with self._conn() as c:
            with c.cursor() as cur:
                # Create table if not exists
                cur.execute("""
                  CREATE TABLE IF NOT EXISTS clusters(
                    id BIGINT AUTO_RANDOM PRIMARY KEY,
                    name VARCHAR(255),
                    workspace VARCHAR(255),
                    mode ENUM('agent','kubeconfig'),
                    kube_secret_ref VARCHAR(255),
                    namespaces JSON,
                    status ENUM('connected','error','unknown') DEFAULT 'unknown',
                    last_sync TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE KEY uniq_cluster (name, workspace)
                  )""")
                
                # Upsert cluster
                cur.execute("""
                  INSERT INTO clusters(name,workspace,mode,kube_secret_ref,namespaces,status)
                  VALUES(%s,%s,%s,%s,%s,'unknown')
                  ON DUPLICATE KEY UPDATE 
                    kube_secret_ref=VALUES(kube_secret_ref), 
                    namespaces=VALUES(namespaces),
                    mode=VALUES(mode)
                """, (name, workspace, mode, kube_ref, json.dumps(namespaces)))
                c.commit()
                logger.info(f"Upserted cluster {name} in workspace {workspace}")

    def list_clusters(self):
        """List all registered clusters"""
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("""SELECT id,name,workspace,mode,kube_secret_ref,namespaces,status,last_sync,created_at 
                             FROM clusters ORDER BY workspace,name""")
                rows = cur.fetchall()
                
                # Parse JSON namespaces and convert IDs to strings
                for r in rows:
                    if isinstance(r.get("namespaces"), str):
                        try: 
                            r["namespaces"] = json.loads(r["namespaces"])
                        except: 
                            r["namespaces"] = []
                    r["id"] = str(r["id"]) if r["id"] else None
                return rows

    def create_kubeconfig_secret_ref(self, workspace, name, kubeconfig_yaml):
        """Create a Kubernetes secret for kubeconfig and return reference"""
        secret_name = f"kubeconfig-{workspace}-{name}".lower().replace("_", "-")
        return create_or_replace_secret(secret_name, kubeconfig_yaml)

    def store_cluster_health(self, cluster_name, workspace, health):
        """Store cluster health data"""
        with self._conn() as c:
            with c.cursor() as cur:
                # Ensure cluster_health table exists
                cur.execute("""
                  CREATE TABLE IF NOT EXISTS cluster_health(
                    id BIGINT AUTO_RANDOM PRIMARY KEY,
                    cluster_name VARCHAR(255),
                    workspace VARCHAR(255),
                    component VARCHAR(255),
                    component_type VARCHAR(255),
                    status ENUM('healthy','warning','critical'),
                    details JSON,
                    last_check TIMESTAMP DEFAULT NOW()
                  )""")
                
                # Clear existing health data for this cluster
                cur.execute("DELETE FROM cluster_health WHERE cluster_name=%s AND workspace=%s", 
                           (cluster_name, workspace))
                
                # Insert fresh health data
                components = health.get("components", [])
                for comp in components:
                    cur.execute("""
                      INSERT INTO cluster_health(cluster_name,workspace,component,component_type,status,details,last_check)
                      VALUES(%s,%s,%s,%s,%s,%s,NOW())
                    """, (
                        cluster_name, workspace, 
                        comp.get("name", "unknown"), 
                        comp.get("type", ""), 
                        comp.get("status", "healthy"), 
                        json.dumps(comp.get("details", {}))
                    ))
                
                c.commit()
                logger.debug(f"Stored health data for {cluster_name} ({len(components)} components)")

    def mark_cluster_sync(self, name, workspace, status):
        """Update cluster sync status and timestamp"""
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("""UPDATE clusters SET status=%s, last_sync=NOW() 
                             WHERE name=%s AND workspace=%s""", (status, name, workspace))
                c.commit()
                logger.debug(f"Marked cluster {name} as {status}")

    def list_kubeconfig_clusters(self):
        """List clusters using kubeconfig mode (for poller)"""
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("""SELECT name,workspace,kube_secret_ref,namespaces 
                             FROM clusters WHERE mode='kubeconfig' AND kube_secret_ref IS NOT NULL""")
                rows = cur.fetchall()
                
                # Parse JSON namespaces
                for r in rows:
                    if isinstance(r.get("namespaces"), str):
                        try: 
                            r["namespaces"] = json.loads(r["namespaces"])
                        except: 
                            r["namespaces"] = []
                            
                return rows
                
    def cleanup_expired_tokens(self):
        """Remove expired enrollment tokens"""
        with self._conn() as c:
            with c.cursor() as cur:
                cur.execute("DELETE FROM enroll_tokens WHERE expires_at < NOW()")
                deleted = cur.rowcount
                c.commit()
                if deleted > 0:
                    logger.info(f"Cleaned up {deleted} expired enrollment tokens")
                return deleted