import { RawScrapedData, CleanPlant, CleanRelationship, CleanData } from "../types.js";
import logger from "../logger.js";

// Plural → singular mapping for deduplication
const PLURAL_MAP: Record<string, string> = {
  beans: "Bean",
  beets: "Beet",
  carrots: "Carrot",
  chives: "Chive",
  cucumbers: "Cucumber",
  leeks: "Leek",
  onions: "Onion",
  peas: "Pea",
  peppers: "Pepper",
  potatoes: "Potato",
  pumpkins: "Pumpkin",
  radishes: "Radish",
  strawberries: "Strawberry",
  sunflowers: "Sunflower",
  tomatoes: "Tomato",
  collards: "Collard",
};

// Known categories for plants the scraper can't classify
const KNOWN_CATEGORIES: Record<string, string> = {
  marigold: "flower",
  nasturtium: "flower",
  chamomile: "flower",
  zinnia: "flower",
  alyssum: "flower",
  calendula: "flower",
  coreopsis: "flower",
  geranium: "flower",
  sunflower: "flower",
  lovage: "herb",
  savory: "herb",
  chervil: "herb",
  borage: "herb",
  tansy: "herb",
  horseradish: "herb",
  buckwheat: "grain",
  basil: "herb",
  mint: "herb",
  oregano: "herb",
  thyme: "herb",
  dill: "herb",
  cilantro: "herb",
  parsley: "herb",
  sage: "herb",
  chive: "herb",
  rosemary: "herb",
  lavender: "herb",
};

// Known growth forms
const KNOWN_GROWTH_FORMS: Record<string, string> = {
  sunflower: "herbaceous",
  borage: "herbaceous",
  marigold: "herbaceous",
  nasturtium: "vine",
  grape: "vine",
  strawberry: "groundcover",
  rosemary: "bush",
  sage: "bush",
  lavender: "bush",
  blueberry: "bush",
  raspberry: "bush",
  tomato: "vine",
  cucumber: "vine",
  pea: "vine",
  bean: "vine",
  squash: "vine",
  pumpkin: "vine",
  potato: "underground",
  carrot: "underground",
  beet: "underground",
  radish: "underground",
  onion: "underground",
  garlic: "underground",
  turnip: "underground",
  leek: "underground",
};

export function transform(raw: RawScrapedData): CleanData {
  logger.info(
    `Transforming ${raw.plants.length} plants and ${raw.relationships.length} relationships from ${raw.source}`,
  );

  // Normalize and deduplicate plants
  const plantMap = new Map<string, CleanPlant>();
  for (const plant of raw.plants) {
    const name = normalizeName(plant.name);
    if (!name) continue;
    if (plantMap.has(name)) continue;

    const lowerName = name.toLowerCase();
    plantMap.set(name, {
      name,
      category: KNOWN_CATEGORIES[lowerName] || normalizeCategory(plant.category),
      growthForm: KNOWN_GROWTH_FORMS[lowerName] || plant.growthForm || "herbaceous",
      ediblePart: plant.ediblePart || null,
      family: plant.family || null,
    });
  }

  // Normalize and deduplicate relationships
  const relationshipSet = new Set<string>();
  const relationships: CleanRelationship[] = [];

  for (const rel of raw.relationships) {
    const plantName = normalizeName(rel.plantName);
    const relatedName = normalizeName(rel.relatedPlantName);

    if (!plantName || !relatedName) continue;
    if (plantName === relatedName) continue;

    // Sort names to create consistent key regardless of direction
    const [a, b] = [plantName, relatedName].sort();
    const key = `${a}|${b}|${rel.type}`;

    if (relationshipSet.has(key)) continue;
    relationshipSet.add(key);

    // Ensure both plants exist in the map
    for (const pName of [plantName, relatedName]) {
      if (!plantMap.has(pName)) {
        const lower = pName.toLowerCase();
        plantMap.set(pName, {
          name: pName,
          category: KNOWN_CATEGORIES[lower] || "vegetable",
          growthForm: KNOWN_GROWTH_FORMS[lower] || "herbaceous",
          ediblePart: null,
          family: null,
        });
      }
    }

    relationships.push({
      plantName: a,
      relatedPlantName: b,
      type: rel.type,
    });
  }

  const plants = Array.from(plantMap.values());
  logger.info(
    `Transformed: ${plants.length} unique plants, ${relationships.length} unique relationships`,
  );

  return { plants, relationships };
}

function normalizeName(name: string | undefined): string {
  if (!name) return "";

  let cleaned = name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  // Handle special compound names
  if (cleaned === "Zucchini / Summer Squash") cleaned = "Zucchini";
  if (cleaned === "Bush Beans") cleaned = "Bean";
  if (cleaned === "Chinese Cabbage") cleaned = "Bok Choy";
  if (cleaned === "Poached Egg Plant") cleaned = "Poached Egg Plant";

  // Singularize common plurals
  const plural = PLURAL_MAP[cleaned.toLowerCase()];
  if (plural) cleaned = plural;

  return cleaned;
}

function normalizeCategory(category: string | undefined): string {
  if (!category) return "vegetable";
  const lower = category.toLowerCase().trim();
  const valid = ["vegetable", "fruit", "herb", "grain", "nut", "flower"];
  return valid.includes(lower) ? lower : "vegetable";
}
