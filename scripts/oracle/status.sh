#!/usr/bin/env bash
set -euo pipefail

echo "=== node ==="
kubectl get nodes -o wide

echo
echo "=== app pods ==="
kubectl get pods -n three-s -o wide

echo
echo "=== elastic pods ==="
kubectl get pods -n elastic -o wide

echo
echo "=== persistent volumes ==="
kubectl get pvc -A

echo
echo "=== ingress ==="
kubectl get ingress -n three-s

echo
echo "=== traefik ==="
kubectl get svc -n kube-system traefik 2>/dev/null || true
