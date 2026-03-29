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

const COMPOUND_NAMES: Record<string, string> = {
  "Zucchini / Summer Squash": "Zucchini",
  "Bush Beans": "Bean",
  "Chinese Cabbage": "Bok Choy",
  "Common Bean": "Bean",
  "Bell Pepper": "Pepper",
  "Chili Pepper": "Pepper",
  "Head Lettuce": "Lettuce",
  "Leaf Lettuce": "Lettuce",
  "Pole Pea": "Pea",
  "Sweet Corn": "Corn",
  "Swiss Chard": "Chard",
  "Brussel Sprout": "Brussels Sprout",
  "Collard Green": "Collard",
};

export function normalizeName(name: string | undefined): string {
  if (!name) return "";

  let cleaned = name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  const compound = COMPOUND_NAMES[cleaned];
  if (compound) cleaned = compound;

  const plural = PLURAL_MAP[cleaned.toLowerCase()];
  if (plural) cleaned = plural;

  return cleaned;
}

export function cleanPlantName(raw: string): string {
  let name = raw.trim();

  if (name.length <= 1) return "";
  if (name.match(/^(none|n\/a|—|-|–|source|see|note)$/i)) return "";

  if (name.includes(". ")) return "";
  if (name.includes(":")) return "";
  if (name.includes("Source")) return "";
  if (name.includes("USDA")) return "";
  if (name.includes("NIH")) return "";
  if (name.length > 30) return "";

  if (!name.includes(" ") && name.length > 15) return "";

  name = name.replace(/\.$/, "");

  name = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return name;
}

export function normalizeCategory(category: string | undefined): string {
  if (!category) return "vegetable";
  const lower = category.toLowerCase().trim();
  const valid = ["vegetable", "fruit", "herb", "grain", "nut", "flower"];
  return valid.includes(lower) ? lower : "vegetable";
}
