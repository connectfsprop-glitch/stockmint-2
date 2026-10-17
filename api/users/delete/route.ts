import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteUserAccount } from '@/app/actions/delete-user-account';
import { z } from 'zod';

/**
 * @fileOverview ATOMIC TRIAL PURGE API v6.5 (FINAL PRODUCTION)
 * Hardened standalone endpoint for 48-hour automated cleanup.
 * Scale-ready identity resolution with paginated auth scan.
 */

const DeleteUserSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  // Authentication check (Case-insensitive support)
  const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ success: false, message: 'Unauthorized spectrum access.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = DeleteUserSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ success: false, message: 'Invalid payload format.' }, { status: 400 });
    }

    const { email } = validation.data;

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // SCALE-READY IDENTITY RESOLUTION: Paginated lookup to find user by email
    let targetUserId: string | null = null;
    let page = 1;
    let hasMore = true;

    while (!targetUserId && hasMore) {
        const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 100
        });
        
        if (listError) throw listError;
        const users = data?.users || [];
        
        if (users.length === 0) {
            hasMore = false;
            break;
        }

        const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (user) {
            targetUserId = user.id;
        } else {
            page++;
            if (users.length < 100) hasMore = false;
        }
    }

    if (!targetUserId) {
      return NextResponse.json({ success: false, message: 'Identity not found in spectrum.' }, { status: 404 });
    }

    // EXECUTE ATOMIC PURGE (Profiles, Portfolios, Leverages, Orders, Auth)
    const result = await deleteUserAccount(targetUserId);

    if (result.success) {
      console.log(`[PURGE v6.5] Identity wiped: ${email}`);
      return NextResponse.json({ success: true, message: 'Identity and spectrum data purged successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API DELETE CRASH]', error);
    return NextResponse.json({ success: false, message: 'Internal server synchronization error.' }, { status: 500 });
  }
}