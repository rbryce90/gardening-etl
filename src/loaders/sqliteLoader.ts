import { DatabaseSync } from "node:sqlite";
import { config } from "../config.js";
import { CleanData } from "../types.js";
import logger from "../logger.js";

export function loadToSqlite(data: CleanData): void {
  const db = new DatabaseSync(config.sqlite.path);
  db.exec("PRAGMA foreign_keys = ON;");

  const upsertPlant = db.prepare(
    `INSERT INTO plants (name, category, growth_form, edible_part, family) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       category = excluded.category,
       growth_form = excluded.growth_form,
       edible_part = COALESCE(excluded.edible_part, plants.edible_part),
       family = COALESCE(excluded.family, plants.family)`,
  );

  const getPlantId = db.prepare("SELECT id FROM plants WHERE name = ?");

  const insertCompanion = db.prepare(
    "INSERT INTO companions (plant_id, companion_id) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM companions WHERE plant_id = ? AND companion_id = ?)",
  );

  const insertAntagonist = db.prepare(
    "INSERT INTO antagonists (plant_id, antagonist_id) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM antagonists WHERE plant_id = ? AND antagonist_id = ?)",
  );

  // Load plants (upsert — insert new, update existing)
  let plantCount = 0;
  for (const plant of data.plants) {
    const result = upsertPlant.run(
      plant.name,
      plant.category,
      plant.growthForm,
      plant.ediblePart,
      plant.family,
    );
    if (result.changes > 0) plantCount++;
  }

  // Load relationships
  let relCount = 0;
  for (const rel of data.relationships) {
    const plantRow = getPlantId.get(rel.plantName) as { id: number } | undefined;
    const relatedRow = getPlantId.get(rel.relatedPlantName) as { id: number } | undefined;

    if (!plantRow || !relatedRow) {
      logger.warn(
        `Could not find plant IDs for relationship: ${rel.plantName} - ${rel.relatedPlantName}`,
      );
      continue;
    }

    const lowId = Math.min(plantRow.id, relatedRow.id);
    const highId = Math.max(plantRow.id, relatedRow.id);

    if (rel.type === "companion") {
      const result = insertCompanion.run(lowId, highId, lowId, highId);
      if (result.changes > 0) relCount++;
    } else {
      const result = insertAntagonist.run(lowId, highId, lowId, highId);
      if (result.changes > 0) relCount++;
    }
  }

  db.close();
  logger.info(`SQLite: upserted ${plantCount} plants, ${relCount} new relationships`);
}
