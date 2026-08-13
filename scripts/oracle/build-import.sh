#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [ "$(uname -m)" != "aarch64" ] && [ "$(uname -m)" != "arm64" ]; then
  echo "Expected an ARM64 Oracle Ampere A1 VM. Detected: $(uname -m)"
  exit 1
fi

BACKEND_IMAGE="three-s-services:oracle-arm64"
FRONTEND_IMAGE="three-s-frontend:oracle-arm64"
BACKEND_TAR="/tmp/three-s-services.tar"
FRONTEND_TAR="/tmp/three-s-frontend.tar"

echo "Building backend image on ARM64..."
sudo docker build --pull -t "$BACKEND_IMAGE" ./services

echo "Building frontend image on ARM64..."
sudo docker build --pull -t "$FRONTEND_IMAGE" ./frontend

echo "Importing backend image into K3s containerd..."
sudo docker save -o "$BACKEND_TAR" "$BACKEND_IMAGE"
sudo k3s ctr images import "$BACKEND_TAR"

echo "Importing frontend image into K3s containerd..."
sudo docker save -o "$FRONTEND_TAR" "$FRONTEND_IMAGE"
sudo k3s ctr images import "$FRONTEND_TAR"

rm -f "$BACKEND_TAR" "$FRONTEND_TAR"

echo
sudo k3s ctr images list | grep -E 'three-s-(services|frontend)' || true

echo "Images built and imported successfully."
