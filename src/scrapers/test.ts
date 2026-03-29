import { scrapeAlmanac } from "./almanacScraper.js";

async function test() {
  const data = await scrapeAlmanac();
  console.log("\n=== PLANTS ===");
  data.plants.forEach((p) => console.log("  " + p.name));
  console.log("\nTotal plants:", data.plants.length);
  console.log("Total relationships:", data.relationships.length);

  // Check for junk
  const junk = data.plants.filter(
    (p) =>
      p.name.length > 25 ||
      p.name.includes(".") ||
      p.name.includes(":") ||
      (!p.name.includes(" ") && p.name.length > 15),
  );
  if (junk.length > 0) {
    console.log("\n=== JUNK FOUND ===");
    junk.forEach((p) => console.log("  BAD:", p.name));
  } else {
    console.log("\nNo junk found");
  }
}

test().catch(console.error);
