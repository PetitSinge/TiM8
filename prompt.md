# Prompt pour Claude Code - Projet TiM8 (Incident Co-Pilot)

## 🎯 Contexte Général

Tu travailles sur **TiM8** (anciennement Tmate), un système multi-agent de gestion d'incidents DevOps pour Kubernetes. Le projet est une evolution d'un hackathon avec TiDB pour créer un Incident Co-Pilot intelligent.

## 🏗️ Architecture du Système

### Vue d'ensemble
```
[Kubernetes Clusters] → [Agent-Collector] → [TiDB Serverless] → [Gateway API] → [React UI]
                                                ↕
                                    [Multi-Agent LLM System]
```

### Services Déployés
- **gateway** : Point d'entrée principal (FastAPI) - Port 8000
- **agent-detective** : Analyse des incidents et causes racines
- **agent-context** : Construction du contexte enrichi 
- **agent-runbook** : Recommandations basées sur l'historique
- **agent-remediator** : Propositions de remédiation
- **agent-reporter** : Notifications Slack/Jira
- **agent-collector** : Collecte la santé des clusters Kubernetes
- **ingestion** : Ingestion des logs/métriques
- **ui** : Interface React/Next.js - Port 3000

## 🗄️ Base de Données TiDB

### Connexion
- **Host** : gateway01.us-west-2.prod.aws.tidbcloud.com
- **Port** : 4000
- **User** : 3swokQ49Dnp9GJH.root
- **Password** : 9yg6NmWmOAzf7OhX
- **Database** : test
- **SSL** : /etc/ssl/cert.pem

### Tables Principales
```sql
-- Workspaces personnalisés de l'utilisateur
CREATE TABLE workspaces (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  clusters JSON,  -- Liste des clusters assignés
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Santé des clusters en temps réel
CREATE TABLE cluster_health (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  cluster_name VARCHAR(255),
  workspace VARCHAR(255),
  component VARCHAR(255),
  component_type VARCHAR(255),
  status ENUM('healthy', 'warning', 'critical'),
  details JSON,
  last_check TIMESTAMP
);

-- Incidents 
CREATE TABLE incidents (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  title VARCHAR(255),
  cluster VARCHAR(255),
  namespace VARCHAR(255), 
  app VARCHAR(255),
  workspace VARCHAR(255),
  status ENUM('open', 'mitigating', 'resolved'),
  suspect TEXT,
  summary TEXT,
  resolution TEXT,
  mttr_seconds INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 État Actuel du Projet

### ✅ Ce qui fonctionne
1. **Tous les microservices sont déployés** dans le namespace `incident-copilot`
2. **TiDB est connecté** avec de vraies données
3. **Agent-collector monitore le cluster** Kubernetes et stocke la santé dans TiDB
4. **Les agents LLM sont enrichis** avec les données historiques TiDB
5. **L'interface UI a 4 pages complètes** :
   - Dashboard (page principale)
   - TiM8 (vue détaillée cluster incident-copilot)
   - Clusters (vue par workspace)  
   - Incidents (gestion complète du cycle de vie)
   - Chaos Engineering (tests de résilience)
   - Settings (webhooks Slack/Jira/GitLab)
   - Workspaces (gestion des workspaces)

### 🔧 Problème Actuel à Résoudre
**INTERFACE DE GESTION DES WORKSPACES NE FONCTIONNE PAS**

L'utilisateur veut une interface simple pour :
- **Créer des workspaces** avec des noms personnalisés (ex: "Boubou", "MonProjet")
- **Juste nom + description** (pas besoin de lister les clusters à la création)
- **Assigner les clusters plus tard** via l'interface

### 🐛 Bugs Identifiés
1. **Routes API Next.js** : Étaient statiques au lieu de dynamiques → **RÉSOLU** avec `export const dynamic = 'force-dynamic'`
2. **Problème de précision JavaScript** : Les IDs TiDB (BIGINT) perdent de la précision en JavaScript → Traiter comme strings
3. **Interface React** : Les boutons création/suppression ne fonctionnent pas correctement

## 📁 Structure des Fichiers UI

```
ui/
├── app/
│   ├── layout.tsx                    # Navigation principale
│   ├── page.tsx                      # Dashboard
│   ├── tim8/page.tsx                 # Vue cluster incident-copilot
│   ├── clusters/page.tsx             # Vue par workspace
│   ├── incidents/page.tsx            # Gestion incidents
│   ├── chaos/page.tsx               # Chaos Engineering
│   ├── settings/page.tsx            # Webhooks
│   ├── workspaces/page.tsx          # ❌ Interface buggée
│   ├── workspaces-simple/page.tsx   # ✅ Interface de test simple
│   └── api/                         # Routes API Next.js
│       ├── workspaces/
│       │   ├── route.ts            # GET workspaces (✅ fonctionne)
│       │   ├── create/route.ts     # POST création (⚠️ problème)
│       │   └── [id]/route.ts       # DELETE suppression (⚠️ problème)
│       ├── cluster/[cluster]/health/route.ts
│       └── incidents/recent/route.ts
```

## 🔄 Flux de Données

### Création de workspace
1. **UI React** → `POST /api/workspaces/create` 
2. **Next.js API** → `POST http://gateway.incident-copilot.svc.cluster.local:8000/api/workspaces`
3. **Gateway** → Appelle `tidb.create_workspace()`
4. **TiDB** → INSERT dans table workspaces

