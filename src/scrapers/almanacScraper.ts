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

  // The Almanac table has 3 columns: Crop, Companion Plants, Benefits
  // Companion Plants column has plant names separated by <br> tags
  // Benefits column has descriptions (not antagonists) — we skip it
  $("table tbody tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    // Column 1: Crop name — extract from the <strong> or <a> tag, ignore images
    const cropCell = $(cells[0]);
    const cropName =
      cropCell.find("strong").first().text().trim() || cropCell.find("a").first().text().trim();
    if (!cropName) return;

    const normalizedCrop = cleanPlantName(cropName);
    if (!normalizedCrop) return;

    // Add the crop plant
    if (!plantNames.has(normalizedCrop.toLowerCase())) {
      plantNames.add(normalizedCrop.toLowerCase());
      plants.push({
        name: normalizedCrop,
        category: "vegetable",
        source: SOURCE,
      });
    }

    // Column 2: Companion plants — names separated by <br> tags
    const companionCell = $(cells[1]);
    // Replace <br> with newlines, then split
    companionCell.find("br").replaceWith("\n");
    const companionText = companionCell.text();
    const companionNames = companionText
      .split("\n")
      .map((s) => cleanPlantName(s))
      .filter((s) => s.length > 0);

    for (const companion of companionNames) {
      if (!plantNames.has(companion.toLowerCase())) {
        plantNames.add(companion.toLowerCase());
        plants.push({ name: companion, source: SOURCE });
      }
      relationships.push({
        plantName: normalizedCrop,
        relatedPlantName: companion,
        type: "companion",
        source: SOURCE,
      });
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

// Clean a plant name — trim, remove junk, return empty string if invalid
function cleanPlantName(raw: string): string {
  let name = raw.trim();

  // Skip empty, single-char, or obvious junk
  if (name.length <= 1) return "";
  if (name.match(/^(none|n\/a|—|-|–|source|see|note)$/i)) return "";

  // Skip if it looks like a sentence (has a period followed by a space, or starts with a verb)
  if (name.includes(". ")) return "";
  if (name.includes(":")) return "";
  if (name.length > 40) return "";

  // Remove trailing periods
  name = name.replace(/\.$/, "");

  // Title case
  name = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return name;
}
