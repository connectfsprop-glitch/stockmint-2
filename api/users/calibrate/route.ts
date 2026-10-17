
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateUserPortfolio } from '@/app/actions/update-user-portfolio';
import { z } from 'zod';

/**
 * @fileOverview REMOTE CALIBRATION API v1.0
 * Allows external portals to update capital balance without purging history.
 */

const CalibrateSchema = z.object({
  email: z.string().email(),
  balance: z.number().positive(),
  hwm: z.number().positive()
});

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = CalibrateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ success: false, message: 'Invalid payload.' }, { status: 400 });
    }

    const { email, balance, hwm } = validation.data;
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Resolve UUID from Email
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json({ success: false, message: 'Identity not found.' }, { status: 404 });
    }

    const result = await updateUserPortfolio(user.id, balance, hwm);

    if (result.success) {
      return NextResponse.json({ success: true, message: `Capital synchronized for ${email}.` });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Institutional calibration failure.' }, { status: 500 });
  }
}
