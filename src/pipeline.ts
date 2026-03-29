import { scrapeAlmanac } from "./scrapers/almanacScraper.js";
import { enqueueRawData } from "./queues/rawDataQueue.js";
import logger from "./logger.js";

// Import workers so they start listening
import "./workers/transformWorker.js";
import "./workers/loadWorker.js";

async function runPipeline() {
  logger.info("=== Starting ETL Pipeline ===");

  // Stage 1: Scrape
  logger.info("Stage 1: Scraping external sources...");
  const scraperResults = await Promise.allSettled([scrapeAlmanac()]);

  let enqueued = 0;
  for (const result of scraperResults) {
    if (result.status === "fulfilled") {
      await enqueueRawData(result.value);
      enqueued++;
      logger.info(`Enqueued data from ${result.value.source}`, {
        plants: result.value.plants.length,
        relationships: result.value.relationships.length,
      });
    } else {
      logger.error("Scraper failed", { error: result.reason?.message });
    }
  }

  if (enqueued === 0) {
    logger.error("No scrapers succeeded. Pipeline stopping.");
    process.exit(1);
  }

  // Stages 2 & 3 happen async via BullMQ workers
  // Transform worker picks up from raw-data queue → pushes to clean-data queue
  // Load worker picks up from clean-data queue → writes to SQLite + Neo4j
  logger.info(`Scrapers complete. ${enqueued} jobs enqueued. Workers processing in background...`);
  logger.info("Monitor queue progress at http://localhost:3006");
  logger.info("Press Ctrl+C to stop workers after processing completes.");
}

runPipeline().catch((err) => {
  logger.error("Pipeline failed", { error: err.message });
  process.exit(1);
});
