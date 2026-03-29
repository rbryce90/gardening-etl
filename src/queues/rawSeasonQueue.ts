import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import { RawSeasonData } from "../types.js";

export const RAW_SEASON_QUEUE = "raw-season-data";

export const rawSeasonQueue = new Queue(RAW_SEASON_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export async function enqueueRawSeasonData(data: RawSeasonData): Promise<void> {
  await rawSeasonQueue.add(
    "transform-seasons",
    { data },
    { jobId: `raw-season-${data.source}-${Date.now()}` },
  );
}
