#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

bash scripts/oracle/build-import.sh
kubectl apply -f ./k8s/00-namespaces.yaml
kubectl apply -f ./k8s/10-elastic.yaml
kubectl apply -f ./k8s/20-filebeat.yaml
kubectl apply -f ./k8s/30-app.yaml
kubectl apply -f ./k8s/40-ingress.yaml

for deployment in auth content commerce files observability gateway frontend; do
  kubectl rollout restart deployment/$deployment -n three-s
done

kubectl rollout status deployment/gateway -n three-s --timeout=180s || true
kubectl rollout status deployment/frontend -n three-s --timeout=180s || true

echo "Update submitted. Run: bash scripts/oracle/status.sh"
