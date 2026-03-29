import { normalizeName, cleanPlantName, normalizeCategory } from "../src/utils/nameNormalizer.ts";

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

// --- normalizeName ---

console.log("\nnormalizeName");

test("title cases a lowercase name", () => {
  assertEqual(normalizeName("tomato"), "Tomato");
});

test("title cases multi-word name", () => {
  assertEqual(normalizeName("bell pepper"), "Pepper");
});

test("singularizes plurals", () => {
  assertEqual(normalizeName("Tomatoes"), "Tomato");
  assertEqual(normalizeName("peppers"), "Pepper");
  assertEqual(normalizeName("radishes"), "Radish");
  assertEqual(normalizeName("strawberries"), "Strawberry");
});

test("handles compound names", () => {
  assertEqual(normalizeName("Common Bean"), "Bean");
  assertEqual(normalizeName("Bell Pepper"), "Pepper");
  assertEqual(normalizeName("Swiss Chard"), "Chard");
  assertEqual(normalizeName("Sweet Corn"), "Corn");
  assertEqual(normalizeName("Head Lettuce"), "Lettuce");
});

test("returns empty string for undefined/empty", () => {
  assertEqual(normalizeName(undefined), "");
  assertEqual(normalizeName(""), "");
});

test("trims and collapses whitespace", () => {
  assertEqual(normalizeName("  tomato  "), "Tomato");
  assertEqual(normalizeName("bell   pepper"), "Pepper");
});

// --- cleanPlantName ---

console.log("\ncleanPlantName");

test("accepts valid plant names", () => {
  assertEqual(cleanPlantName("Tomato"), "Tomato");
  assertEqual(cleanPlantName("bell pepper"), "Bell Pepper");
  assertEqual(cleanPlantName("Swiss Chard"), "Swiss Chard");
});

test("rejects empty and single char", () => {
  assertEqual(cleanPlantName(""), "");
  assertEqual(cleanPlantName("A"), "");
  assertEqual(cleanPlantName(" "), "");
});

test("rejects junk words", () => {
  assertEqual(cleanPlantName("none"), "");
  assertEqual(cleanPlantName("n/a"), "");
  assertEqual(cleanPlantName("N/A"), "");
  assertEqual(cleanPlantName("source"), "");
});

test("rejects sentences (with period-space)", () => {
  assertEqual(cleanPlantName("This is a sentence. With more."), "");
});

test("rejects citations", () => {
  assertEqual(cleanPlantName("Source: USDA"), "");
  assertEqual(cleanPlantName("From USDA database"), "");
  assertEqual(cleanPlantName("NIH reference"), "");
});

test("rejects long names over 30 chars", () => {
  assertEqual(cleanPlantName("A Very Long Plant Name That Exceeds Limit"), "");
});

test("rejects concatenated junk (>15 no spaces)", () => {
  assertEqual(cleanPlantName("abcdefghijklmnopq"), "");
});

test("strips trailing period", () => {
  assertEqual(cleanPlantName("Tomato."), "Tomato");
});

// --- normalizeCategory ---

console.log("\nnormalizeCategory");

test("returns valid categories as-is", () => {
  assertEqual(normalizeCategory("vegetable"), "vegetable");
  assertEqual(normalizeCategory("fruit"), "fruit");
  assertEqual(normalizeCategory("herb"), "herb");
  assertEqual(normalizeCategory("grain"), "grain");
  assertEqual(normalizeCategory("flower"), "flower");
});

test("normalizes case", () => {
  assertEqual(normalizeCategory("HERB"), "herb");
  assertEqual(normalizeCategory("Fruit"), "fruit");
});

test("defaults to vegetable for undefined/invalid", () => {
  assertEqual(normalizeCategory(undefined), "vegetable");
  assertEqual(normalizeCategory("shrub"), "vegetable");
  assertEqual(normalizeCategory(""), "vegetable");
});

// --- Results ---

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
