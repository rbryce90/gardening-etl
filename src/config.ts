import dotenv from "dotenv";
dotenv.config();

export const config = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
  neo4j: {
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    user: process.env.NEO4J_USER || "neo4j",
    password: process.env.NEO4J_PASSWORD || "password",
  },
  sqlite: {
    path: process.env.SQLITE_PATH || "../gardening_planner/server/plants.db",
  },
  monitor: {
    port: parseInt(process.env.MONITOR_PORT || "3006"),
  },
};
