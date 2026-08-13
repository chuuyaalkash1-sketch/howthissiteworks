# Architecture — Oracle Free Tier + K3s

## public request path

```text
Brother / any browser
        |
        | HTTP :80
        v
Oracle VM public IPv4
        |
        v
K3s ServiceLB + Traefik Ingress
        |
        v
three-s/frontend Service
        |
        v
Nginx in frontend Pod
   |               |
   | /api/*        | /kibana/*
   v               v
gateway:8000    kibana.elastic:5601
   |
   +--> auth:8000
   +--> content:8000
   +--> commerce:8000
   +--> files:8000
   +--> observability:8000
```

## telemetry/log path

```text
React SPA
  |
  | POST /api/observability/events
  v
Nginx
  v
Gateway
  v
Observability collector
  |
  +--> collector memory (fresh events visible immediately)
  |
  +--> stdout JSON
          |
          v
      Filebeat DaemonSet
          |
          v
       Logstash
          |
          v
    Elasticsearch PVC
          |
          v
        Kibana
```

## Kubernetes namespaces

```text
three-s
├── auth Deployment + Service + PVC
├── content Deployment + Service + PVC
├── commerce Deployment + Service
├── files Deployment + Service + PVC
├── observability Deployment + Service
├── gateway Deployment + Service
├── frontend Deployment + Service
└── Ingress

elastic
├── elasticsearch Deployment + Service + PVC
├── logstash Deployment + Service
├── kibana Deployment + Service
└── filebeat DaemonSet
```

## images

Application images are not stored in a paid registry.

They are built natively on the Oracle Ampere ARM64 VM:

```text
Docker build
  ↓
Docker image archive
  ↓
k3s ctr images import
  ↓
K3s/containerd
```

Kubernetes uses:

```text
three-s-services:oracle-arm64
three-s-frontend:oracle-arm64
```

with `imagePullPolicy: Never`.

Elastic images are pulled from Elastic's official Docker registry and support ARM64 for the pinned 8.15.5 stack used here.

## persistence

K3s default local-path provisioner backs PVCs with the Oracle VM filesystem:

```text
auth-data       1 Gi
content-data    1 Gi
files-data      5 Gi
elasticsearch   8 Gi
```

This survives Pod replacement/restart, but it is not a backup against deleting the VM.

## update strategy

Stateful SQLite services:

```text
auth
content
files
```

use one replica and `Recreate` to avoid concurrent SQLite writers.

Stateless services use one replica on the free machine but keep `RollingUpdate` configuration:

```text
commerce
observability
gateway
frontend
```

The single-replica choice is intentional because the Always Free VM has limited CPU/RAM.

## why no cloud LoadBalancer

K3s ships Traefik and ServiceLB. On this single public VM, Traefik can listen on the node's public ports directly. This avoids provisioning a separate paid cloud LoadBalancer.
