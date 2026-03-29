import fs from "fs";
import path from "path";
import { RawSeasonData, CleanPlantType, CleanPlantingSeason, CleanSeasonData } from "../types.js";
import { normalizeName } from "../utils/nameNormalizer.js";
import logger from "../logger.js";

interface ZoneGroup {
  zones: number[];
  warmSeason: { start: string; end: string };
  coolSeason: { start: string; end: string };
}

interface SeasonConfig {
  zoneGroups: Record<string, ZoneGroup>;
  warmSeasonCrops: string[];
  coolSeasonCrops: string[];
}

function loadSeasonConfig(): SeasonConfig {
  const configPath = path.resolve(__dirname, "../../config/seasonMonths.json");
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function getZoneGroup(zone: number, config: SeasonConfig): ZoneGroup | null {
  for (const group of Object.values(config.zoneGroups)) {
    if (group.zones.includes(zone)) return group;
  }
  return null;
}

function isWarmSeason(plantName: string, config: SeasonConfig): boolean {
  const lower = plantName.toLowerCase();
  return config.warmSeasonCrops.some((c) => c === lower);
}

const DIRECT_SOW_CROPS = new Set([
  "bean",
  "pea",
  "corn",
  "radish",
  "carrot",
  "beet",
  "turnip",
  "spinach",
  "lettuce",
  "garlic",
  "onion",
  "potato",
  "parsnip",
]);

const TRANSPLANT_CROPS = new Set([
  "tomato",
  "pepper",
  "eggplant",
  "broccoli",
  "cauliflower",
  "cabbage",
  "brussels sprout",
  "celery",
  "artichoke",
]);

function getMethod(plantName: string, depthInches?: number): string {
  const lower = plantName.toLowerCase();
  if (DIRECT_SOW_CROPS.has(lower)) return "direct sow";
  if (TRANSPLANT_CROPS.has(lower)) return "transplant";
  if (depthInches && depthInches >= 1) return "direct sow";
  return "direct sow";
}

function buildPlantingNotes(depthInches?: number, spacingInches?: number): string | null {
  const parts: string[] = [];
  if (depthInches) parts.push(`Plant ${depthInches}" deep`);
  if (spacingInches) parts.push(`space ${spacingInches}" apart`);
  return parts.length > 0 ? parts.join(", ") + "." : null;
}

// Crops commonly grown as annuals well outside their perennial hardiness range
const ANNUAL_ZONE_OVERRIDES: Record<string, { min: number; max: number }> = {
  basil: { min: 3, max: 11 },
  tomato: { min: 2, max: 11 },
  pepper: { min: 1, max: 11 },
  eggplant: { min: 3, max: 11 },
  cucumber: { min: 3, max: 11 },
  squash: { min: 3, max: 11 },
  pumpkin: { min: 3, max: 10 },
  corn: { min: 3, max: 11 },
  bean: { min: 3, max: 11 },
  okra: { min: 4, max: 11 },
};

export function transformSeasons(raw: RawSeasonData): CleanSeasonData {
  const config = loadSeasonConfig();

  logger.info(`Transforming ${raw.plantSeasons.length} plants into planting seasons`);

  const plantTypeMap = new Map<string, CleanPlantType>();
  const seasonSet = new Set<string>();
  const plantingSeasons: CleanPlantingSeason[] = [];

  for (const plant of raw.plantSeasons) {
    const name = normalizeName(plant.plantName);
    if (!name) continue;

    if (!plantTypeMap.has(name)) {
      plantTypeMap.set(name, {
        plantName: name,
        name,
        scientificName: plant.scientificName || null,
        description: null,
        plantingNotes: buildPlantingNotes(plant.plantingDepthInches, plant.plantingSpacingInches),
      });
    }

    const override = ANNUAL_ZONE_OVERRIDES[name.toLowerCase()];
    const zoneMin = override?.min ?? plant.hardinessZoneMin ?? 3;
    const zoneMax = override?.max ?? plant.hardinessZoneMax ?? 10;
    const warm = isWarmSeason(name, config);
    const method = getMethod(name, plant.plantingDepthInches);

    for (let zone = zoneMin; zone <= zoneMax; zone++) {
      const group = getZoneGroup(zone, config);
      if (!group) continue;

      const months = warm ? group.warmSeason : group.coolSeason;
      const zoneName = `Zone ${zone}`;
      const key = `${name}|${zoneName}`;

      if (seasonSet.has(key)) continue;
      seasonSet.add(key);

      plantingSeasons.push({
        plantTypeName: name,
        zoneName,
        startMonth: months.start,
        endMonth: months.end,
        method,
        notes: null,
      });
    }
  }

  const plantTypes = Array.from(plantTypeMap.values());
  logger.info(
    `Transformed: ${plantTypes.length} plant types, ${plantingSeasons.length} planting seasons`,
  );

  return { plantTypes, plantingSeasons };
}
