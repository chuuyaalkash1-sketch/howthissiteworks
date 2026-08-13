#!/usr/bin/env bash
set -euo pipefail
SERVICE="${1:-}"
if [ -z "$SERVICE" ]; then
  echo "Usage: bash scripts/oracle/logs.sh SERVICE"
  echo "Examples: gateway observability auth content commerce files frontend elasticsearch logstash kibana filebeat"
  exit 1
fi

case "$SERVICE" in
  elasticsearch|logstash|kibana|filebeat)
    NS=elastic
    ;;
  *)
    NS=three-s
    ;;
esac

kubectl logs -n "$NS" -l "app=$SERVICE" --tail=200 --prefix=true
