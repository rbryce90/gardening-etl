import { scrapeAlmanac } from "./scrapers/almanacScraper.js";
import { enqueueRawData } from "./queues/rawDataQueue.js";
import { rawDataQueue } from "./queues/rawDataQueue.js";
import { cleanDataQueue } from "./queues/cleanDataQueue.js";
import logger from "./logger.js";

// Import workers so they start listening
import transformWorker from "./workers/transformWorker.js";
import loadWorker from "./workers/loadWorker.js";

async function waitForQueuesToDrain(timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rawWaiting = await rawDataQueue.getWaitingCount();
    const rawActive = await rawDataQueue.getActiveCount();
    const cleanWaiting = await cleanDataQueue.getWaitingCount();
    const cleanActive = await cleanDataQueue.getActiveCount();

    if (rawWaiting === 0 && rawActive === 0 && cleanWaiting === 0 && cleanActive === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  logger.warn("Timeout waiting for queues to drain");
}

async function shutdown() {
  logger.info("Shutting down workers...");
  await transformWorker.close();
  await loadWorker.close();
  await rawDataQueue.close();
  await cleanDataQueue.close();
  logger.info("=== Pipeline complete ===");
  process.exit(0);
}

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

  logger.info(`Scrapers complete. ${enqueued} jobs enqueued. Waiting for workers...`);

  // Wait for all jobs to process, then shut down
  await waitForQueuesToDrain();
  await shutdown();
}

runPipeline().catch((err) => {
  logger.error("Pipeline failed", { error: err.message });
  process.exit(1);
});
