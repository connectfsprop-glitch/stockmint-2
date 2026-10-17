import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * @fileOverview Data Bridge API for Funded Stock Dashboard.
 * Returns live metrics and account classification for a specific user.
 * 
 * Required Header: x-api-key
 * Required Param: email
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const apiKey = request.headers.get('x-api-key');

  // 1. Verify Internal API Key
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!email) {
    return NextResponse.json({ success: false, message: 'Email query parameter is required' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 2. Resolve User ID from Email using Supabase Admin
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) throw userError;

    const targetUser = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!targetUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const userId = targetUser.id;

    // 3. Fetch Live Portfolio Data and Profile Classification
    const [portfolioRes, profileRes] = await Promise.all([
      supabaseAdmin.from('portfolios').select('cash_balance').eq('user_id', userId).single(),
      supabaseAdmin.from('profiles').select('account_classification').eq('id', userId).single()
    ]);

    // 4. Fetch Execution Ledger for Performance Analytics
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('pnl, created_at')
      .eq('user_id', userId)
      .eq('status', 'COMPLETED')
      .not('pnl', 'is', null);

    if (portfolioRes.error || ordersError) {
      console.error('Stats API DB Error:', { portfolioError: portfolioRes.error, ordersError });
      return NextResponse.json({ success: false, message: 'Failed to retrieve user statistics' }, { status: 500 });
    }

    // 5. Compute Institutional Analytics
    const trades = orders || [];
    
    // Total Realized P/L
    const totalPnl = trades.reduce((sum, o) => sum + (o.pnl || 0), 0);
    
    // Win Rate: (Wins / Total Trades) * 100
    const wins = trades.filter(o => (o.pnl || 0) > 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    
    // Active Trading Days: Count unique calendar days with trade activity
    const activeTradingDays = new Set(
        trades.map(o => new Date(o.created_at).toISOString().split('T')[0])
    ).size;

    return NextResponse.json({
      success: true,
      data: {
        balance: Number((portfolioRes.data?.cash_balance || 0).toFixed(2)),
        totalPnl: Number(totalPnl.toFixed(2)),
        winRate: Number(winRate.toFixed(1)),
        activeTradingDays: activeTradingDays,
        accountClassification: profileRes.data?.account_classification || null
      }
    });

  } catch (error: any) {
    console.error('[API /users/stats] Critical Exception:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred' }, { status: 500 });
  }
}
