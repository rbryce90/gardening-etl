import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import { CleanSeasonData } from "../types.js";

export const CLEAN_SEASON_QUEUE = "clean-season-data";

export const cleanSeasonQueue = new Queue(CLEAN_SEASON_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export async function enqueueCleanSeasonData(data: CleanSeasonData): Promise<void> {
  await cleanSeasonQueue.add("load-seasons", { data }, { jobId: `clean-season-${Date.now()}` });
}
