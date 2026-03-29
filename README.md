# Gardening ETL Pipeline

ETL pipeline that scrapes plant companion/antagonist data from public sources, transforms and deduplicates it through BullMQ message queues, and dual-loads into the [Gardening Planner](https://github.com/rbryce90/gardening_planner) app's SQLite and Neo4j databases.

## Architecture

```
Scrapers → [raw-data queue] → Transform Worker → [clean-data queue] → Load Worker → SQLite + Neo4j
                                     ↓ (failures)
                               Dead Letter Queue
```

**Stage 1: Scrape** — Fetch and parse HTML from external plant databases using Cheerio. Each source has its own scraper. Raw data is saved to disk as JSON backup and pushed onto the `raw-data` BullMQ queue.

**Stage 2: Transform** — A BullMQ worker polls the `raw-data` queue. It normalizes plant names (capitalization, whitespace), deduplicates plants and relationships, validates required fields, and pushes clean records onto the `clean-data` queue. Failed jobs retry 3 times with exponential backoff before hitting the dead letter queue.

**Stage 3: Load** — A BullMQ worker polls the `clean-data` queue and dual-writes to both databases. SQLite uses `INSERT OR IGNORE` and Neo4j uses `MERGE` — both are idempotent, so the pipeline is safe to rerun without creating duplicates.

## Tech Stack

| Component  | Technology                                   |
| ---------- | -------------------------------------------- |
| Runtime    | Node.js 22+, TypeScript                      |
| Scraping   | Cheerio (HTML parsing)                       |
| Queue      | BullMQ + Redis                               |
| Databases  | SQLite (node:sqlite), Neo4j 5                |
| Monitoring | Bull Board (web UI)                          |
| Logging    | Winston                                      |
| Infra      | Redis via Gardening Planner's Podman Compose |
| Formatting | Prettier                                     |

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- The [Gardening Planner](https://github.com/rbryce90/gardening_planner) app running via `podman-compose up -d` (provides Neo4j, Redis, and creates the SQLite database)

### Setup

```bash
# Make sure the Gardening Planner infrastructure is running
cd ../gardening_planner
podman-compose up -d

# Clone the ETL repo (if not already)
cd ../gardening-etl

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env to set SQLITE_PATH to your gardening_planner's plants.db location

# Run the full pipeline
npm run pipeline
```

### Monitor

Open a separate terminal to watch queue activity:

```bash
npm run monitor
```

Bull Board UI available at http://localhost:3006 — shows queue status, active/completed/failed jobs, and dead letter queue contents.

## How It Works

### Scrapers

Each scraper is a function that fetches a web page, parses it with Cheerio, and returns a `RawScrapedData` object containing plants and relationships. Raw data is also saved to `data/` as JSON for debugging and reprocessing.

Current sources:

- **Old Farmer's Almanac** (`almanacScraper.ts`) — companion planting chart with companions and antagonists per vegetable

### Queue System

BullMQ with Redis provides:

- **Job persistence** — if the pipeline crashes mid-run, unprocessed jobs survive in Redis and resume when workers restart
- **Retry with backoff** — failed jobs retry 3 times with exponential delay (1s, 2s, 4s)
- **Dead letter queue** — after 3 failures, bad records are preserved for inspection without blocking the pipeline
- **Concurrency control** — workers process one job at a time to avoid database write conflicts
- **Monitoring** — Bull Board web UI shows real-time queue status

### Transform

Pure function (no IO, no side effects beyond logging):

- Normalizes plant names to title case
- Deduplicates by normalized name
- Ensures both plants in a relationship exist
- Sorts relationship pairs for consistent direction (alphabetical)
- Validates categories against a known list

### Loaders

**SQLite Loader:**

- `INSERT OR IGNORE` for plants (unique by name)
- Looks up plant IDs by name for relationship foreign keys
- Stores companion/antagonist pairs with lower ID first (matches gardening app convention)

**Neo4j Loader:**

- `MERGE` for plant nodes (matched by name)
- `MERGE` for relationships (no duplicate edges)
- Creates `COMPANION_OF` and `ANTAGONIST_OF` relationships

Both loaders are idempotent — the pipeline can run daily or weekly without creating duplicate data.

## Scripts

| Command            | Description                                 |
| ------------------ | ------------------------------------------- |
| `npm run pipeline` | Run the full pipeline (scrape + workers)    |
| `npm run scrape`   | Run scrapers only (enqueue without workers) |
| `npm run monitor`  | Start Bull Board web UI on port 3006        |
| `npm run build`    | Compile TypeScript                          |
| `npm run format`   | Format code with Prettier                   |

## Project Structure

```
gardening-etl/
  src/
    pipeline.ts              # Main entry — runs scrapers and starts workers
    config.ts                # Environment config loader
    logger.ts                # Winston logger
    types.ts                 # TypeScript interfaces for raw/clean data and job payloads
    scrapers/
      almanacScraper.ts      # Old Farmer's Almanac HTML scraper
      run.ts                 # Standalone scraper runner
    transformers/
      plantTransformer.ts    # Normalize, validate, deduplicate
    loaders/
      sqliteLoader.ts        # INSERT OR IGNORE into plants.db
      neo4jLoader.ts         # MERGE into Neo4j graph
    queues/
      connection.ts          # Redis connection config
      rawDataQueue.ts        # Scraper → Transform queue
      cleanDataQueue.ts      # Transform → Load queue
    workers/
      transformWorker.ts     # Consumes raw-data, produces clean-data
      loadWorker.ts          # Consumes clean-data, writes to databases
    monitor.ts               # Bull Board Express server
  config/
    sources.json             # Scraper source URLs and CSS selectors
  data/                      # Raw scraped JSON backups (gitignored)
  .env.example               # Environment variable template
```

## Adding a New Source

1. Create `src/scrapers/newSourceScraper.ts` — export an async function returning `RawScrapedData`
2. Add the scraper call to `src/pipeline.ts` in the `Promise.allSettled` array
3. Add source config to `config/sources.json` if needed
4. Run the pipeline — the transform and load stages handle everything else

## Related

- [Gardening Planner](https://github.com/rbryce90/gardening_planner) — the app this pipeline feeds
