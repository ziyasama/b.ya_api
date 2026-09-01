import { NextResponse } from "next/server";
import { panelCookieName } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/request-origin";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", requestOrigin(request)));
  response.cookies.set({
    name: panelCookieName(),
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
