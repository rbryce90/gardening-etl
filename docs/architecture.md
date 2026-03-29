# Pipeline Architecture

## Data Flow

```
Scrapers → Raw Data Queue → Transform Worker → Clean Data Queue → Load Worker → SQLite + Neo4j
```

### Stage 1: Extract (Scrapers)

Scrapers fetch external data and return `RawScrapedData` — unvalidated, as-scraped plant names and relationships. Each scraper is independent and runs via `Promise.allSettled` so one failure doesn't block others.

Currently: `almanacScraper` scrapes the Old Farmer's Almanac companion planting chart.

### Stage 2: Queue (Raw Data)

Raw data is enqueued to the `raw-data` BullMQ queue in Redis. Jobs retry 3x with exponential backoff. Each job carries the full `RawScrapedData` payload plus a unique job ID (`raw-{source}-{timestamp}`).

### Stage 3: Transform (Transform Worker)

The transform worker listens on `raw-data` and processes one job at a time:

1. **Normalize** — Title case, singularize plurals, handle compound names
2. **Deduplicate** — Map for plants, Set for relationships (sorted key ensures direction-independent dedup)
3. **Enrich** — Fill missing categories and growth forms from lookup tables
4. **Validate** — Reject self-relationships, invalid categories

Output is `CleanData` enqueued to the `clean-data` queue.

### Stage 4: Load (Load Worker)

The load worker listens on `clean-data` and dual-writes to both databases:

- **SQLite** — Upserts plants (ON CONFLICT UPDATE), inserts relationships with existence checks, normalizes relationship direction (low ID → high ID)
- **Neo4j** — MERGEs Plant nodes by name, creates COMPANION_OF/ANTAGONIST_OF edges

### Orchestration (pipeline.ts)

`pipeline.ts` runs the full flow: scrapes all sources, enqueues results, polls both queues until drained, then shuts down workers cleanly.

## Queue Configuration

Both queues share the same settings:

| Setting                 | Value                   |
| ----------------------- | ----------------------- |
| Retry attempts          | 3                       |
| Backoff                 | Exponential, 1s initial |
| Completed job retention | 100                     |
| Failed job retention    | 50                      |
| Worker concurrency      | 1                       |

## Database Targets

| Database | Purpose                                              | Connection                              |
| -------- | ---------------------------------------------------- | --------------------------------------- |
| SQLite   | Relational CRUD (plants, companions, antagonists)    | `../gardening_planner/server/plants.db` |
| Neo4j    | Graph traversal (relationship hops, recommendations) | `bolt://localhost:7687`                 |

Both databases are owned by the `gardening_planner` app. The ETL pipeline writes to them directly.
