import { RawScrapedData, CleanPlant, CleanRelationship, CleanData } from "../types.js";
import logger from "../logger.js";

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

    plantMap.set(name, {
      name,
      category: normalizeCategory(plant.category),
      growthForm: plant.growthForm || "herbaceous",
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

    // Ensure both plants exist
    if (!plantMap.has(plantName)) {
      plantMap.set(plantName, {
        name: plantName,
        category: "vegetable",
        growthForm: "herbaceous",
        ediblePart: null,
        family: null,
      });
    }
    if (!plantMap.has(relatedName)) {
      plantMap.set(relatedName, {
        name: relatedName,
        category: "vegetable",
        growthForm: "herbaceous",
        ediblePart: null,
        family: null,
      });
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
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeCategory(category: string | undefined): string {
  if (!category) return "vegetable";
  const lower = category.toLowerCase().trim();
  const valid = ["vegetable", "fruit", "herb", "grain", "nut", "flower"];
  return valid.includes(lower) ? lower : "vegetable";
}
