from kubernetes import client, config
import base64, logging

logger = logging.getLogger("tim8.k8s_secret")

# Initialize K8s client
try:
    config.load_incluster_config()
    logger.info("Loaded in-cluster Kubernetes config")
except Exception:
    try:
        config.load_kube_config()
        logger.info("Loaded local kubeconfig")
    except Exception as e:
        logger.error(f"Failed to load Kubernetes config: {e}")
        raise

core = client.CoreV1Api()
NS = "incident-copilot"

def create_or_replace_secret(name: str, kubeconfig_yaml: str, namespace: str = NS) -> str:
    """
    Create or replace a Kubernetes secret containing kubeconfig data
    Returns: namespace/name reference
    """
    try:
        # Encode kubeconfig as base64
        data = {"kubeconfig": base64.b64encode(kubeconfig_yaml.encode()).decode()}
        
        # Create secret object
        sec = client.V1Secret(
            metadata=client.V1ObjectMeta(
                name=name, 
                namespace=namespace,
                labels={"managed-by": "tim8", "type": "kubeconfig"}
            ),
            type="Opaque",
            data=data
        )
        
        # Try to create, fallback to replace if exists
        try:
            core.create_namespaced_secret(namespace, sec)
            logger.info(f"Created secret {namespace}/{name}")
        except Exception as create_error:
            if "already exists" in str(create_error).lower():
                core.replace_namespaced_secret(name, namespace, sec)
                logger.info(f"Replaced existing secret {namespace}/{name}")
            else:
                raise create_error
        
        return f"{namespace}/{name}"
        
    except Exception as e:
        logger.error(f"Failed to create/replace secret {namespace}/{name}: {e}")
        raise

def read_secret(ref: str) -> str:
    """
    Read kubeconfig data from a Kubernetes secret
    Args: ref in format "namespace/name"
    Returns: kubeconfig YAML content
    """
    try:
        ns, name = ref.split("/")
        
        # Read the secret
        s = core.read_namespaced_secret(name, ns)
        
        if "kubeconfig" not in s.data:
            raise ValueError(f"Secret {ref} does not contain kubeconfig data")
        
        # Decode base64 data
        kubeconfig_yaml = base64.b64decode(s.data["kubeconfig"]).decode()
        
        logger.debug(f"Successfully read secret {ref}")
        return kubeconfig_yaml
        
    except Exception as e:
        logger.error(f"Failed to read secret {ref}: {e}")
        raise

def delete_secret(ref: str) -> bool:
    """
    Delete a Kubernetes secret
    Args: ref in format "namespace/name"
    Returns: True if deleted, False if not found
    """
    try:
        ns, name = ref.split("/")
        
        core.delete_namespaced_secret(name, ns)
        logger.info(f"Deleted secret {ref}")
        return True
        
    except client.ApiException as e:
        if e.status == 404:
            logger.warning(f"Secret {ref} not found")
            return False
        else:
            logger.error(f"Failed to delete secret {ref}: {e}")
            raise
    except Exception as e:
        logger.error(f"Failed to delete secret {ref}: {e}")
        raise

def list_tim8_secrets() -> list[dict]:
    """
    List all TiM8-managed kubeconfig secrets
    Returns: List of {name, namespace, created_at} dicts
    """
    try:
        secrets = core.list_namespaced_secret(
            NS, 
            label_selector="managed-by=tim8,type=kubeconfig"
        )
        
        result = []
        for secret in secrets.items:
            result.append({
                "name": secret.metadata.name,
                "namespace": secret.metadata.namespace,
                "created_at": secret.metadata.creation_timestamp.isoformat() if secret.metadata.creation_timestamp else None
            })
        
        logger.debug(f"Found {len(result)} TiM8 kubeconfig secrets")
        return result
        
    except Exception as e:
        logger.error(f"Failed to list TiM8 secrets: {e}")
        raise