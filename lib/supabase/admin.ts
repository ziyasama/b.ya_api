import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedSupabaseClient } from "@/lib/supabase/browser";

/**
 * Service-role client for workers and trusted server writers.
 * Do not import this module from any `"use client"` file.
 * Service role bypasses RLS — never ship SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createAdminSupabase(): TypedSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
