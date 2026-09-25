# Helm Chart

This directory packages the self-hosted Kubernetes deployment as a Helm chart.

## Chart Location

`helm/llm-inference-logging`

## Install

```bash
helm upgrade --install inference-logging ./helm/llm-inference-logging \
  --namespace llm-inference-logging \
  --create-namespace
```

## Common Overrides

```bash
helm upgrade --install inference-logging ./helm/llm-inference-logging \
  --namespace llm-inference-logging \
  --create-namespace \
  --set image.repository=your-registry/llm-inference-logging \
  --set image.tag=latest \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=inference.local
```

## External Database

If you want to use an external Postgres instance:

```bash
helm upgrade --install inference-logging ./helm/llm-inference-logging \
  --namespace llm-inference-logging \
  --create-namespace \
  --set postgres.enabled=false \
  --set secrets.databaseUrl='postgresql://user:password@db-host:5432/llm_inference'
```

## External Redis

If you want to use an external Redis instance for the ingestion queue:

```bash
helm upgrade --install inference-logging ./helm/llm-inference-logging \
  --namespace llm-inference-logging \
  --create-namespace \
  --set redis.enabled=false \
  --set secrets.redisUrl='redis://redis-host:6379'
```

## Tradeoffs

- The chart defaults to a single application replica because cancellation is still tracked in memory.
- Postgres and Redis are bundled by default for self-hosted completeness, but the chart supports switching either dependency to an external service.
