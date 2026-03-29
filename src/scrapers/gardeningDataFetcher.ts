import fs from "fs";
import path from "path";
import logger from "../logger.js";
import { normalizeName } from "../utils/nameNormalizer.js";
import { RawPlantSeason, RawSeasonData } from "../types.js";

const SOURCE = "gardening-data";
const BASE_URL = "https://raw.githubusercontent.com/heydenberk/gardening-data/master/plants";
const DATA_DIR = path.resolve(__dirname, "../../data");

interface GardeningDataPlant {
  name: string;
  species?: string;
  cultivationCategory?: string;
  hardinessZone?: { min: number; max: number };
  plantings?: Array<{
    depth?: { size: number; unit: string };
    spacing?: { size: number; unit: string };
  }>;
}

export async function fetchGardeningData(): Promise<RawSeasonData> {
  logger.info("Fetching plant data from GitHub gardening-data repo...");

  const indexRes = await fetch(`${BASE_URL}/index.json`);
  if (!indexRes.ok) {
    throw new Error(`Failed to fetch plant index: ${indexRes.status}`);
  }
  const index = (await indexRes.json()) as { plants: string[] };

  const plantSeasons: RawPlantSeason[] = [];
  let fetched = 0;
  let failed = 0;

  for (const plantName of index.plants) {
    const url = `${BASE_URL}/${encodeURIComponent(plantName)}.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.warn(`Failed to fetch ${plantName}: ${res.status}`);
        failed++;
        continue;
      }

      const data = (await res.json()) as GardeningDataPlant;
      const normalized = normalizeName(data.name);
      if (!normalized) continue;

      const firstPlanting = data.plantings?.[0];
      let depthInches: number | undefined;
      let spacingInches: number | undefined;

      if (firstPlanting?.depth) {
        depthInches =
          firstPlanting.depth.unit === "foot"
            ? firstPlanting.depth.size * 12
            : firstPlanting.depth.size;
      }
      if (firstPlanting?.spacing) {
        spacingInches =
          firstPlanting.spacing.unit === "foot"
            ? firstPlanting.spacing.size * 12
            : firstPlanting.spacing.size;
      }

      plantSeasons.push({
        plantName: normalized,
        scientificName: data.species,
        cultivationCategory: data.cultivationCategory,
        hardinessZoneMin: data.hardinessZone?.min,
        hardinessZoneMax: data.hardinessZone?.max,
        plantingDepthInches: depthInches,
        plantingSpacingInches: spacingInches,
        source: SOURCE,
      });

      fetched++;
    } catch (err) {
      logger.warn(`Error fetching ${plantName}`, { error: (err as Error).message });
      failed++;
    }
  }

  const result: RawSeasonData = {
    plantSeasons,
    fetchedAt: new Date().toISOString(),
    source: SOURCE,
  };

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, `${SOURCE}-raw.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  logger.info(`Fetched ${fetched} plants (${failed} failed)`, { savedTo: outPath });

  return result;
}
