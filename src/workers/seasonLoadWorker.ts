import { Worker, Job } from "bullmq";
import { redisConnection } from "../queues/connection.js";
import { CLEAN_SEASON_QUEUE } from "../queues/cleanSeasonQueue.js";
import { loadSeasonsToSqlite } from "../loaders/seasonSqliteLoader.js";
import { CleanSeasonJob } from "../types.js";
import logger from "../logger.js";

const worker = new Worker(
  CLEAN_SEASON_QUEUE,
  async (job: Job<CleanSeasonJob>) => {
    logger.info(`Season load worker processing job ${job.id}`, {
      plantTypes: job.data.data.plantTypes.length,
      plantingSeasons: job.data.data.plantingSeasons.length,
    });

    loadSeasonsToSqlite(job.data.data);

    logger.info("Season load complete");
  },
  { connection: redisConnection, concurrency: 1 },
);

worker.on("completed", (job) => {
  logger.info(`Season load job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  logger.error(`Season load job ${job?.id} failed`, {
    error: err.message,
    attempt: job?.attemptsMade,
  });
});

logger.info("Season load worker started, listening on queue: " + CLEAN_SEASON_QUEUE);

export default worker;
