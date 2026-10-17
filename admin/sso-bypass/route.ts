import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';

/**
 * @fileOverview ADMINISTRATIVE SSO BYPASS BRIDGE v1.5
 * Refined for absolute redirection to User Management or Trading Terminal.
 * Supports impersonation (as user) or management (as admin).
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const referer = request.headers.get('referer');
  const currentOrigin = new URL(request.url).origin;

  // 1. ORIGIN RESTRICTION (Compliance)
  // Only process requests originating from the official management domain
  if (!referer || (!referer.includes('fundedstock.io') && !referer.includes('localhost'))) {
    console.error(`[SSO BRIDGE] Blocked handshake from unauthorized origin: ${referer}`);
    return NextResponse.json({ error: 'Unauthorized origin spectrum.' }, { status: 403 });
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing security token.' }, { status: 400 });
  }

  const bridgeSecret = process.env.FS_ADMIN_BRIDGE_SECRET;
  if (!bridgeSecret) {
    console.error('[SSO BRIDGE] Missing FS_ADMIN_BRIDGE_SECRET environment variable.');
    return NextResponse.json({ error: 'Infrastructure configuration error.' }, { status: 500 });
  }

  const secret = new TextEncoder().encode(bridgeSecret);

  try {
    // 2. JWT VERIFICATION
    const { payload } = await jose.jwtVerify(token, secret);
    
    const targetUsername = payload.target_trading_username as string;
    const adminEmail = payload.admin_email as string | undefined; // Optional: To log in as Admin
    const timestamp = (payload.timestamp || payload.iat) as number;

    if (!targetUsername || !timestamp) {
        throw new Error('Malformed token payload. Required: target_trading_username, timestamp/iat');
    }

    // 3. TEMPORAL VALIDATION (120s for drift)
    const now = Math.floor(Date.now() / 1000);
    const ageSeconds = now - timestamp;

    if (Math.abs(ageSeconds) > 120) { 
      console.warn(`[SSO BRIDGE] Handshake expired. Age: ${ageSeconds}s`);
      return NextResponse.json({ error: 'Security handshake expired.' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. RECURSIVE IDENTITY RESOLUTION
    let targetEmail: string | null = null;
    let targetId: string | null = null;

    // Search by Profile first to get UUID and Email
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .or(`full_name.ilike."${targetUsername}",id.eq."${targetUsername}"`)
        .maybeSingle();

    if (profile) {
        targetId = profile.id;
        const { data: uRes } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        targetEmail = uRes?.user?.email || null;
    }

    // Fallback: Check if targetUsername is already an email
    if (!targetEmail && targetUsername.includes('@')) {
        const { data: authRes } = await supabaseAdmin.auth.admin.listUsers();
        const found = authRes.users.find(u => u.email?.toLowerCase() === targetUsername.toLowerCase());
        if (found) {
            targetEmail = found.email || null;
            targetId = found.id;
        }
    }

    if (!targetEmail || !targetId) {
      console.error(`[SSO BRIDGE] Could not resolve identity for: ${targetUsername}`);
      return NextResponse.json({ error: 'Identity not found in terminal spectrum.' }, { status: 404 });
    }

    // 5. REDIRECTION LOGIC
    // If admin_email is provided, we log in the ADMIN and take them to the USER'S management page.
    // If not, we log in the USER and take them to their DASHBOARD.
    
    const loginEmail = adminEmail || targetEmail;
    const finalRedirectPath = adminEmail 
        ? `${currentOrigin}/admin/users/${targetId}` 
        : `${currentOrigin}/dashboard`;

    // 6. BYPASS INITIALIZATION (Session Injection)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
      options: {
          redirectTo: finalRedirectPath
      }
    });

    if (linkError || !linkData.properties?.action_link) {
      console.error(`[SSO BRIDGE] Failed to generate bypass link:`, linkError?.message);
      return NextResponse.json({ error: 'Session initialization failed.' }, { status: 500 });
    }

    console.log(`[SSO BRIDGE] Authorized bypass for: ${loginEmail}. Destination: ${finalRedirectPath}`);

    // 7. REDIRECT TO INITIALIZED TERMINAL
    return NextResponse.redirect(linkData.properties.action_link);

  } catch (error: any) {
    console.error(`[SSO BRIDGE] Handshake failure:`, error.message);
    return NextResponse.json({ error: 'Invalid security handshake.' }, { status: 401 });
  }
}
