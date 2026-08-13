#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: bash scripts/oracle/bootstrap.sh PUBLIC_IP"
  echo "Example: bash scripts/oracle/bootstrap.sh 129.151.42.10"
  exit 1
fi

PUBLIC_IP="$1"

echo "[1/5] Updating Ubuntu and installing tools..."
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y curl git docker.io ca-certificates jq
sudo systemctl enable --now docker

echo "[2/5] Checking CPU architecture..."
ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64) echo "ARM64 detected: $ARCH" ;;
  *)
    echo "This package is intended for Oracle Ampere A1 ARM64. Detected: $ARCH"
    exit 1
    ;;
esac

echo "[3/5] Configuring Elasticsearch-friendly kernel setting..."
echo 'vm.max_map_count=262144' | sudo tee /etc/sysctl.d/99-three-s-elasticsearch.conf >/dev/null
sudo sysctl --system >/dev/null

echo "[4/5] Installing K3s..."
if command -v k3s >/dev/null 2>&1; then
  echo "K3s is already installed; skipping install."
else
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server --node-external-ip=${PUBLIC_IP} --write-kubeconfig-mode=644" sh -
fi

sudo systemctl enable --now k3s

echo "[5/5] Waiting for Kubernetes node..."
for i in {1..60}; do
  if kubectl get nodes >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

kubectl get nodes -o wide

echo
cat <<MSG
Bootstrap finished.

Next commands, from the repository root:
  bash scripts/oracle/build-import.sh
  bash scripts/oracle/deploy.sh

Public IP configured in K3s: ${PUBLIC_IP}
Make sure OCI networking allows inbound TCP 80 from the internet and TCP 22 from your IP.
MSG
