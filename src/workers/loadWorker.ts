import { Worker, Job } from "bullmq";
import { redisConnection } from "../queues/connection.js";
import { CLEAN_DATA_QUEUE } from "../queues/cleanDataQueue.js";
import { loadToSqlite } from "../loaders/sqliteLoader.js";
import { loadToNeo4j } from "../loaders/neo4jLoader.js";
import { CleanDataJob } from "../types.js";
import logger from "../logger.js";

const worker = new Worker(
  CLEAN_DATA_QUEUE,
  async (job: Job<CleanDataJob>) => {
    logger.info(`Load worker processing job ${job.id}`, {
      plants: job.data.data.plants.length,
      relationships: job.data.data.relationships.length,
    });

    // Load to both databases
    loadToSqlite(job.data.data);
    await loadToNeo4j(job.data.data);

    logger.info("Dual-write complete");
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

worker.on("completed", (job) => {
  logger.info(`Load job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  logger.error(`Load job ${job?.id} failed`, { error: err.message, attempt: job?.attemptsMade });
});

logger.info("Load worker started, listening on queue: " + CLEAN_DATA_QUEUE);

export default worker;
