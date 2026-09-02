export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SourceHealth = "ok" | "fallback" | "unavailable";

export type SourceStatusEntry = {
  health: SourceHealth;
  error?: string;
  fetchedAt?: string;
};

export type SourceStatus = {
  openMeteo: SourceStatusEntry;
  ais: SourceStatusEntry;
  metar?: SourceStatusEntry;
  seaLevel?: SourceStatusEntry;
  /** Retired with the ocean column; present on rows written before Sep 2026. */
  cmems?: SourceStatusEntry;
};

export type SignalProvenance = {
  source: string;
  kind: "measured" | "modelled" | "derived";
  observedAt?: string | null;
  /** Seconds between the observation and the moment the row was written. */
  ageSeconds?: number | null;
  detail?: string;
};

/** Per-signal record of where the number came from and how old it was at insert. */
export type Provenance = Record<string, SignalProvenance>;

export type VesselRecord = {
  mmsi: string;
  lat: number;
  lon: number;
  size?: number | null;
  shipName?: string | null;
  shipType?: number | null;
  /** Sign of latitude change. Null until two fixes exist; never invented. */
  transit?: "northbound" | "southbound" | null;
};

export type VesselEventRow = {
  id: string;
  created_at: string;
  mmsi: string;
  ship_name: string | null;
  gate: "north" | "south";
  direction: "northbound" | "southbound";
  lat: number;
  lon: number;
  crossed_at: string;
};

export type BosphorusStateRow = {
  id: string;
  created_at: string;
  wind_speed: number | null;
  wind_direction: number | null;
  wind_source: string | null;
  wave_height: number | null;
  wave_period: number | null;
  wave_direction: number | null;
  swell_height: number | null;
  sea_surface_temp: number | null;
  sample_lat: number | null;
  sample_lon: number | null;
  sea_level_black_sea: number | null;
  sea_level_marmara: number | null;
  sea_level_head: number | null;
  vessel_count: number | null;
  vessel_data: VesselRecord[];
  source_status: SourceStatus;
  provenance: Provenance | null;
  available: Record<string, boolean> | null;
  normalized: Record<string, number>;

  // Retired with the CMEMS ocean column, still written as null.
  current_direction: number | null;
  current_u: number | null;
  current_v: number | null;
  salinity: number | null;
  water_density: number | null;
};

/** Durable vessel roster, so a worker restart does not reset the strait to empty. */
export type VesselPositionRow = {
  mmsi: string;
  lat: number;
  lon: number;
  size: number | null;
  ship_name: string | null;
  ship_type: number | null;
  last_seen: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      bosphorus_state_logs: {
        Row: BosphorusStateRow;
        Insert: Omit<BosphorusStateRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<BosphorusStateRow>;
        Relationships: [];
      };
      vessel_positions: {
        Row: VesselPositionRow;
        Insert: Omit<VesselPositionRow, "updated_at"> & { updated_at?: string };
        Update: Partial<VesselPositionRow>;
        Relationships: [];
      };
      vessel_events: {
        Row: VesselEventRow;
        Insert: Omit<VesselEventRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<VesselEventRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
