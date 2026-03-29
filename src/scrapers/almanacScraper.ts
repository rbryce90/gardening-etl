import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import logger from "../logger.js";
import { RawPlant, RawRelationship, RawScrapedData } from "../types.js";

const SOURCE = "almanac";
const URL = "https://www.almanac.com/companion-planting-chart-vegetables";
const DATA_DIR = path.resolve(__dirname, "../../data");

export async function scrapeAlmanac(): Promise<RawScrapedData> {
  logger.info("Scraping Old Farmer's Almanac companion planting chart...", { url: URL });

  const response = await fetch(URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Almanac page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const plants: RawPlant[] = [];
  const relationships: RawRelationship[] = [];
  const plantNames = new Set<string>();

  // Find the companion planting table
  $("table tbody tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const plantName = $(cells[0]).text().trim();
    if (!plantName || plantName.toLowerCase() === "crop name") return;

    // Add the plant itself
    if (!plantNames.has(plantName.toLowerCase())) {
      plantNames.add(plantName.toLowerCase());
      plants.push({
        name: plantName,
        category: "vegetable",
        source: SOURCE,
      });
    }

    // Parse companions (column 2)
    const companionText = $(cells[1]).text().trim();
    if (companionText) {
      const companions = parseNameList(companionText);
      for (const companion of companions) {
        if (!plantNames.has(companion.toLowerCase())) {
          plantNames.add(companion.toLowerCase());
          plants.push({ name: companion, source: SOURCE });
        }
        relationships.push({
          plantName,
          relatedPlantName: companion,
          type: "companion",
          source: SOURCE,
        });
      }
    }

    // Parse antagonists (column 3)
    const antagonistText = $(cells[2]).text().trim();
    if (antagonistText) {
      const antagonists = parseNameList(antagonistText);
      for (const antagonist of antagonists) {
        if (!plantNames.has(antagonist.toLowerCase())) {
          plantNames.add(antagonist.toLowerCase());
          plants.push({ name: antagonist, source: SOURCE });
        }
        relationships.push({
          plantName,
          relatedPlantName: antagonist,
          type: "antagonist",
          source: SOURCE,
        });
      }
    }
  });

  const result: RawScrapedData = {
    plants,
    relationships,
    scrapedAt: new Date().toISOString(),
    source: SOURCE,
  };

  // Save raw data to disk as backup
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, `${SOURCE}-raw.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  logger.info(`Scraped ${plants.length} plants, ${relationships.length} relationships`, {
    savedTo: outPath,
  });

  return result;
}

// Splits a text like "Basil, Carrots, Parsley" or "Basil and Carrots" into individual names
function parseNameList(text: string): string[] {
  return text
    .split(/[,;\n]+/)
    .map((s) => s.replace(/\band\b/gi, ","))
    .join(",")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.match(/^(none|n\/a|—|-|–)$/i));
}
