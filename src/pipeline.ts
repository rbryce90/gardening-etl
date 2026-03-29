import { scrapeAlmanac } from "./scrapers/almanacScraper.js";
import { fetchGardeningData } from "./scrapers/gardeningDataFetcher.js";
import { enqueueRawData, rawDataQueue } from "./queues/rawDataQueue.js";
import { cleanDataQueue } from "./queues/cleanDataQueue.js";
import { enqueueRawSeasonData, rawSeasonQueue } from "./queues/rawSeasonQueue.js";
import { cleanSeasonQueue } from "./queues/cleanSeasonQueue.js";
import logger from "./logger.js";

// Import workers so they start listening
import transformWorker from "./workers/transformWorker.js";
import loadWorker from "./workers/loadWorker.js";
import seasonTransformWorker from "./workers/seasonTransformWorker.js";
import seasonLoadWorker from "./workers/seasonLoadWorker.js";

async function waitForQueuesToDrain(timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rawWaiting = await rawDataQueue.getWaitingCount();
    const rawActive = await rawDataQueue.getActiveCount();
    const cleanWaiting = await cleanDataQueue.getWaitingCount();
    const cleanActive = await cleanDataQueue.getActiveCount();
    const rawSeasonWaiting = await rawSeasonQueue.getWaitingCount();
    const rawSeasonActive = await rawSeasonQueue.getActiveCount();
    const cleanSeasonWaiting = await cleanSeasonQueue.getWaitingCount();
    const cleanSeasonActive = await cleanSeasonQueue.getActiveCount();

    const allDone =
      rawWaiting === 0 &&
      rawActive === 0 &&
      cleanWaiting === 0 &&
      cleanActive === 0 &&
      rawSeasonWaiting === 0 &&
      rawSeasonActive === 0 &&
      cleanSeasonWaiting === 0 &&
      cleanSeasonActive === 0;

    if (allDone) {
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
  await seasonTransformWorker.close();
  await seasonLoadWorker.close();
  await rawDataQueue.close();
  await cleanDataQueue.close();
  await rawSeasonQueue.close();
  await cleanSeasonQueue.close();
  logger.info("=== Pipeline complete ===");
  process.exit(0);
}

async function runPipeline() {
  logger.info("=== Starting ETL Pipeline ===");

  // Stage 1: Scrape and fetch
  logger.info("Stage 1: Scraping and fetching external sources...");
  const [almanacResult, gardeningDataResult] = await Promise.allSettled([
    scrapeAlmanac(),
    fetchGardeningData(),
  ]);

  let enqueued = 0;

  if (almanacResult.status === "fulfilled") {
    await enqueueRawData(almanacResult.value);
    enqueued++;
    logger.info(`Enqueued companion data from ${almanacResult.value.source}`, {
      plants: almanacResult.value.plants.length,
      relationships: almanacResult.value.relationships.length,
    });
  } else {
    logger.error("Almanac scraper failed", { error: almanacResult.reason?.message });
  }

  if (gardeningDataResult.status === "fulfilled") {
    await enqueueRawSeasonData(gardeningDataResult.value);
    enqueued++;
    logger.info(`Enqueued season data from ${gardeningDataResult.value.source}`, {
      plants: gardeningDataResult.value.plantSeasons.length,
    });
  } else {
    logger.error("Gardening data fetch failed", { error: gardeningDataResult.reason?.message });
  }

  if (enqueued === 0) {
    logger.error("No data sources succeeded. Pipeline stopping.");
    process.exit(1);
  }

  logger.info(`Data sources complete. ${enqueued} jobs enqueued. Waiting for workers...`);

  // Wait for all jobs to process, then shut down
  await waitForQueuesToDrain();
  await shutdown();
}

runPipeline().catch((err) => {
  logger.error("Pipeline failed", { error: err.message });
  process.exit(1);
});
