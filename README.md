# DevOps Incident Co‑Pilot – Architecture & Code (TiDB AgentX 2025)

> **Goal**: Multi‑agent Incident Co‑Pilot for Kubernetes that ingests real logs/metrics/traces, stores + searches in **TiDB Serverless** (tables + vector index), reasons with an LLM, proposes/remediates actions, and learns from resolved incidents. Ready‑to‑demo with an **OOM** scenario.

---

## 0) Quickstart (TL;DR)

1. **Provision** TiDB Serverless (free tier) and note `TIDB_HOST, TIDB_PORT, TIDB_USER, TIDB_PASSWORD, TIDB_DB`.
2. **Create OpenAI API key** `OPENAI_API_KEY`.
3. **Setup database**:
   ```bash
   mysql -h $TIDB_HOST -P $TIDB_PORT -u $TIDB_USER -p$TIDB_PASSWORD $TIDB_DB < db/schema.sql
   mysql -h $TIDB_HOST -P $TIDB_PORT -u $TIDB_USER -p$TIDB_PASSWORD $TIDB_DB < db/seed_runbooks.sql
   ```
4. **Create secret**:
   ```bash
   kubectl -n incident-copilot create secret generic copilot-secrets \
     --from-literal=OPENAI_API_KEY=sk-... \
     --from-literal=TIDB_HOST=... \
     --from-literal=TIDB_USER=... \
     --from-literal=TIDB_PASSWORD=... \
     --from-literal=TIDB_DB=incidentdb
   ```
5. **Bootstrap cluster** (minikube / k3d OK):
   ```bash
   kubectl apply -k deploy/overlays/minikube
   # wait pods READY
   kubectl -n incident-copilot get pods -w
   ```
6. **Install demo app** + chaos OOM:
   ```bash
   kubectl apply -f demo/oom-demo.yaml
   kubectl apply -f demo/chaos/oom-toggle-job.yaml
   ```
7. **Open UI** (port-forward or ingress):
   ```bash
   kubectl -n incident-copilot port-forward svc/ui 3000:3000
   # http://localhost:3000
   ```
8. Trigger **Chaos Mode** from the UI, watch the **Incident Room** fill, then apply the suggested **patch** via GitOps PR simulation.

---

## 1) Architecture

### 1.1 Diagram (logical)

```
 [Cluster(s)]                                  [TiDB Cloud]
  ├─ Fluent Bit (logs)  ───────▶  Ingestion API ─┬─ raw_events       (OLTP)
  ├─ OTEL Collector (traces) ─▶                 ├─ events_embeddings (vector)
  └─ Metrics Adapter (optional)                 ├─ runbooks          (FTS)
                                                └─ incidents         (history)

 [Orchestrator API (FastAPI)]
  ├─ Detective Agent      ──┐  FT+Vector search
  ├─ Context Manager      ──┼───────────────────────────▶ TiDB SQL / Graph build
  ├─ Runbook Agent        ──┤  retrieves SOPs
  ├─ Remediator Agent     ──┤  generates patches / commands
  └─ Reporter Agent       ──┘  Jira/Slack actions

 [Next.js UI]
  ├─ Cluster Map / Heatmap
  ├─ Incident Room (timeline + suggestions)
  └─ Search (FT + vector)
```

### 1.2 Services (containers)

* `gateway` (FastAPI): single entrypoint; routes to agents; exposes REST/WebSocket to UI.
* `agent-detective` (FastAPI worker): root cause hypothesis from signals + TiDB search.
* `agent-context` (FastAPI worker): builds enriched context (topology, past similar incidents).
* `agent-runbook` (FastAPI worker): retrieves SOPs from TiDB FT index / Git (optional mirror).
* `agent-remediator` (FastAPI worker): proposes K8s patches/rollbacks/scale; can open Git PR.
* `agent-reporter` (FastAPI worker): Slack/Jira notifications & status updates.
* `ingestion` (FastAPI): receives Fluent Bit/OTEL payloads → TiDB insert + embedding pipeline.
* `ui` (Next.js): web app.

### 1.3 Data model (TiDB)

* `raw_events(id, cluster, namespace, app, pod, type, ts, level, body_json, body_text)`
* `events_embeddings(event_id, embedding VECTOR(1536))` (via OpenAI text-embedding-3-small)
* `runbooks(id, service, title, body, tags, updated_at)` with FT index
* `incidents(id, created_at, status, title, suspect, cluster, namespace, app, summary, resolution, mttr_seconds)`

---

## 2) Repository Layout

