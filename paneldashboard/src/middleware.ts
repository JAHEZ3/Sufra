import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const token = request.cookies.get("panel_access_token")?.value;

  // Not logged in → redirect to login (unless already there)
  if (!token && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in → redirect away from login to panel
  if (token && isPublic) {
    return NextResponse.redirect(new URL("/panel/overview", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *  - api           (proxied to the backend — must not be auth-gated here)
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