### Architecture réseau
- **UI (port 3000)** ↔ **Gateway (port 8000)** via service DNS Kubernetes
- **Gateway** ↔ **TiDB Serverless** via connexion SSL
- **Agent-collector** surveille le cluster et met à jour `cluster_health`

## 🛠️ Environnement Technique

- **Kubernetes** : cluster local (kind/k3d/minikube)
- **Namespace** : `incident-copilot`
- **Images Docker** : Hub `petitsinge/incident-copilot-*:latest`
- **Base de données** : TiDB Serverless (hébergé)
- **LLM** : OpenAI GPT-4 pour les agents

## 🎯 Objectif Immédiat

**Faire fonctionner la création/suppression de workspaces dans l'UI**

L'utilisateur doit pouvoir :
1. Aller sur "🏗️ Workspaces" ou "🔧 Test Workspaces"
2. Créer un workspace "Boubou" avec description
3. Le voir apparaître dans la liste
4. Pouvoir le supprimer

## 🔍 Debug Actuel

- ✅ **Backend Gateway** : Fonctionne (testé avec curl)
- ✅ **TiDB** : Les données sont stockées correctement
- ✅ **Routes API Next.js** : Sont maintenant dynamiques
- ❌ **Interface React** : Les boutons ne déclenchent pas d'appels API

## 📚 Context Technique Important

- **Tous les pods** sont en état "Running"
- **Les logs UI/Gateway** montrent les appels API quand ça fonctionne
- **Le problème n'est pas réseau** (wget depuis pods fonctionne)
- **Une interface de test simple** a été créée à `/workspaces-simple`

## 💡 Prochaines Étapes Suggérées

1. **Débugger l'interface React** - Pourquoi les événements onClick ne fonctionnent pas ?
2. **Vérifier les types TypeScript** - Problème de précision des BIGINT IDs ?
3. **Tester avec l'interface simple** - `/workspaces-simple` pour isoler le problème
4. **Implémenter l'assignation de clusters** une fois la création/suppression fixée

## 🚨 Points d'Attention

- **TOUJOURS traiter les IDs comme des strings** (pas des numbers)
- **Utiliser `export const dynamic = 'force-dynamic'`** pour les routes API
- **Tester via l'interface simple** avant de complexifier
- **Les logs sont tes amis** - `kubectl logs deployment/ui -n incident-copilot --follow`

---

## 🎪 Notes de Démo

Ce projet était originellement un hackathon TiDB pour créer un Incident Co-Pilot. L'objectif est de démontrer :
- Multi-agent LLM pour l'analyse d'incidents
- Ingestion temps réel dans TiDB
- Interface moderne React
- Architecture Kubernetes native

L'utilisateur veut maintenant une interface workspace simple et fonctionnelle pour organiser ses clusters par projets personnalisés.