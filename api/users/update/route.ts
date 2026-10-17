
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateUserClassification } from '@/app/actions/update-user-classification';
import { z } from 'zod';

/**
 * @fileOverview COMPLIANCE UPDATE API v4.0 (FINAL)
 * Handles phase promotion from FundedStock with Spec v4.0 strings.
 * Updated to support Instant Pro (v11.0) with specialized 3/6/1.5 limits.
 */

const UpdateClassificationSchema = z.object({
  email: z.string().email(),
  accountClassification: z.enum([
    'passthenpay',
    'instant_live',
    'instant_pro',
    'one_step_phase_1',
    'one_step_live',
    'two_step_phase_1',
    'two_step_phase_2',
    'two_step_live',
    'evaluation'
  ]),
});

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = UpdateClassificationSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid classification string provided.' 
      }, { status: 400 });
    }

    const { email, accountClassification } = validation.data;

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve User ID via Admin Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) throw userError;

    const targetUser = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!targetUser) {
      return NextResponse.json({ success: false, message: 'Identity not found in terminal spectrum.' }, { status: 404 });
    }

    // Sync to database
    const result = await updateUserClassification(targetUser.id, accountClassification);

    if (result.success) {
      // --- TIERED RISK SYNCHRONIZATION ---
      
      if (accountClassification === 'passthenpay') {
          await supabaseAdmin
            .from('profiles')
            .update({ 
                account_model: 'passthenpay',
                loss_limit_percentage: 15,
                daily_loss_limit_percentage: 8,
                per_trade_loss_limit_percentage: 0
            })
            .eq('id', targetUser.id);
      }

      if (accountClassification === 'instant_pro') {
          await supabaseAdmin
            .from('profiles')
            .update({ 
                loss_limit_percentage: 6,
                daily_loss_limit_percentage: 3,
                per_trade_loss_limit_percentage: 1.5
            })
            .eq('id', targetUser.id);
      }

      return NextResponse.json({ 
        success: true, 
        message: `Account spectrum updated: ${accountClassification}` 
      });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API v4.0 Update] Failure:', error);
    return NextResponse.json({ success: false, message: 'Institutional sync failure.' }, { status: 500 });
  }
}
