import { NextResponse } from "next/server";
import { panelCookieName } from "@/lib/auth/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set({
    name: panelCookieName(),
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
