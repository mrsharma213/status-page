import { auth } from "@/auth";
import { NO_STORE_HEADERS } from "@/lib/http";
import { NextResponse } from "next/server";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/ingest" ||
    pathname === "/robots.txt" ||
    pathname === "/favicon.svg" ||
    pathname === "/apple-touch-icon.png"
  );
}

function withNoStore(response: NextResponse) {
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return withNoStore(NextResponse.next());
  const signedIn = Boolean(req.auth?.user && req.auth.purpose === "read");
  if (!signedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return withNoStore(NextResponse.redirect(url));
  }
  return withNoStore(NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|apple-touch-icon.png).*)"],
};
