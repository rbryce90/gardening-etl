import neo4j from "neo4j-driver";
import { config } from "../config.js";
import { CleanData } from "../types.js";
import logger from "../logger.js";

export async function loadToNeo4j(data: CleanData): Promise<void> {
  const driver = neo4j.driver(
    config.neo4j.uri,
    neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
  );
  const session = driver.session();

  try {
    // Ensure constraint exists
    await session.run(
      "CREATE CONSTRAINT plant_id_unique IF NOT EXISTS FOR (p:Plant) REQUIRE p.id IS UNIQUE",
    );

    // We need plant IDs from SQLite to stay in sync — load by name and match
    let plantCount = 0;
    for (const plant of data.plants) {
      await session.run(
        `MERGE (p:Plant {name: $name})
         SET p.category = $category, p.growthForm = $growthForm, p.family = $family`,
        {
          name: plant.name,
          category: plant.category,
          growthForm: plant.growthForm,
          family: plant.family || null,
        },
      );
      plantCount++;
    }

    // Load relationships
    let relCount = 0;
    for (const rel of data.relationships) {
      const relType = rel.type === "companion" ? "COMPANION_OF" : "ANTAGONIST_OF";
      await session.run(
        `MATCH (a:Plant {name: $plantName}), (b:Plant {name: $relatedName})
         MERGE (a)-[:${relType}]->(b)`,
        {
          plantName: rel.plantName,
          relatedName: rel.relatedPlantName,
        },
      );
      relCount++;
    }

    logger.info(`Neo4j: loaded ${plantCount} plants, ${relCount} relationships`);
  } catch (error) {
    logger.error("Neo4j load failed", { error: (error as Error).message });
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}
