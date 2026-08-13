#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! sudo k3s ctr images list | grep -q 'three-s-services:oracle-arm64'; then
  echo "Local backend image is missing. Run: bash scripts/oracle/build-import.sh"
  exit 1
fi
if ! sudo k3s ctr images list | grep -q 'three-s-frontend:oracle-arm64'; then
  echo "Local frontend image is missing. Run: bash scripts/oracle/build-import.sh"
  exit 1
fi

echo "Applying namespaces..."
kubectl apply -f ./k8s/00-namespaces.yaml

if kubectl get secret three-s-secrets -n three-s >/dev/null 2>&1; then
  echo "JWT secret already exists; keeping it."
else
  JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-')"
  kubectl create secret generic three-s-secrets -n three-s --from-literal="jwt-secret=$JWT_SECRET"
fi

echo "Deploying Elasticsearch, Logstash and Kibana..."
kubectl apply -f ./k8s/10-elastic.yaml

echo "Deploying Filebeat..."
kubectl apply -f ./k8s/20-filebeat.yaml

echo "Deploying application microservices and frontend..."
kubectl apply -f ./k8s/30-app.yaml

echo "Deploying public Traefik ingress..."
kubectl apply -f ./k8s/40-ingress.yaml

echo
cat <<'MSG'
Deployment submitted.

Watch everything:
  kubectl get pods -A -w

Quick status:
  bash scripts/oracle/status.sh

When pods are ready, use the OCI VM public IP:
  http://PUBLIC_IP/
  http://PUBLIC_IP/kibana/
  http://PUBLIC_IP/api/observability/events?limit=20
MSG
