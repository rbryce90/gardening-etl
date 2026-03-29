import { DatabaseSync } from "node:sqlite";
import { config } from "../config.js";
import { CleanSeasonData } from "../types.js";
import logger from "../logger.js";

export function loadSeasonsToSqlite(data: CleanSeasonData): void {
  const db = new DatabaseSync(config.sqlite.path);
  db.exec("PRAGMA foreign_keys = ON;");

  const upsertPlant = db.prepare(
    `INSERT OR IGNORE INTO plants (name, category, growth_form) VALUES (?, 'vegetable', 'herbaceous')`,
  );
  const getPlantId = db.prepare("SELECT id FROM plants WHERE name = ?");
  const getPlantTypeId = db.prepare("SELECT id FROM plant_types WHERE plant_id = ? AND name = ?");
  const getZoneId = db.prepare("SELECT id FROM zones WHERE name = ?");

  const insertPlantType = db.prepare(
    `INSERT INTO plant_types (plant_id, name, scientific_name, description, planting_notes)
     SELECT ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM plant_types WHERE plant_id = ? AND name = ?)`,
  );

  const insertSeason = db.prepare(
    `INSERT INTO planting_seasons (plant_type_id, zone_id, start_month, end_month, method, notes)
     SELECT ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM planting_seasons WHERE plant_type_id = ? AND zone_id = ?)`,
  );

  let typeCount = 0;
  let seasonCount = 0;
  let skippedPlants = 0;

  for (const pt of data.plantTypes) {
    upsertPlant.run(pt.plantName);
    const plantRow = getPlantId.get(pt.plantName) as { id: number } | undefined;
    if (!plantRow) {
      logger.warn(`Plant not found in DB, skipping plant type: ${pt.plantName}`);
      skippedPlants++;
      continue;
    }

    const result = insertPlantType.run(
      plantRow.id,
      pt.name,
      pt.scientificName,
      pt.description,
      pt.plantingNotes,
      plantRow.id,
      pt.name,
    );
    if (result.changes > 0) typeCount++;
  }

  for (const season of data.plantingSeasons) {
    const plantRow = getPlantId.get(season.plantTypeName) as { id: number } | undefined;
    if (!plantRow) continue;

    const ptRow = getPlantTypeId.get(plantRow.id, season.plantTypeName) as
      | { id: number }
      | undefined;
    if (!ptRow) {
      logger.warn(`Plant type not found: ${season.plantTypeName}`);
      continue;
    }

    const zoneRow = getZoneId.get(season.zoneName) as { id: number } | undefined;
    if (!zoneRow) {
      logger.warn(`Zone not found: ${season.zoneName}`);
      continue;
    }

    const result = insertSeason.run(
      ptRow.id,
      zoneRow.id,
      season.startMonth,
      season.endMonth,
      season.method,
      season.notes,
      ptRow.id,
      zoneRow.id,
    );
    if (result.changes > 0) seasonCount++;
  }

  db.close();
  logger.info(
    `SQLite: inserted ${typeCount} plant types, ${seasonCount} planting seasons (${skippedPlants} plants not found)`,
  );
}
