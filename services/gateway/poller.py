import threading, time, tempfile, os, logging
from .tidb import TiDB
from .k8s_secret import read_secret
from kubernetes import client, config
from datetime import datetime, timedelta

logger = logging.getLogger("tim8.poller")
db = TiDB()

class ClusterPoller:
    def __init__(self):
        self.backoff = {}  # (name, workspace) -> backoff seconds
        self.MAX_BACKOFF = 300  # 5 minutes max backoff
        self.running = False
        self.thread = None
    
    def _load_kube_client_from_config(self, kubeconfig_yaml: str):
        """Load Kubernetes client from kubeconfig YAML"""
        # Write kubeconfig to temp file (K8s client needs file path)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write(kubeconfig_yaml)
            temp_path = f.name
        
        try:
            # Load config from temp file
            config.load_kube_config(config_file=temp_path)
            return client.CoreV1Api()
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):\n                os.unlink(temp_path)
    
    def _poll_cluster_health(self, name, workspace, kubeconfig_yaml, namespaces):
        \"\"\"Poll health data from a single cluster\"\"\"
        logger.debug(f\"Polling cluster {name} in workspace {workspace}\")
        
        try:
            # Load Kubernetes client
            core_api = self._load_kube_client_from_config(kubeconfig_yaml)
            
            components = []
            
            # Check each namespace
            for ns in (namespaces or ['default']):
                try:
                    # List pods in namespace
                    pods = core_api.list_namespaced_pod(ns, _request_timeout=10).items
                    
                    # Analyze pod health
                    unhealthy_pods = []
                    total_pods = len(pods)
                    
                    for pod in pods:
                        pod_healthy = True
                        container_statuses = pod.status.container_statuses or []
                        
                        for cs in container_statuses:
                            if cs.state:
                                # Check for waiting or terminated states
                                if cs.state.waiting or cs.state.terminated:
                                    unhealthy_pods.append({
                                        \"pod\": pod.metadata.name,
                                        \"reason\": (\n                                            cs.state.waiting.reason if cs.state.waiting \n                                            else cs.state.terminated.reason if cs.state.terminated \n                                            else \"Unknown\"\n                                        )\n                                    })
                                    pod_healthy = False
                                    break
                    
                    # Determine component status
                    if not unhealthy_pods:\n                        status = \"healthy\"\n                    elif len(unhealthy_pods) < total_pods / 2:  # Less than 50% unhealthy\n                        status = \"warning\"\n                    else:\n                        status = \"critical\"\n                    \n                    components.append({\n                        \"name\": f\"pods@{ns}\",\n                        \"type\": \"workload\",\n                        \"status\": status,\n                        \"details\": {\n                            \"total_pods\": total_pods,\n                            \"unhealthy_pods\": unhealthy_pods[:5],  # Limit to first 5\n                            \"unhealthy_count\": len(unhealthy_pods)\n                        }\n                    })\n                    \n                except Exception as ns_error:\n                    logger.warning(f\"Failed to check namespace {ns} in {name}: {ns_error}\")\n                    components.append({\n                        \"name\": f\"pods@{ns}\",\n                        \"type\": \"workload\",\n                        \"status\": \"critical\",\n                        \"details\": {\n                            \"error\": str(ns_error),\n                            \"namespace\": ns\n                        }\n                    })\n            \n            # Try to get node info (may fail due to RBAC, that's ok)\n            try:\n                nodes = core_api.list_node(_request_timeout=10).items\n                ready_nodes = sum(1 for node in nodes \n                                if any(condition.type == \"Ready\" and condition.status == \"True\" \n                                      for condition in (node.status.conditions or [])))\n                \n                components.append({\n                    \"name\": \"nodes\",\n                    \"type\": \"infrastructure\",\n                    \"status\": \"healthy\" if ready_nodes == len(nodes) else \"warning\",\n                    \"details\": {\n                        \"total_nodes\": len(nodes),\n                        \"ready_nodes\": ready_nodes\n                    }\n                })\n            except Exception:\n                # Node access not available (RBAC), skip silently\n                pass\n            \n            # Store health data\n            health_data = {\"components\": components}\n            db.store_cluster_health(name, workspace, health_data)\n            db.mark_cluster_sync(name, workspace, \"connected\")\n            \n            logger.debug(f\"Successfully polled {name}: {len(components)} components\")\n            \n        except Exception as e:\n            logger.error(f\"Failed to poll cluster {name}: {e}\")\n            db.mark_cluster_sync(name, workspace, \"error\")\n            raise\n    \n    def _poll_loop(self):\n        \"\"\"Main polling loop with exponential backoff\"\"\"\n        logger.info(\"Starting cluster poller loop\")\n        \n        while self.running:\n            try:\n                # Get all kubeconfig clusters\n                clusters = db.list_kubeconfig_clusters()\n                logger.debug(f\"Found {len(clusters)} kubeconfig clusters to poll\")\n                \n                for cluster in clusters:\n                    if not self.running:  # Check if we should stop\n                        break\n                        \n                    key = (cluster[\"name\"], cluster[\"workspace\"])\n                    \n                    # Check backoff\n                    backoff_time = self.backoff.get(key, 0)\n                    if backoff_time > 0:\n                        self.backoff[key] = max(0, backoff_time - 5)  # Decrease backoff\n                        continue\n                    \n                    try:\n                        # Read kubeconfig from secret\n                        kubeconfig_yaml = read_secret(cluster[\"kube_secret_ref\"])\n                        \n                        # Poll the cluster\n                        self._poll_cluster_health(\n                            cluster[\"name\"], \n                            cluster[\"workspace\"], \n                            kubeconfig_yaml,\n                            cluster[\"namespaces\"]\n                        )\n                        \n                        # Reset backoff on success\n                        self.backoff[key] = 0\n                        \n                    except Exception as e:\n                        logger.error(f\"Poll error for {key}: {e}\")\n                        db.mark_cluster_sync(cluster[\"name\"], cluster[\"workspace\"], \"error\")\n                        \n                        # Exponential backoff\n                        current_backoff = self.backoff.get(key, 5)\n                        self.backoff[key] = min(self.MAX_BACKOFF, current_backoff * 2)\n                        logger.debug(f\"Set backoff for {key} to {self.backoff[key]}s\")\n                \n                # Clean up expired tokens periodically\n                try:\n                    db.cleanup_expired_tokens()\n                except Exception as e:\n                    logger.warning(f\"Failed to cleanup expired tokens: {e}\")\n                \n            except Exception as e:\n                logger.error(f\"Error in polling loop: {e}\")\n            \n            # Sleep between poll cycles\n            for _ in range(10):  # Sleep 5 seconds total, checking every 0.5s if we should stop\n                if not self.running:\n                    break\n                time.sleep(0.5)\n        \n        logger.info(\"Poller loop stopped\")\n    \n    def start(self):\n        \"\"\"Start the polling thread\"\"\"\n        if self.running:\n            logger.warning(\"Poller already running\")\n            return\n        \n        self.running = True\n        self.thread = threading.Thread(target=self._poll_loop, daemon=True, name=\"ClusterPoller\")\n        self.thread.start()\n        logger.info(\"Cluster poller started\")\n    \n    def stop(self):\n        \"\"\"Stop the polling thread\"\"\"\n        if not self.running:\n            return\n        \n        logger.info(\"Stopping cluster poller...\")\n        self.running = False\n        \n        if self.thread and self.thread.is_alive():\n            self.thread.join(timeout=10)\n            if self.thread.is_alive():\n                logger.warning(\"Poller thread did not stop gracefully\")\n        \n        logger.info(\"Cluster poller stopped\")\n\n# Global poller instance\n_poller = None\n\ndef start_poller():\n    \"\"\"Start the global cluster poller\"\"\"\n    global _poller\n    if _poller is None:\n        _poller = ClusterPoller()\n    _poller.start()\n\ndef stop_poller():\n    \"\"\"Stop the global cluster poller\"\"\"\n    global _poller\n    if _poller:\n        _poller.stop()\n\ndef get_poller_status():\n    \"\"\"Get poller status info\"\"\"\n    global _poller\n    if _poller and _poller.running:\n        return {\n            \"running\": True,\n            \"backoff_clusters\": len([k for k, v in _poller.backoff.items() if v > 0]),\n            \"total_backoff_time\": sum(_poller.backoff.values())\n        }\n    return {\"running\": False}