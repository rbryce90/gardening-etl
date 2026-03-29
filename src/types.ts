// Raw data from scrapers — unvalidated, as-scraped
export interface RawPlant {
  name: string;
  category?: string;
  growthForm?: string;
  ediblePart?: string;
  family?: string;
  scientificName?: string;
  source: string;
}

export interface RawRelationship {
  plantName: string;
  relatedPlantName: string;
  type: "companion" | "antagonist";
  source: string;
}

export interface RawScrapedData {
  plants: RawPlant[];
  relationships: RawRelationship[];
  scrapedAt: string;
  source: string;
}

// Clean data after transformation — validated, normalized
export interface CleanPlant {
  name: string;
  category: string;
  growthForm: string;
  ediblePart: string | null;
  family: string | null;
}

export interface CleanRelationship {
  plantName: string;
  relatedPlantName: string;
  type: "companion" | "antagonist";
}

export interface CleanData {
  plants: CleanPlant[];
  relationships: CleanRelationship[];
}

// Queue job payloads
export interface RawDataJob {
  data: RawScrapedData;
}

export interface CleanDataJob {
  data: CleanData;
}
