# Scrapers

Scrapers live in `src/scrapers/` and must return `RawScrapedData`:

```typescript
interface RawScrapedData {
  plants: RawPlant[];
  relationships: RawRelationship[];
  scrapedAt: string; // ISO timestamp
  source: string; // identifier like "almanac"
}
```

## almanacScraper.ts

**Source:** https://www.almanac.com/companion-planting-chart-vegetables

**What it scrapes:** An HTML table with 3 columns — Crop, Companion Plants, Benefits. Only columns 1 and 2 are used.

**How it works:**

1. Fetches the page HTML with `fetch()`
2. Parses with Cheerio (`cheerio.load()`)
3. Iterates `<table> <tbody> <tr>` rows
4. Column 1: Extracts crop name from `<strong>` or `<a>` tag inside the first `<td>`
5. Column 2: Splits companion plants on `<br>` tags using `.html().split(/<br\s*\/?>/)` — this is HTML-based splitting, not text-based, to avoid concatenated names
6. Strips remaining HTML tags from each fragment with `.replace(/<[^>]+>/g, "")`
7. Runs each name through `cleanPlantName()` for validation

**cleanPlantName() filters:**

- Empty or single-character strings
- Known junk words (none, n/a, source, see, note)
- Sentences (contains ". " or ":")
- Citations (contains "Source", "USDA", "NIH")
- Names over 30 characters
- Concatenated junk (no spaces but >15 chars)
- Trailing periods

**Output:** Saves raw JSON to `data/almanac-raw.json` as a backup, returns `RawScrapedData`.

## Adding a New Scraper

1. Create `src/scrapers/mySourceScraper.ts`
2. Export an async function returning `RawScrapedData`
3. Add it to `pipeline.ts` in the `Promise.allSettled` array:

```typescript
const scraperResults = await Promise.allSettled([
  scrapeAlmanac(),
  scrapeMySource(), // add here
]);
```

Each plant in `RawPlant` needs at minimum `name` and `source`. Category, growthForm, family, etc. are optional — the transformer enriches missing values from lookup tables.

Each relationship needs `plantName`, `relatedPlantName`, `type` ("companion" or "antagonist"), and `source`.
