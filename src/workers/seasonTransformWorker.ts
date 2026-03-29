import { Worker, Job } from "bullmq";
import { redisConnection } from "../queues/connection.js";
import { RAW_SEASON_QUEUE } from "../queues/rawSeasonQueue.js";
import { enqueueCleanSeasonData } from "../queues/cleanSeasonQueue.js";
import { transformSeasons } from "../transformers/seasonTransformer.js";
import { RawSeasonJob } from "../types.js";
import logger from "../logger.js";

const worker = new Worker(
  RAW_SEASON_QUEUE,
  async (job: Job<RawSeasonJob>) => {
    logger.info(`Season transform worker processing job ${job.id}`, {
      plants: job.data.data.plantSeasons.length,
    });

    const cleanData = transformSeasons(job.data.data);
    await enqueueCleanSeasonData(cleanData);

    logger.info("Season transform complete, enqueued clean season data", {
      plantTypes: cleanData.plantTypes.length,
      plantingSeasons: cleanData.plantingSeasons.length,
    });
  },
  { connection: redisConnection, concurrency: 1 },
);

worker.on("completed", (job) => {
  logger.info(`Season transform job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  logger.error(`Season transform job ${job?.id} failed`, {
    error: err.message,
    attempt: job?.attemptsMade,
  });
});

logger.info("Season transform worker started, listening on queue: " + RAW_SEASON_QUEUE);

export default worker;
