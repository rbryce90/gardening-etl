import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import { CleanData } from "../types.js";

export const CLEAN_DATA_QUEUE = "clean-data";

export const cleanDataQueue = new Queue(CLEAN_DATA_QUEUE, {
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

export async function enqueueCleanData(data: CleanData): Promise<void> {
  await cleanDataQueue.add("load", { data }, { jobId: `clean-${Date.now()}` });
}
