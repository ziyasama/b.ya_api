import { NextResponse } from "next/server";
import { panelCookieName, signPanelSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const password = process.env.PANEL_PASSWORD ?? "";
  const form = await request.formData();
  const submitted = String(form.get("password") ?? "");
  const nextPath = String(form.get("next") ?? "/dashboard");
  const safeNext = nextPath.startsWith("/") ? nextPath : "/dashboard";

  if (!password || submitted !== password) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", safeNext);
    return NextResponse.redirect(url);
  }

  const token = await signPanelSession(password);
  const response = NextResponse.redirect(new URL(safeNext, request.url));
  response.cookies.set({
    name: panelCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
