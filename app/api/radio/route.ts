import { radioStreamUrl } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 86400;

/**
 * Same-origin MP3 pipe. Browsers talking to Icecast directly often send
 * Icy-MetaData: 1, which injects bytes into the MPEG stream and plays silent.
 */
export async function GET() {
  try {
    const upstream = await fetch(radioStreamUrl(), {
      cache: "no-store",
      headers: {
        Accept: "audio/mpeg",
      },
    });
    if (!upstream.ok || !upstream.body) {
      return new Response("radio unavailable", { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, no-cache",
      },
    });
  } catch {
    return new Response("radio unavailable", { status: 502 });
  }
}
