import { transform } from "../src/transformers/plantTransformer.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \u2717 ${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `Expected "${expected}", got "${actual}"`);
}

function makeRaw(plants, relationships = []) {
  return {
    plants: plants.map((p) =>
      typeof p === "string" ? { name: p, source: "test" } : { source: "test", ...p },
    ),
    relationships: relationships.map((r) => ({ source: "test", ...r })),
    scrapedAt: new Date().toISOString(),
    source: "test",
  };
}

// --- Deduplication ---

console.log("\nplantTransformer - deduplication");

test("deduplicates plants by normalized name", () => {
  const raw = makeRaw(["Tomato", "tomato", "TOMATO"]);
  const result = transform(raw);
  assertEqual(result.plants.length, 1);
  assertEqual(result.plants[0].name, "Tomato");
});

test("deduplicates plural variants", () => {
  const raw = makeRaw(["Tomato", "Tomatoes"]);
  const result = transform(raw);
  assertEqual(result.plants.length, 1);
});

// --- Relationship dedup ---

console.log("\nplantTransformer - relationship dedup");

test("deduplicates A->B and B->A relationships", () => {
  const raw = makeRaw(
    ["Tomato", "Basil"],
    [
      { plantName: "Tomato", relatedPlantName: "Basil", type: "companion" },
      { plantName: "Basil", relatedPlantName: "Tomato", type: "companion" },
    ],
  );
  const result = transform(raw);
  assertEqual(result.relationships.length, 1);
});

test("keeps different relationship types as separate", () => {
  const raw = makeRaw(
    ["Tomato", "Fennel"],
    [
      { plantName: "Tomato", relatedPlantName: "Fennel", type: "companion" },
      { plantName: "Tomato", relatedPlantName: "Fennel", type: "antagonist" },
    ],
  );
  const result = transform(raw);
  assertEqual(result.relationships.length, 2);
});

// --- Self-relationship rejection ---

console.log("\nplantTransformer - self-relationship rejection");

test("filters out self-relationships", () => {
  const raw = makeRaw(
    ["Tomato"],
    [{ plantName: "Tomato", relatedPlantName: "Tomato", type: "companion" }],
  );
  const result = transform(raw);
  assertEqual(result.relationships.length, 0);
});

test("filters self-relationships after normalization", () => {
  const raw = makeRaw(
    ["Tomatoes"],
    [{ plantName: "Tomatoes", relatedPlantName: "Tomato", type: "companion" }],
  );
  const result = transform(raw);
  assertEqual(result.relationships.length, 0);
});

// --- Category enrichment ---

console.log("\nplantTransformer - category enrichment");

test("enriches Basil as herb", () => {
  const raw = makeRaw([{ name: "Basil" }]);
  const result = transform(raw);
  assertEqual(result.plants[0].category, "herb");
});

test("enriches Marigold as flower", () => {
  const raw = makeRaw([{ name: "Marigold" }]);
  const result = transform(raw);
  assertEqual(result.plants[0].category, "flower");
});

test("enriches Buckwheat as grain", () => {
  const raw = makeRaw([{ name: "Buckwheat" }]);
  const result = transform(raw);
  assertEqual(result.plants[0].category, "grain");
});

test("uses provided category when no known override", () => {
  const raw = makeRaw([{ name: "Zucchini", category: "vegetable" }]);
  const result = transform(raw);
  assertEqual(result.plants[0].category, "vegetable");
});

// --- Growth form enrichment ---

console.log("\nplantTransformer - growth form enrichment");

test("enriches Tomato as vine", () => {
  const raw = makeRaw([{ name: "Tomato" }]);
  const result = transform(raw);
  assertEqual(result.plants[0].growthForm, "vine");
});

test("enriches Potato as underground", () => {
  const raw = makeRaw([{ name: "Potato" }]);
  const result = transform(raw);
  assertEqual(result.plants[0].growthForm, "underground");
});

test("enriches Rosemary as bush", () => {
  const raw = makeRaw([{ name: "Rosemary" }]);
  const result = transform(raw);
  assertEqual(result.plants[0].growthForm, "bush");
});

test("defaults to herbaceous when unknown", () => {
  const raw = makeRaw([{ name: "Artichoke" }]);
  const result = transform(raw);
  assertEqual(result.plants[0].growthForm, "herbaceous");
});

// --- Results ---

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