```
incident-copilot/
├─ services/
│  ├─ gateway/
│  │  ├─ app.py
│  │  ├─ llm.py
│  │  ├─ tidb.py
│  │  ├─ k8s.py
│  │  ├─ requirements.txt
│  │  └─ Dockerfile
│  ├─ agent-detective/
│  │  ├─ app.py
│  │  ├─ requirements.txt
│  │  └─ Dockerfile
│  ├─ agent-context/
│  │  ├─ app.py
│  │  ├─ requirements.txt
│  │  └─ Dockerfile
│  ├─ agent-runbook/
│  │  ├─ app.py
│  │  ├─ requirements.txt
│  │  └─ Dockerfile
│  ├─ agent-remediator/
│  │  ├─ app.py
│  │  ├─ requirements.txt
│  │  └─ Dockerfile
│  ├─ agent-reporter/
│  │  ├─ app.py
│  │  ├─ requirements.txt
│  │  └─ Dockerfile
│  └─ ingestion/
│     ├─ app.py
│     ├─ requirements.txt
│     └─ Dockerfile
├─ ui/
│  ├─ package.json
│  ├─ next.config.js
│  ├─ app/
│  │  ├─ page.tsx
│  │  ├─ layout.tsx
│  │  └─ api.ts
│  ├─ tsconfig.json
│  └─ Dockerfile
├─ deploy/
│  ├─ base/
│  │  ├─ namespace.yaml
│  │  ├─ secrets.example.yaml
│  │  ├─ configmap.yaml
│  │  ├─ gateway.yaml
│  │  ├─ agent-detective.yaml
│  │  ├─ agent-context.yaml
│  │  ├─ agent-runbook.yaml
│  │  ├─ agent-remediator.yaml
│  │  ├─ agent-reporter.yaml
│  │  ├─ ingestion.yaml
│  │  ├─ ui.yaml
│  │  └─ ingress.yaml
│  └─ overlays/
│     └─ minikube/kustomization.yaml
├─ db/
│  ├─ schema.sql
│  └─ seed_runbooks.sql
├─ demo/
│  ├─ oom-demo.yaml
│  └─ chaos/oom-toggle-job.yaml
├─ fluentbit/
│  └─ fluent-bit-configmap.yaml
├─ README.md
└─ LICENSE
```

---

## 3) Demo Script (≤ 3min)

1. **Open UI** → click **Chaos Mode: Detect OOM** → Incident opens automatically
2. The **summary** populates (Detective/Context/Runbook agents fused via LLM)
3. Click **Propose Remediation** → shows JSON patch with kubectl command
4. Apply the patch command → pods stabilize
5. **Incident** → Resolve (auto when stable, or via button)
6. **MTTR** displayed in seconds

---

## 4) Technical Features

### 4.1 Multi-Agent Architecture
- **Detective Agent**: Analyzes logs and events to identify probable causes
- **Context Agent**: Builds enriched context including topology and historical data
- **Runbook Agent**: Retrieves relevant SOPs and troubleshooting guides
- **Remediator Agent**: Generates Kubernetes patches and remediation commands
- **Reporter Agent**: Handles Slack/Jira notifications

### 4.2 TiDB Integration
- **Real-time ingestion** of logs via Fluent Bit
- **Vector embeddings** for semantic search using OpenAI embeddings
- **Full-text search** on runbooks and incident history
- **OLTP performance** for real-time incident management

### 4.3 Kubernetes Native
- **Complete K8s manifests** with Kustomize overlays
- **RBAC ready** for production deployment
- **Ingress support** for external access
- **Chaos engineering** demo with OOM scenarios

---

## 5) Production Considerations

### 5.1 Security
- All secrets managed via Kubernetes secrets
- No hardcoded credentials in code
- SSL/TLS ready for TiDB connections

### 5.2 Scalability
- Stateless microservices design
- Horizontal pod autoscaling ready
- TiDB handles massive log ingestion

### 5.3 Monitoring
- Health check endpoints on all services
- WebSocket for real-time UI updates
- MTTR tracking and incident metrics

---

## 6) Getting Started

### Prerequisites
- Kubernetes cluster (minikube/k3d/GKE/EKS)
- TiDB Serverless account
- OpenAI API key
- kubectl and kustomize

### Setup Steps
See **Quickstart** section above for detailed setup instructions.

---

## 7) API Endpoints

### Gateway Service
- `POST /incidents` - Create new incident
- `POST /incidents/{id}/remediate` - Get remediation plan
- `POST /incidents/{id}/resolve` - Mark incident as resolved
- `GET /search` - Search events and logs
- `WebSocket /ws` - Real-time incident updates

### Agent Services
Each agent exposes specific endpoints for their functionality:
- Detective: `/hypothesis`
- Context: `/context`
- Runbook: `/suggest`
- Remediator: `/propose`
- Reporter: `/notify`

### Ingestion Service
- `POST /ingest` - Ingest logs from Fluent Bit/OTEL

---

## 8) Contributing

This is a hackathon project showcasing multi-agent incident management with TiDB. The architecture is designed to be:
- **Extensible**: Easy to add new agents
- **Scalable**: Cloud-native design
- **Observable**: Built-in monitoring and metrics

For production use, consider:
- Enhanced error handling and retry logic
- More sophisticated vector search algorithms  
- Advanced chaos engineering scenarios
- Integration with more external tools (PagerDuty, Datadog, etc.)

---

## License

MIT License - see LICENSE file for details.