-- db/schema.sql
CREATE TABLE IF NOT EXISTS raw_events (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  cluster VARCHAR(64),
  namespace VARCHAR(128),
  app VARCHAR(128),
  pod VARCHAR(128),
  type ENUM('log','metric','trace') NOT NULL,
  ts TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
  level VARCHAR(16),
  body_json JSON,
  body_text TEXT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events_embeddings (
  event_id BIGINT PRIMARY KEY,
  embedding VARBINARY(6144) -- store as bytes; app handles to/from float list
);

CREATE TABLE IF NOT EXISTS runbooks (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  service VARCHAR(128),
  title VARCHAR(255),
  body TEXT,
  tags JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incidents (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('open','mitigating','resolved') DEFAULT 'open',
  title VARCHAR(255),
  suspect VARCHAR(255),
  cluster VARCHAR(64),
  namespace VARCHAR(128),
  app VARCHAR(128),
  workspace VARCHAR(64),
  summary TEXT,
  resolution TEXT,
  mttr_seconds BIGINT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  name VARCHAR(64) UNIQUE NOT NULL,
  description TEXT,
  clusters JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cluster_health (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  cluster_name VARCHAR(64) NOT NULL,
  workspace VARCHAR(64) NOT NULL,
  component VARCHAR(128) NOT NULL,
  component_type ENUM('pod','node','service','deployment','namespace') NOT NULL,
  status ENUM('healthy','warning','critical','unknown') DEFAULT 'unknown',
  details JSON,
  last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cluster_workspace (cluster_name, workspace),
  INDEX idx_last_check (last_check)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mttr_stats (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  workspace VARCHAR(64) NOT NULL,
  cluster_name VARCHAR(64),
  avg_mttr_seconds BIGINT,
  incident_count INT DEFAULT 0,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace_period (workspace, period_start, period_end)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FT index on runbooks (TiDB supports MPP; emulate FT via inverted index on ngrams using TiDB parser or use external FTS like TiDB fulltext experimental)
-- For hackathon: simple LIKE + tag match + vector similarity over embeddings of titles.