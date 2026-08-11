# 3/S expanded platform

## Local microservices + ELK

```powershell
$env:JWT_SECRET="replace-this-with-a-long-random-value"
docker compose -f docker-compose.elk.yml build --no-cache
docker compose -f docker-compose.elk.yml up
```

Endpoints:

- gateway: http://localhost:8000
- Elasticsearch: http://localhost:9200
- Kibana: http://localhost:5601

In Kibana create a data view for `three-s-events-*` and use `@timestamp` as the time field.

The frontend source changes are under `frontend/src`. Integrate them into the full Vite project that already contains `articles.js`, `package.json` and public outfit images.

See `docs/ARCHITECTURE.md` for request flow, Docker/Kubernetes internals and production gaps.
