import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route guard for dashboard pages.
 *
 * The backend now manages the session entirely via cookies:
 *  - An HttpOnly cookie carries the JWT (not readable by JS).
 *  - A readable `csrf_token` cookie is set at the same time.
 *
 * We use the presence of `csrf_token` as the proxy for "a session exists"
 * because the HttpOnly JWT cookie is invisible to middleware cookie reads
 * in the Edge runtime.
 */
export function middleware(request: NextRequest) {
    const hasSession = request.cookies.has("csrf_token");
    if (!hasSession) {
        const loginUrl = new URL("/auth/login", request.url);
        return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*"],
};
