#!/usr/bin/env bash
set -euo pipefail
cat <<'MSG'
This removes the Kubernetes workloads from the VM, but DOES NOT delete the Oracle VM.
Persistent local-path data is deleted when the namespaces/PVCs are deleted.
Press Ctrl+C now if you want to keep the data.
MSG
sleep 8
kubectl delete namespace three-s --ignore-not-found
kubectl delete namespace elastic --ignore-not-found
kubectl delete clusterrolebinding three-s-filebeat --ignore-not-found
kubectl delete clusterrole three-s-filebeat --ignore-not-found
