-- Insert workspace data for TiM8
INSERT IGNORE INTO workspaces (id, name, description, clusters, created_at) VALUES 
(1, 'TiM8-Local', 'Local development environment for TiM8 incident management', '["incident-copilot"]', NOW()),
(2, 'Dev', 'Development environment for testing new features', '["dev-cluster-1", "dev-cluster-2"]', NOW()),
(3, 'Staging', 'Pre-production staging environment', '["staging-cluster"]', NOW()),
(4, 'Production', 'Production environment for live services', '["prod-east", "prod-west", "prod-central"]', NOW());

-- Create a sample incident for testing
INSERT IGNORE INTO incidents (id, title, cluster, namespace, app, workspace, status, summary, created_at) VALUES 
(1, 'High CPU usage detected', 'incident-copilot', 'incident-copilot', 'agent-detective', 'TiM8-Local', 'open', 'AI Analysis: CPU utilization spike detected on detective agent', NOW());