# Transformer

`src/transformers/plantTransformer.ts` converts `RawScrapedData` into `CleanData`. It is the single source of truth for data normalization.

## What It Does

### 1. Name Normalization (`normalizeName`)

- Trims and collapses whitespace
- Title-cases every word
- Singularizes plurals via `PLURAL_MAP` (e.g., "Tomatoes" → "Tomato", "Bush Beans" → "Bean")
- Handles compound names (e.g., "Zucchini / Summer Squash" → "Zucchini", "Chinese Cabbage" → "Bok Choy")

### 2. Plant Deduplication

Uses a `Map<string, CleanPlant>` keyed by normalized name. First occurrence wins — later duplicates are skipped.

### 3. Category Enrichment

`KNOWN_CATEGORIES` maps plant names to their correct category:

| Category | Examples                                           |
| -------- | -------------------------------------------------- |
| flower   | Marigold, Nasturtium, Zinnia, Calendula, Sunflower |
| herb     | Basil, Mint, Dill, Cilantro, Rosemary, Borage      |
| grain    | Buckwheat                                          |

Fallback chain: lookup table → scraped value → `"vegetable"` default.

### 4. Growth Form Enrichment

`KNOWN_GROWTH_FORMS` maps plant names to their growth form:

| Growth Form | Examples                                        |
| ----------- | ----------------------------------------------- |
| vine        | Tomato, Cucumber, Pea, Bean, Squash, Nasturtium |
| underground | Potato, Carrot, Beet, Radish, Onion, Garlic     |
| bush        | Rosemary, Sage, Blueberry                       |
| groundcover | Strawberry                                      |
| herbaceous  | Sunflower, Borage, Marigold (default)           |

Fallback chain: lookup table → scraped value → `"herbaceous"` default.

### 5. Relationship Deduplication

Uses a `Set<string>` with sorted composite keys (`"A|B|companion"`) to ensure each relationship exists only once regardless of which direction it was scraped. Also rejects self-relationships.

### 6. Implicit Plant Creation

If a relationship references a plant not in the plant map, the transformer creates it with defaults from the lookup tables. This ensures referential integrity downstream.

## Output

```typescript
interface CleanData {
  plants: CleanPlant[]; // unique, normalized, enriched
  relationships: CleanRelationship[]; // unique, direction-normalized
}
```
