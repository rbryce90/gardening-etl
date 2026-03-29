# Loaders

Loaders live in `src/loaders/` and write `CleanData` to databases. Both are called by the load worker in sequence (SQLite first, then Neo4j).

## sqliteLoader.ts

**Target:** `../gardening_planner/server/plants.db` (shared with the planner app)

### Plants (upsert)

```sql
INSERT INTO plants (name, category, growth_form, edible_part, family) VALUES (?, ?, ?, ?, ?)
ON CONFLICT(name) DO UPDATE SET
  category = excluded.category,
  growth_form = excluded.growth_form,
  edible_part = COALESCE(excluded.edible_part, plants.edible_part),
  family = COALESCE(excluded.family, plants.family)
```

- Inserts new plants, updates existing ones on name conflict
- `COALESCE` preserves existing edible_part/family if the new data doesn't have them — avoids overwriting manually curated data with nulls

### Relationships

- Looks up both plant IDs by name
- Normalizes direction: always `low ID → high ID` regardless of scrape order
- Checks `WHERE NOT EXISTS` before inserting to prevent duplicates
- Writes to separate tables: `companions` and `antagonists`

## neo4jLoader.ts

**Target:** Neo4j at `bolt://localhost:7687`

### Plants

```cypher
MERGE (p:Plant {name: $name})
SET p.category = $category, p.growthForm = $growthForm, p.family = $family
```

- MERGE creates or matches by name
- Always updates properties to stay in sync with SQLite

### Relationships

```cypher
MATCH (a:Plant {name: $plantName}), (b:Plant {name: $relatedName})
MERGE (a)-[:COMPANION_OF]->(b)
```

- Uses `COMPANION_OF` and `ANTAGONIST_OF` relationship types
- MERGE prevents duplicate edges
- Directed edges (a→b), but the planner queries both directions with undirected pattern matching

### Constraint

On first run, creates a uniqueness constraint:

```cypher
CREATE CONSTRAINT plant_id_unique IF NOT EXISTS FOR (p:Plant) REQUIRE p.id IS UNIQUE
```

## Important Notes

- The SQLite loader uses `node:sqlite` (Node 22+ with `--experimental-sqlite`)
- The Neo4j loader matches plants by `name`, not by `id` — this is because the ETL doesn't know SQLite auto-increment IDs at write time
- Both loaders are idempotent — safe to run multiple times on the same data

## Target Schema (SQLite)

```
plants
  id INTEGER PRIMARY KEY AUTOINCREMENT
  name TEXT NOT NULL UNIQUE
  category TEXT
  growth_form TEXT
  edible_part TEXT
  family TEXT

companions
  id INTEGER PRIMARY KEY AUTOINCREMENT
  plant_id INTEGER REFERENCES plants(id)
  companion_id INTEGER REFERENCES plants(id)

antagonists
  id INTEGER PRIMARY KEY AUTOINCREMENT
  plant_id INTEGER REFERENCES plants(id)
  antagonist_id INTEGER REFERENCES plants(id)

plant_types
  id TEXT PRIMARY KEY
  plant_id INTEGER REFERENCES plants(id)
  name TEXT
  description TEXT
  planting_notes TEXT

planting_seasons
  id TEXT PRIMARY KEY
  plant_type_id TEXT REFERENCES plant_types(id)
  zone_id INTEGER REFERENCES zones(id)
  start_month TEXT
  end_month TEXT
  method TEXT
  notes TEXT
```

The `plant_types` and `planting_seasons` tables exist but are **not populated by the ETL pipeline yet** — they are seeded by the planner app's seed script with limited data.
