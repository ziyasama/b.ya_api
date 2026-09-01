/** Public origin for redirects behind Railway / other reverse proxies. */
export function requestOrigin(request: Request): string {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
    if (host) return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}
