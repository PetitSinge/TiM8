import os
from kubernetes import client, config

class K8s:
    def __init__(self):
        try:
            config.load_incluster_config()
        except Exception:
            config.load_kube_config()
        self.core = client.CoreV1Api()
        self.apps = client.AppsV1Api()