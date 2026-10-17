
import { NextResponse } from 'next/server';
import { createUser } from '@/app/actions/create-user';
import { z } from 'zod';

/**
 * @fileOverview COMPLIANCE API v4.2 (FINAL)
 * Updated to support Market Targeting (Indian vs Forex) and Instant Pro (v11.0).
 * Features specialized risk calibration for Pro spectrum (3/6/1.5).
 */

const CreateUserAPISchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  initialBalance: z.number().positive(),
  marketType: z.enum(['indian', 'forex']).optional().default('indian'),
  accountModel: z.enum(['normal', 'passthenpay']).optional().default('normal'),
  accountClassification: z.enum([
    'passthenpay', 
    'instant_live',
    'instant_pro',
    'one_step_phase_1', 
    'two_step_phase_1', 
    'evaluation'
  ]),
});

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ success: false, message: 'Unauthorized spectrum access.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = CreateUserAPISchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid handshake format.', 
        errors: validation.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    let { fullName, email, password, initialBalance, accountModel, accountClassification, marketType } = validation.data;

    if (accountClassification === 'passthenpay') {
        accountModel = 'passthenpay';
    }

    const isCompetition = email.toLowerCase().startsWith('user-comp-') || accountClassification === 'evaluation';
    if (isCompetition) {
        initialBalance = 100000; 
        accountModel = 'normal';
    }

    // --- INSTITUTIONAL RISK CALIBRATION (v11.0) ---
    const isPTP = accountModel === 'passthenpay';
    const isPro = accountClassification === 'instant_pro';

    const riskSettings = {
        role: 'student' as const,
        // Pro: 6% | PTP: 15% | Standard: 10%
        lossLimitPercentage: isPro ? 6 : (isPTP ? 15 : 10),
        // Pro: 3% | PTP: 8% | Standard: 5%
        dailyLossLimitPercentage: isPro ? 3 : (isPTP ? 8 : 5),
        // Pro: 1.5% | PTP: 0% | Standard: 2%
        perTradeLossLimitPercentage: isPro ? 1.5 : (isPTP ? 0 : 2),
        equityLeverage: 5,
        accountModel: accountModel,
        accountClassification: accountClassification,
        marketType: marketType,
        is_kyc_blocked: false 
    };

    const result = await createUser({
        fullName,
        email,
        password: password || email,
        initialBalance,
        ...riskSettings,
    });

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: `Identity created successfully: ${accountClassification} (${marketType})` 
      }, { status: 200 });
    } else {
      const isDuplicate = result.message.includes('already registered');
      return NextResponse.json({ success: false, message: result.message }, { status: isDuplicate ? 409 : 500 });
    }

  } catch (error: any) {
    console.error('[API v4.2] Critical Execution Error:', error);
    return NextResponse.json({ success: false, message: 'Internal spectrum synchronization error.' }, { status: 500 });
  }
}
