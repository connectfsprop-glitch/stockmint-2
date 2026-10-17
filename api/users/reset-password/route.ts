
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * @fileOverview REMOTE PASSWORD RESET API v1.0
 * Allows authorized portal to override a user's terminal security key.
 */

const ResetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(6)
});

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = ResetPasswordSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ success: false, message: 'Invalid payload format.' }, { status: 400 });
    }

    const { email, newPassword } = validation.data;
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Resolve UUID
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const target = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!target) {
      return NextResponse.json({ success: false, message: 'Identity not found.' }, { status: 404 });
    }

    // 2. Override Password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      target.id,
      { password: newPassword }
    );

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `Security key updated for ${email}.` 
    });

  } catch (error: any) {
    console.error('[API Reset-Password] Failure:', error.message);
    return NextResponse.json({ success: false, message: 'Internal security synchronization failure.' }, { status: 500 });
  }
}
