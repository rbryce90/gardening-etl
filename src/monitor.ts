import express from "express";
import { createBullBoard } from "@bull-board/api";
// @ts-ignore - bull-board subpath export
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { rawDataQueue } from "./queues/rawDataQueue.js";
import { cleanDataQueue } from "./queues/cleanDataQueue.js";
import { rawSeasonQueue } from "./queues/rawSeasonQueue.js";
import { cleanSeasonQueue } from "./queues/cleanSeasonQueue.js";
import { config } from "./config.js";
import logger from "./logger.js";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/");

createBullBoard({
  queues: [
    new BullMQAdapter(rawDataQueue),
    new BullMQAdapter(cleanDataQueue),
    new BullMQAdapter(rawSeasonQueue),
    new BullMQAdapter(cleanSeasonQueue),
  ],
  serverAdapter,
});

const app = express();
app.use("/", serverAdapter.getRouter());

app.listen(config.monitor.port, () => {
  logger.info(`Bull Board monitor running at http://localhost:${config.monitor.port}`);
});
