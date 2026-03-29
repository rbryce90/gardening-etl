import { Worker, Job } from "bullmq";
import { redisConnection } from "../queues/connection.js";
import { RAW_DATA_QUEUE } from "../queues/rawDataQueue.js";
import { enqueueCleanData } from "../queues/cleanDataQueue.js";
import { transform } from "../transformers/plantTransformer.js";
import { RawDataJob } from "../types.js";
import logger from "../logger.js";

const worker = new Worker(
  RAW_DATA_QUEUE,
  async (job: Job<RawDataJob>) => {
    logger.info(`Transform worker processing job ${job.id}`, {
      source: job.data.data.source,
      plants: job.data.data.plants.length,
      relationships: job.data.data.relationships.length,
    });

    const cleanData = transform(job.data.data);
    await enqueueCleanData(cleanData);

    logger.info(`Transform complete, enqueued clean data`, {
      plants: cleanData.plants.length,
      relationships: cleanData.relationships.length,
    });
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

worker.on("completed", (job) => {
  logger.info(`Transform job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  logger.error(`Transform job ${job?.id} failed`, {
    error: err.message,
    attempt: job?.attemptsMade,
  });
});

logger.info("Transform worker started, listening on queue: " + RAW_DATA_QUEUE);

export default worker;
