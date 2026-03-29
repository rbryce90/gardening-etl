# Queues & Workers

The pipeline uses BullMQ with Redis for job orchestration. Two queues form a two-stage pipeline.

## Queue Infrastructure

```
src/queues/connection.ts   — Shared Redis connection config
src/queues/rawDataQueue.ts — Queue for unprocessed scraper output
src/queues/cleanDataQueue.ts — Queue for transformed data ready to load
```

### raw-data queue

- **Producer:** `pipeline.ts` via `enqueueRawData()`
- **Consumer:** `transformWorker.ts`
- **Job name:** `"transform"`
- **Job ID format:** `raw-{source}-{timestamp}`
- **Payload:** `{ data: RawScrapedData }`

### clean-data queue

- **Producer:** `transformWorker.ts` via `enqueueCleanData()`
- **Consumer:** `loadWorker.ts`
- **Job name:** `"load"`
- **Job ID format:** `clean-{timestamp}`
- **Payload:** `{ data: CleanData }`

## Workers

```
src/workers/transformWorker.ts — Processes raw-data jobs
src/workers/loadWorker.ts      — Processes clean-data jobs
```

Both workers:

- Run at concurrency 1 (one job at a time)
- Log on completion and failure
- Are imported by `pipeline.ts` on startup (import triggers listener registration)

### Transform Worker

1. Receives `RawScrapedData` from raw-data queue
2. Calls `transform()` from plantTransformer
3. Enqueues result to clean-data queue

### Load Worker

1. Receives `CleanData` from clean-data queue
2. Calls `loadToSqlite()` (synchronous)
3. Calls `loadToNeo4j()` (async)
4. Both must succeed for job to complete

## Monitoring

`src/monitor.ts` runs a Bull Board web UI on port 3006 (configurable via `MONITOR_PORT`). Start it separately:

```bash
npm run monitor
```

Shows job counts, status, history, and payloads for both queues.

## Pipeline Lifecycle

1. `pipeline.ts` imports workers (they start listening immediately)
2. Scrapers run and enqueue raw data
3. `waitForQueuesToDrain()` polls every 500ms until both queues have 0 waiting + 0 active jobs
4. `shutdown()` closes workers and queues, then exits
