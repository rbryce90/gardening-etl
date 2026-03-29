import { transformSeasons } from "../src/transformers/seasonTransformer.ts";

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

function makeRawSeason(plants) {
  return {
    plantSeasons: plants.map((p) => ({
      plantName: p.plantName,
      scientificName: p.scientificName || undefined,
      hardinessZoneMin: p.zoneMin || 3,
      hardinessZoneMax: p.zoneMax || 10,
      plantingDepthInches: p.depth || undefined,
      plantingSpacingInches: p.spacing || undefined,
      source: "test",
    })),
    fetchedAt: new Date().toISOString(),
    source: "test",
  };
}

// --- Basic transformation ---

console.log("\nseasonTransformer - basic transformation");

test("creates CleanPlantType entries from raw data", () => {
  const raw = makeRawSeason([{ plantName: "Tomato", zoneMin: 3, zoneMax: 5 }]);
  const result = transformSeasons(raw);
  assert(result.plantTypes.length > 0, "Should create at least one plant type");
  assertEqual(result.plantTypes[0].plantName, "Tomato");
  assertEqual(result.plantTypes[0].name, "Tomato");
});

test("creates CleanPlantingSeason entries with zone coverage", () => {
  const raw = makeRawSeason([{ plantName: "Tomato", zoneMin: 3, zoneMax: 5 }]);
  const result = transformSeasons(raw);
  assert(result.plantingSeasons.length > 0, "Should create planting seasons");

  const zones = result.plantingSeasons.map((s) => s.zoneName);
  assert(zones.includes("Zone 3"), "Should include zone 3");
  assert(zones.includes("Zone 4"), "Should include zone 4");
  assert(zones.includes("Zone 5"), "Should include zone 5");
});

test("normalizes plant names", () => {
  const raw = makeRawSeason([{ plantName: "tomatoes", zoneMin: 5, zoneMax: 5 }]);
  const result = transformSeasons(raw);
  assertEqual(result.plantTypes[0].plantName, "Tomato");
});

test("includes planting notes when depth/spacing provided", () => {
  const raw = makeRawSeason([
    { plantName: "Carrot", zoneMin: 5, zoneMax: 5, depth: 0.5, spacing: 3 },
  ]);
  const result = transformSeasons(raw);
  assert(result.plantTypes[0].plantingNotes !== null, "Should have planting notes");
  assert(result.plantTypes[0].plantingNotes.includes('0.5"'), "Should mention depth");
  assert(result.plantTypes[0].plantingNotes.includes('3"'), "Should mention spacing");
});

// --- Warm vs cool season behavior ---

console.log("\nseasonTransformer - warm/cool season behavior");

test("warm-season crops get later months in cold zones", () => {
  // Tomato is warm-season; zone 3 is in "cold" group
  const raw = makeRawSeason([{ plantName: "Tomato", zoneMin: 3, zoneMax: 3 }]);
  const result = transformSeasons(raw);
  const zone3 = result.plantingSeasons.find((s) => s.zoneName === "Zone 3");
  assert(zone3, "Should have zone 3 season");
  // Cold zone warm season starts May (later than cool season April)
  assertEqual(zone3.startMonth, "May", "Warm crop in cold zone starts May");
});

test("cool-season crops get earlier months in cold zones", () => {
  // Pea is cool-season; zone 3 is in "cold" group
  const raw = makeRawSeason([{ plantName: "Pea", zoneMin: 3, zoneMax: 3 }]);
  const result = transformSeasons(raw);
  const zone3 = result.plantingSeasons.find((s) => s.zoneName === "Zone 3");
  assert(zone3, "Should have zone 3 season");
  // Cold zone cool season starts April (earlier than warm season May)
  assertEqual(zone3.startMonth, "April", "Cool crop in cold zone starts April");
});

test("warm-season crops start earlier in warm zones", () => {
  // Tomato in zone 9 (warm group)
  const raw = makeRawSeason([{ plantName: "Tomato", zoneMin: 9, zoneMax: 9 }]);
  const result = transformSeasons(raw);
  const zone9 = result.plantingSeasons.find((s) => s.zoneName === "Zone 9");
  assert(zone9, "Should have zone 9 season");
  assertEqual(zone9.startMonth, "February", "Warm crop in warm zone starts February");
});

test("cool-season crops start earliest in warm zones", () => {
  // Pea in zone 9 (warm group)
  const raw = makeRawSeason([{ plantName: "Pea", zoneMin: 9, zoneMax: 9 }]);
  const result = transformSeasons(raw);
  const zone9 = result.plantingSeasons.find((s) => s.zoneName === "Zone 9");
  assert(zone9, "Should have zone 9 season");
  assertEqual(zone9.startMonth, "January", "Cool crop in warm zone starts January");
});

// --- Planting method ---

console.log("\nseasonTransformer - planting method");

test("assigns direct sow for direct sow crops", () => {
  const raw = makeRawSeason([{ plantName: "Bean", zoneMin: 5, zoneMax: 5 }]);
  const result = transformSeasons(raw);
  assertEqual(result.plantingSeasons[0].method, "direct sow");
});

test("assigns transplant for transplant crops", () => {
  const raw = makeRawSeason([{ plantName: "Tomato", zoneMin: 5, zoneMax: 5 }]);
  const result = transformSeasons(raw);
  assertEqual(result.plantingSeasons[0].method, "transplant");
});

// --- Deduplication ---

console.log("\nseasonTransformer - deduplication");

test("deduplicates same plant+zone combinations", () => {
  const raw = makeRawSeason([
    { plantName: "Tomato", zoneMin: 5, zoneMax: 5 },
    { plantName: "Tomato", zoneMin: 5, zoneMax: 5 },
  ]);
  const result = transformSeasons(raw);
  assertEqual(result.plantTypes.length, 1, "Should have one plant type");
  const zone5Seasons = result.plantingSeasons.filter((s) => s.zoneName === "Zone 5");
  assertEqual(zone5Seasons.length, 1, "Should have one zone 5 season");
});

// --- Results ---

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
