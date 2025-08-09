#!/bin/bash

set -e

REGISTRY="docker.io/petitsinge"
SERVICES=("gateway" "agent-detective" "agent-context" "agent-runbook" "agent-remediator" "agent-reporter" "ingestion" "ui")

# Utilise le builder par défaut pour éviter les problèmes de certificat
docker buildx use default

for SERVICE in "${SERVICES[@]}"; do
  echo "🔨 Building & pushing $SERVICE..."
  
  if [ "$SERVICE" == "ui" ]; then
    SERVICE_DIR="./ui"
  else
    SERVICE_DIR="./services/$SERVICE"
  fi
  
  docker buildx build \
    --platform linux/amd64 \
    --tag $REGISTRY/incident-copilot-$SERVICE:latest \
    --push \
    $SERVICE_DIR
done

echo "✅ All images built for linux/amd64 and pushed to $REGISTRY"