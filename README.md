# Gardening ETL Pipeline

ETL pipeline that scrapes plant companion/antagonist data and planting season data from public sources, transforms and deduplicates it through BullMQ message queues, and loads into the [Gardening Planner](https://github.com/rbryce90/gardening_planner) app's SQLite and Neo4j databases.

## Architecture

Two parallel data flows run through the same queue infrastructure:

```
                         ┌─ Almanac Scraper ──→ [raw-data] ──→ Transform ──→ [clean-data] ──→ Load ──→ SQLite + Neo4j
Pipeline orchestrator ───┤
                         └─ GitHub Fetcher ──→ [raw-season-data] ──→ Season Transform ──→ [clean-season-data] ──→ Season Load ──→ SQLite
```

**Flow 1: Companion/Antagonist Data**

- Scrapes the Old Farmer's Almanac companion planting chart
- Extracts 53 plants and 120 relationships
- Loads to both SQLite (plants, companions, antagonists tables) and Neo4j (Plant nodes, COMPANION_OF/ANTAGONIST_OF edges)

**Flow 2: Planting Seasons**

- Fetches 39 plant JSON files from GitHub (heydenberk/gardening-data)
- Generates zone-specific planting months using warm/cool season crop classification
- Creates plant types and 400+ planting season entries across 11 USDA zones
- Loads to SQLite only (plant_types, planting_seasons tables)

Both flows use BullMQ with 3 retries and exponential backoff. All loaders are idempotent — safe to rerun.

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
- **GitHub gardening-data** (`gardeningDataFetcher.ts`) — structured plant data with hardiness zones, planting depth/spacing from [heydenberk/gardening-data](https://github.com/heydenberk/gardening-data)

### Queue System

BullMQ with Redis provides:

- **Job persistence** — if the pipeline crashes mid-run, unprocessed jobs survive in Redis and resume when workers restart
- **Retry with backoff** — failed jobs retry 3 times with exponential delay (1s, 2s, 4s)
- **Dead letter queue** — after 3 failures, bad records are preserved for inspection without blocking the pipeline
- **Concurrency control** — workers process one job at a time to avoid database write conflicts
- **Monitoring** — Bull Board web UI shows real-time queue status

### Transformers

**Plant Transformer** (`plantTransformer.ts`) — pure function:

- Normalizes plant names via shared `nameNormalizer` (title case, singularize plurals, resolve compound names)
- Deduplicates plants by normalized name, relationships by sorted pair key
- Enriches missing categories and growth forms from lookup tables
- Validates categories against a known list

**Season Transformer** (`seasonTransformer.ts`):

- Classifies each plant as warm-season or cool-season crop
- Maps to zone-specific planting months via `config/seasonMonths.json`
- Generates one planting season per plant × zone within the plant's hardiness range
- Assigns planting method (direct sow vs transplant) per crop
- Applies zone overrides for annual crops grown outside their perennial range

### Loaders

**SQLite Loader** (`sqliteLoader.ts`):

- `INSERT OR IGNORE` for plants (unique by name)
- Looks up plant IDs by name for relationship foreign keys
- Stores companion/antagonist pairs with lower ID first

**Neo4j Loader** (`neo4jLoader.ts`):

- `MERGE` for plant nodes (matched by name)
- `MERGE` for relationships (no duplicate edges)
- Creates `COMPANION_OF` and `ANTAGONIST_OF` relationships

**Season SQLite Loader** (`seasonSqliteLoader.ts`):

- Auto-creates missing plants with `INSERT OR IGNORE`
- Upserts plant types (one generic type per plant)
- Upserts planting seasons (unique by plant_type + zone)

All loaders are idempotent — the pipeline can run daily or weekly without creating duplicate data.

## Scripts

| Command            | Description                                       |
| ------------------ | ------------------------------------------------- |
| `npm run pipeline` | Run the full pipeline (scrape + season + workers) |
| `npm run scrape`   | Run scrapers only (enqueue without workers)       |
| `npm test`         | Run all unit tests (42 tests)                     |
| `npm run monitor`  | Start Bull Board web UI on port 3006              |
| `npm run build`    | Compile TypeScript                                |
| `npm run format`   | Format code with Prettier                         |

## Project Structure

```
gardening-etl/
  src/
    pipeline.ts              # Main entry — runs both data flows and manages workers
    config.ts                # Environment config loader
    logger.ts                # Winston logger
    types.ts                 # TypeScript interfaces for raw/clean data and job payloads
    scrapers/
      almanacScraper.ts      # Old Farmer's Almanac HTML scraper
      gardeningDataFetcher.ts # GitHub gardening-data JSON fetcher
      run.ts                 # Standalone scraper runner
    transformers/
      plantTransformer.ts    # Normalize, validate, deduplicate plants + relationships
      seasonTransformer.ts   # Map plants to zone-specific planting seasons
    loaders/
      sqliteLoader.ts        # Load plants + relationships to SQLite
      neo4jLoader.ts         # Load plants + relationships to Neo4j
      seasonSqliteLoader.ts  # Load plant types + planting seasons to SQLite
    queues/
      connection.ts          # Redis connection config
      rawDataQueue.ts        # Scraper → Transform queue
      cleanDataQueue.ts      # Transform → Load queue
      rawSeasonQueue.ts      # Fetcher → Season Transform queue
      cleanSeasonQueue.ts    # Season Transform → Season Load queue
    workers/
      transformWorker.ts     # Consumes raw-data, produces clean-data
      loadWorker.ts          # Consumes clean-data, writes to SQLite + Neo4j
      seasonTransformWorker.ts # Consumes raw-season-data, produces clean-season-data
      seasonLoadWorker.ts    # Consumes clean-season-data, writes to SQLite
    utils/
      nameNormalizer.ts      # Shared plant name normalization (used by scrapers + transformers)
    monitor.ts               # Bull Board Express server (4 queues)
  config/
    seasonMonths.json        # Zone-group-to-month mapping for warm/cool season crops
  tests/
    nameNormalizer.test.ts   # 17 tests for name normalization
    plantTransformer.test.ts # 14 tests for plant transform logic
    seasonTransformer.test.ts # 11 tests for season transform logic
  docs/
    architecture.md          # Pipeline data flow and queue config
    scrapers.md              # Scraper details and how to add new sources
    transformer.md           # Normalization, dedup, enrichment logic
    loaders.md               # SQLite and Neo4j loading strategies + target schema
    queues.md                # BullMQ setup, workers, monitoring
  data/                      # Raw scraped JSON backups (gitignored)
  .env.example               # Environment variable template
```

## Adding a New Source

1. Create `src/scrapers/newSourceScraper.ts` — export an async function returning `RawScrapedData` or `RawSeasonData`
2. Add the scraper call to `src/pipeline.ts` in the `Promise.allSettled` array
3. Enqueue the result to the appropriate queue (`enqueueRawData` or `enqueueRawSeasonData`)
4. Run the pipeline — the transform and load stages handle everything else

## Related

- [Gardening Planner](https://github.com/rbryce90/gardening_planner) — the app this pipeline feeds
