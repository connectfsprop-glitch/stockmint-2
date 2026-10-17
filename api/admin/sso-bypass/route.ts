import { NextResponse } from 'next/server';

/**
 * Legacy API redirect to the new root-level bypass route.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = '/admin/sso-bypass';
  return NextResponse.redirect(url);
}
