import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to extract the tenant (business) identifier from the request.
 * Currently it looks for an `x-business-id` header. In production you might
 * derive it from a sub‑domain (e.g. `myshop.myapp.com`).
 */
export function middleware(request: NextRequest) {
  const businessId = request.headers.get('x-business-id');

  // If no businessId is supplied we let the request continue – the route
  // handlers can decide whether the lack of tenant is an error.
  if (businessId) {
    // Attach the value to the request so downstream code can read it via
    // `request.headers.get('x-business-id')` or via `request.nextUrl`.
    const response = NextResponse.next();
    response.headers.set('x-business-id', businessId);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Apply to all API routes under /api/**
  matcher: '/api/:path*',
};
