import { config } from "../config.js";

export const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
};
