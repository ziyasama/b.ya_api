import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { panelCookieName, verifyPanelSession } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const password = process.env.PANEL_PASSWORD ?? "";
  const token = request.cookies.get(panelCookieName())?.value;
  const ok = await verifyPanelSession(token, password);

  if (ok) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
