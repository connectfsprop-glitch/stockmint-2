
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { breachAccount } from '@/app/actions/breach-account';

/**
 * @fileOverview COMPLIANCE STATUS API v1.2 (FINAL)
 * Handles remote kill-switch signals for KYC Grace Period.
 * Hard Block (KYC): is_kyc_blocked = true
 * Soft Block (Risk): is_active = false
 */

const UpdateStatusSchema = z.object({
  email: z.string().email(),
  status: z.enum(['blocked', 'active']),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    console.error(`[API status-update] Unauthorized access attempt.`);
    return NextResponse.json({ success: false, message: 'Unauthorized spectrum access.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = UpdateStatusSchema.safeParse(body);
    
    if (!validation.success) {
      console.warn(`[API status-update] Invalid payload format:`, validation.error.flatten().fieldErrors);
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid payload format.', 
        errors: validation.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const { email, status, reason } = validation.data;
    const isBlocking = status === 'blocked';
    const isKycReason = reason === 'KYC_PENDING';

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. SCALE-READY IDENTITY RESOLUTION
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

        const userFound = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (userFound) {
            targetUserId = userFound.id;
        } else {
            page++;
            if (users.length < 100) hasMore = false;
        }
    }

    if (!targetUserId) {
      return NextResponse.json({ success: false, message: 'Identity not found in terminal spectrum.' }, { status: 404 });
    }

    // 2. ATOMIC STATUS SYNC
    if (isBlocking) {
        // Trigger Atomic Breach Protocol: Close live exposure before blocking
        await breachAccount(targetUserId, reason || 'Compliance Access Restriction');
        
        const updates: any = { is_active: false };
        if (isKycReason) {
            updates.is_kyc_blocked = true;
        }

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', targetUserId);

        if (updateError) throw updateError;
    } else {
        // Full Reactivation: Restore all access gates
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ 
                is_active: true,
                is_kyc_blocked: false 
            })
            .eq('id', targetUserId);

        if (updateError) throw updateError;
    }

    console.log(`[COMPLIANCE] Identity ${email} shifted to ${status} (Reason: ${reason || 'N/A'})`);

    return NextResponse.json({ 
      success: true, 
      message: `Identity access updated to ${status}.` 
    });

  } catch (error: any) {
    console.error('[API status-update] Failure:', error);
    return NextResponse.json({ success: false, message: 'Institutional sync failure.' }, { status: 500 });
  }
}
