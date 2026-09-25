# LLM Inference Logging

A provider-agnostic LLM inference logging system with a reusable TypeScript SDK, asynchronous ingestion worker, and an interactive chat and telemetry dashboard.

Capture request latency, token usage, provider metadata, failures, and redacted previews through a single instrumentation boundary. PostgreSQL stores the event outbox and queryable logs; Redis and BullMQ handle background delivery. A built-in mock provider lets you explore the complete application without an API key.

## Features

- Reference UI app with multi-turn chat, conversation history, resume flow, and request cancellation
- Reusable provider-agnostic SDK primitives under `src/lib/sdk`
- Explicit wrapper-based instrumentation for arbitrary inference functions
- Optional monkey-patching via `fetch` instrumentation for low-friction HTTP integrations
- Provider-SDK monkey-patching hooks for common OpenAI and Anthropic client surfaces
- Streaming assistant responses over NDJSON
- Provider routing with `OpenAI`, `Anthropic`, `Mock`, or `Auto`
- Normalized inference logging with latency, token usage, status, and provider metadata
- Event-first ingestion with an outbox-style `inference_events` table plus normalized `inference_logs`
- End-to-end asynchronous ingestion using enqueue-only receipt plus a Redis-backed queue and dedicated worker
- Classifier-driven redaction that combines document classification, structured field redaction, and pattern-based entity masking
- Operational dashboard for throughput, status mix, latency buckets, and provider/model mix
- Local startup via Docker Compose and self-hosted deployment artifacts for Kubernetes and Helm

## Stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- Redis
- `pg`
- BullMQ
- Tailwind CSS 4
- Zod

## Runtime Requirements

- Node `20+`
- npm `10+`
- Docker Desktop for the containerized path

## Quick Start

### Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000)

### Local Node + local Postgres + Redis

```bash
npm ci
cp .env.example .env
npm run dev
```

In a second terminal, run `npm run worker`. This path expects Postgres and Redis to already be running locally and reachable through `.env`.

