import { scrapeAlmanac } from "./almanacScraper.js";
import { enqueueRawData } from "../queues/rawDataQueue.js";
import logger from "../logger.js";

async function runScrapers() {
  logger.info("Starting scrapers...");

  const results = await Promise.allSettled([scrapeAlmanac()]);

  for (const result of results) {
    if (result.status === "fulfilled") {
      await enqueueRawData(result.value);
      logger.info(`Enqueued raw data from ${result.value.source}`, {
        plants: result.value.plants.length,
        relationships: result.value.relationships.length,
      });
    } else {
      logger.error("Scraper failed", { error: result.reason?.message });
    }
  }

  logger.info("All scrapers complete");
}

runScrapers()
  .catch((err) => {
    logger.error("Scraper run failed", { error: err.message });
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
