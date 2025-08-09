-- db/seed_runbooks.sql
-- Seed runbooks
INSERT INTO runbooks(service, title, body, tags) VALUES
('orders-api', 'CrashLoopBackOff / OOMKill',
 'Symptoms: pods restarting, OOMKilled events.\nChecks: kubectl get events; describe pod.\nFix: increase memory limit; optimize memory usage; scale out.',
 JSON_ARRAY('kubernetes','oom','crashloop')),
('payments-api', 'High Latency',
 'Symptoms: p95 > 2s.\nChecks: DB connections saturation.\nFix: increase connection pool; add cache; scale DB read replicas.',
 JSON_ARRAY('latency','db','apm')),
('oom-demo', 'Memory Pressure Troubleshooting',
 'Symptoms: OOMKilled events, pods restarting frequently.\nChecks: kubectl top pods; kubectl describe pod; check memory limits vs usage.\nFix: increase memory limits; optimize application memory usage; implement proper memory profiling.',
 JSON_ARRAY('kubernetes','oom','memory','troubleshooting')),
('generic', 'Pod Restart Loop',
 'Symptoms: pods constantly restarting, CrashLoopBackOff status.\nChecks: kubectl logs; kubectl get events; check liveness/readiness probes.\nFix: review startup time; adjust probe timeouts; check application initialization.',
 JSON_ARRAY('kubernetes','restart','crashloop','probes'));

-- Seed workspaces
INSERT INTO workspaces(name, description, clusters) VALUES
('TiM8-Local', 'Local TiM8 cluster where the solution is installed', JSON_ARRAY('incident-copilot')),
('Dev', 'Development environment clusters', JSON_ARRAY('dev-cluster-01')),
('Staging', 'Staging/PreProd environment clusters', JSON_ARRAY('staging-cluster-01')),
('Production', 'Production environment clusters', JSON_ARRAY('prod-cluster-01', 'prod-cluster-02'));

-- Seed initial cluster health for TiM8
INSERT INTO cluster_health(cluster_name, workspace, component, component_type, status, details) VALUES
('incident-copilot', 'TiM8-Local', 'kube-system', 'namespace', 'healthy', JSON_OBJECT('pods_ready', 12, 'pods_total', 12)),
('incident-copilot', 'TiM8-Local', 'incident-copilot', 'namespace', 'healthy', JSON_OBJECT('pods_ready', 8, 'pods_total', 8)),
('incident-copilot', 'TiM8-Local', 'gateway', 'deployment', 'healthy', JSON_OBJECT('replicas_ready', 1, 'replicas_desired', 1)),
('incident-copilot', 'TiM8-Local', 'ingestion', 'deployment', 'healthy', JSON_OBJECT('replicas_ready', 1, 'replicas_desired', 1));

-- Seed initial MTTR stats
INSERT INTO mttr_stats(workspace, cluster_name, avg_mttr_seconds, incident_count, period_start, period_end) VALUES
('TiM8-Local', 'incident-copilot', 900, 0, DATE_SUB(NOW(), INTERVAL 7 DAY), NOW()),
('Dev', 'dev-cluster-01', 1800, 2, DATE_SUB(NOW(), INTERVAL 7 DAY), NOW()),
('Production', 'prod-cluster-01', 600, 1, DATE_SUB(NOW(), INTERVAL 7 DAY), NOW());