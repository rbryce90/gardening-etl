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

  $("table tbody tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    // Column 1: Crop name from <strong> or <a> tag
    const cropCell = $(cells[0]);
    const cropName =
      cropCell.find("strong").first().text().trim() || cropCell.find("a").first().text().trim();
    if (!cropName) return;

    const normalizedCrop = cleanPlantName(cropName);
    if (!normalizedCrop) return;

    if (!plantNames.has(normalizedCrop.toLowerCase())) {
      plantNames.add(normalizedCrop.toLowerCase());
      plants.push({
        name: normalizedCrop,
        category: "vegetable",
        source: SOURCE,
      });
    }

    // Column 2: Companion plants — split on <br> using HTML, not text
    const companionHtml = $(cells[1]).html() || "";
    const companionNames = companionHtml
      .split(/<br\s*\/?>/)
      .map((fragment) => {
        // Strip any remaining HTML tags from each fragment
        const text = fragment.replace(/<[^>]+>/g, "").trim();
        return cleanPlantName(text);
      })
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

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, `${SOURCE}-raw.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  logger.info(`Scraped ${plants.length} plants, ${relationships.length} relationships`, {
    savedTo: outPath,
  });

  return result;
}

function cleanPlantName(raw: string): string {
  let name = raw.trim();

  if (name.length <= 1) return "";
  if (name.match(/^(none|n\/a|—|-|–|source|see|note)$/i)) return "";

  // Skip sentences, citations, descriptions
  if (name.includes(". ")) return "";
  if (name.includes(":")) return "";
  if (name.includes("Source")) return "";
  if (name.includes("USDA")) return "";
  if (name.includes("NIH")) return "";
  if (name.length > 30) return "";

  // Skip if it's all lowercase concatenated words (no spaces but >15 chars = junk)
  if (!name.includes(" ") && name.length > 15) return "";

  name = name.replace(/\.$/, "");

  // Title case
  name = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return name;
}
