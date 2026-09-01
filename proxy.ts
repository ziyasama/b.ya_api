import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { panelCookieName, panelPassword, verifyPanelSession } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/request-origin";

export async function proxy(request: NextRequest) {
  const password = panelPassword();
  const token = request.cookies.get(panelCookieName())?.value;
  const ok = await verifyPanelSession(token, password);

  if (ok) {
    return NextResponse.next();
  }

  const login = new URL("/login", requestOrigin(request));
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/map/:path*"],
};
