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

// Raw planting season data from structured sources
export interface RawPlantSeason {
  plantName: string;
  scientificName?: string;
  cultivationCategory?: string;
  hardinessZoneMin?: number;
  hardinessZoneMax?: number;
  plantingDepthInches?: number;
  plantingSpacingInches?: number;
  source: string;
}

export interface RawSeasonData {
  plantSeasons: RawPlantSeason[];
  fetchedAt: string;
  source: string;
}

// Clean planting season data after transformation
export interface CleanPlantType {
  plantName: string;
  name: string;
  scientificName: string | null;
  description: string | null;
  plantingNotes: string | null;
}

export interface CleanPlantingSeason {
  plantTypeName: string;
  zoneName: string;
  startMonth: string;
  endMonth: string;
  method: string | null;
  notes: string | null;
}

export interface CleanSeasonData {
  plantTypes: CleanPlantType[];
  plantingSeasons: CleanPlantingSeason[];
}

export interface RawSeasonJob {
  data: RawSeasonData;
}

export interface CleanSeasonJob {
  data: CleanSeasonData;
}
