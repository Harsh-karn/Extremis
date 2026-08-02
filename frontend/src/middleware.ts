import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  return NextResponse.next();
}

// Apply this middleware to everything except static files
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