Open [http://localhost:3000](http://localhost:3000)

## Provider Configuration

- `OPENAI_API_KEY` enables OpenAI requests
- `ANTHROPIC_API_KEY` enables Anthropic requests
- `DEFAULT_PROVIDER` can pin `auto`, `openai`, `anthropic`, or `mock`
- When no external provider is configured, the local fallback provider keeps chat, streaming, logging, and dashboards operational

Set `DEFAULT_PROVIDER=mock` for a local demo without external model calls. The mock provider exercises the same persistence, telemetry, and dashboard pipeline as the hosted providers; its output is simulated, not a model-quality benchmark.

## Core Endpoints

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/messages`
- `POST /api/conversations/:id/stream`
- `POST /api/conversations/:id/cancel`
- `POST /api/ingest/inference`
- `POST /api/ingest/process-pending`
- `GET /api/metrics/overview`
- `GET /api/metrics/dashboard`
- `GET /api/runtime-info`

## System Components

- `UI app`: the Next.js chat interface and app-facing APIs
- `SDK`: reusable inference instrumentation under `src/lib/sdk`
- `Ingestion pipeline`: the receipt endpoint, Redis queue, and dedicated worker that materialize normalized logs

The UI app is only a reference consumer of the SDK. The SDK can be imported by any other app that wants the same inference logging behavior.

## SDK Surface

The reusable SDK lives under `src/lib/sdk` and supports these integration styles:

- explicit wrapping through `createInferenceSdk(...).wrap(...)`
- optional monkey-patching through `instrumentFetch(...)`
- provider-client monkey-patching through `instrumentOpenAIClient(...)` and `instrumentAnthropicClient(...)`

Example wrapper usage:

```ts
const sdk = createInferenceSdk({
  transport: createHttpEventTransport("http://localhost:3000/api/ingest/inference"),
});

const result = await sdk.wrap({
  context: {
    provider: "openai",
    model: "gpt-4.1-mini",
    operation: "support-ticket-summary",
    sessionId: "ticket-123",
  },
  input: requestPayload,
  execute: () => openai.responses.create(requestPayload),
});
```

## Design Principles

- Separate product behavior from telemetry: the chat UI is one SDK consumer; instrumentation lives under `src/lib/sdk`, ingestion persistence and queue logic under `src/lib/ingestion`, and worker execution under `src/worker`.
- The SDK is wrapper-first and app-agnostic. A consuming app can call `createInferenceSdk(...).wrap(...)` around any inference function instead of depending on chat-specific code paths.
- Keep monkey-patching optional: `instrumentFetch(...)` provides provider-agnostic HTTP interception, while `instrumentOpenAIClient(...)` and `instrumentAnthropicClient(...)` patch common provider SDK client surfaces directly.
- Use layered redaction: classify content into high-risk domains, apply confidence-based document suppression and structured field redaction, then mask recognizable entities.
- Process ingestion out of process: persist events to `inference_events`, publish `eventId` to Redis through BullMQ, and materialize `inference_logs` in a dedicated worker.

## Current Boundaries

- The UI app and ingestion worker are separate runtimes and should be deployed separately when using the queue-backed path.
- The queue is used for active delivery, while PostgreSQL remains the durable source of truth through the `inference_events` outbox table.
- Authentication and tenant isolation are not implemented. Run the demo in a trusted local environment; deployment templates alone do not make it safe to expose publicly.
- Full chat messages are stored without redaction. Preview redaction is a best-effort rule-based layer, not a guarantee that all sensitive data is removed.

## Architecture Summary

### Request path

1. A UI app request or any external app call enters the SDK through an explicit wrapper or optional fetch monkey-patch.
2. The SDK captures timing, provider metadata, identifiers, previews, and error state independently of any UI.
3. The reference UI app uses that same SDK while streaming provider output back to the browser.
4. The SDK emits a normalized inference event asynchronously.
5. The ingestion endpoint validates the payload, persists it in `inference_events`, publishes the `eventId` to Redis, and returns immediately.
6. A dedicated worker consumes queue jobs, materializes events into `inference_logs`, and periodically reconciles pending outbox rows.
7. The UI app flow completes without blocking on telemetry persistence.

### Storage model

- `conversations` stores thread metadata and active request state
- `messages` stores ordered user and assistant messages
- `inference_events` stores raw normalized events for asynchronous processing, replay, and reconciliation
- `inference_logs` stores query-friendly operational fields for dashboards and debugging

### Redaction strategy

The system stores full chat content in `messages`, but only redacted previews in inference logs. The SDK redaction pipeline first classifies content into high-risk domains such as health, finance, identity, legal, and secrets, then applies confidence-based document suppression, structured field redaction for sensitive keys, and pattern/entity masking for common identifiers such as email addresses, phone numbers, SSNs, payment cards, API keys, and IBANs.

## Deliberate Tradeoffs

- PostgreSQL is the default store because it is portable, familiar, and realistic for deployment and analytics.
- Schema bootstrap runs on first database access to reduce local setup friction.
- The SDK is designed wrapper-first because explicit instrumentation is more predictable and stable across providers and client versions.
- Monkey-patching is supported as an optional convenience layer because it lowers adoption friction for existing HTTP-based integrations and provider clients, but it is intentionally not the primary integration mode.
- Streaming is implemented over NDJSON because it is simple to reason about in route handlers and easy to parse incrementally in the browser.
- SDK event emission is asynchronous so inference execution is not blocked on logging persistence.
- Ingestion uses a Redis-backed queue plus a dedicated worker while still retaining the relational outbox in `inference_events`. That adds an extra runtime dependency, but it gives clean async isolation, independent worker scaling, and a durable recovery path if queue publication fails.
- Cancellation is handled through an in-memory generation registry. This keeps the control path straightforward, but it intentionally constrains the write path to a single active app replica until cancellation state is externalized.
- The compatibility route at `/messages` remains available for buffered execution, while the primary UI path uses `/stream`.

## Retry And Recovery Model

- Queue delivery uses BullMQ job attempts with exponential backoff and configurable retry count.
- Each ingestion event is also written to `inference_events` before queue publication, so the worker can reconcile pending or failed outbox rows from PostgreSQL.
- The current design does not yet implement a dead-letter queue or a hard cap on reconciliation retries; those are the next production-hardening steps.

## Verification

```bash
npm run lint
npm run build
```

These checks cover linting, compilation, and type checking. They do not replace an end-to-end test with PostgreSQL, Redis, and a running worker.

## Deployment Notes

- Docker Compose is the fastest way to run the full stack on any machine with Docker.
- Raw Kubernetes manifests are provided for self-hosted environments with in-cluster Postgres, Redis, UI app deployment, and worker deployment wiring.
- A Helm chart is also provided under [helm/README.md](./helm/README.md) for a templated deployment path.
- For horizontally scaled app replicas, keep cancellation state out of process if you need multi-replica cancellation semantics; ingestion itself is already separated behind the queue and worker.

### Existing installations

The default database name is `llm_inference`; deployment examples use the `llm-inference-logging` namespace and image. When upgrading an existing installation, retain its database URL, Compose project name, Helm release name, resource names, and persistent-volume bindings through configuration overrides. Changing defaults does not rename or migrate an existing database. Back up data before migration and restart the app and worker after updating configuration; do not delete volumes to resolve a naming mismatch.

## Additional Notes

See [ARCHITECTURE_NOTES.md](./ARCHITECTURE_NOTES.md), [helm/README.md](./helm/README.md), and [k8s/README.md](./k8s/README.md).
