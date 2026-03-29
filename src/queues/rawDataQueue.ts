import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import { RawScrapedData } from "../types.js";

export const RAW_DATA_QUEUE = "raw-data";

export const rawDataQueue = new Queue(RAW_DATA_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export async function enqueueRawData(data: RawScrapedData): Promise<void> {
  await rawDataQueue.add("transform", { data }, { jobId: `raw-${data.source}-${Date.now()}` });
}
