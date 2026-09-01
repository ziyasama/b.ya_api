const COOKIE_NAME = "bosphorus_panel";
const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(signature);
}

export function panelCookieName(): string {
  return COOKIE_NAME;
}

/** Trim whitespace — Railway/env paste often adds trailing newlines. */
export function panelPassword(): string {
  return (process.env.PANEL_PASSWORD ?? "").trim();
}

export async function signPanelSession(password: string): Promise<string> {
  return hmac(password, "bosphorus-panel-ok");
}

export async function verifyPanelSession(
  token: string | undefined,
  password: string,
): Promise<boolean> {
  if (!token || !password) return false;
  const expected = await signPanelSession(password);
  if (expected.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}
