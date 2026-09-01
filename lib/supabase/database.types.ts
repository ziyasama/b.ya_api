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
  cmems: SourceStatusEntry;
};

export type VesselRecord = {
  mmsi: string;
  lat: number;
  lon: number;
  size?: number | null;
  shipName?: string | null;
  shipType?: number | null;
};

export type BosphorusStateRow = {
  id: string;
  created_at: string;
  wind_speed: number | null;
  wave_height: number | null;
  sea_surface_temp: number | null;
  current_direction: number | null;
  current_u: number | null;
  current_v: number | null;
  salinity: number | null;
  water_density: number | null;
  vessel_count: number | null;
  vessel_data: VesselRecord[];
  source_status: SourceStatus;
  normalized: Record<string, number>;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
