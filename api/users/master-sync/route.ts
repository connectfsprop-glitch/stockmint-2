
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * @fileOverview MASTER DATA BRIDGE API v1.5 (FULL DETIAL)
 * Provides absolute account state including Order Ledger and Trade Ledger mapping.
 * Synchronized with StockMint Admin Profile View (Entry, Exit, Qty, P&L, Status).
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');

  // 1. Authorization Handshake
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ success: false, message: 'Unauthorized spectrum access.' }, { status: 401 });
  }

  if (!email) {
    return NextResponse.json({ success: false, message: 'Email query parameter is required.' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 2. RECURSIVE IDENTITY RESOLUTION
    let targetUserId: string | null = null;
    let targetEmail: string | null = null;
    let page = 1;
    let hasMore = true;

    while (hasMore && !targetUserId) {
      const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000
      });

      const users = data?.users || [];

      if (listError || users.length === 0) {
        hasMore = false;
        break;
      }

      const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (found) {
        targetUserId = found.id;
        targetEmail = found.email || null;
      } else {
        page++;
        if (users.length < 1000) hasMore = false;
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ success: false, message: 'Identity not found in terminal spectrum.' }, { status: 404 });
    }

    // 3. CONCURRENT STATE FETCH
    const [profileRes, portfolioRes, leverageRes, ordersRes, pnlRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', targetUserId).single(),
      supabaseAdmin.from('portfolios').select('*').eq('user_id', targetUserId).single(),
      supabaseAdmin.from('leverages').select('*').eq('user_id', targetUserId).single(),
      supabaseAdmin.from('orders').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('daily_pnl').select('*').eq('user_id', targetUserId).order('date', { ascending: false })
    ]);

    const allOrders = ordersRes.data || [];

    // 4. TRANSFORM EXECUTION STREAM (The "Order Ledger")
    const mappedExecutionStream = allOrders.map(order => ({
      id: order.id,
      timestamp: order.created_at,
      symbol: order.symbol,
      side: order.order_type,
      price: Number(order.price || 0),
      quantity: Number(order.quantity || 0),
      pnl: order.pnl ? Number(order.pnl) : null,
      result: order.status,
      source: order.breach_reason?.includes('[SYSTEM]') ? 'ALGO' : 'MANUAL',
      reason: order.breach_reason || ''
    }));

    // 5. TRANSFORM TRADE LEDGER (Completed Positions ONLY)
    const completedTrades = allOrders
      .filter(o => o.status === 'COMPLETED' && o.pnl !== null)
      .map(o => {
        const exitPrice = Number(o.price || 0);
        const pnl = Number(o.pnl || 0);
        const qty = Number(o.quantity || 1);
        
        // Calculate Entry Price based on direction
        // If exit was SELL, entry was BUY. Entry = Exit - (PnL/Qty)
        // If exit was BUY, entry was SELL. Entry = Exit + (PnL/Qty)
        const entryPrice = o.order_type === 'SELL' 
          ? exitPrice - (pnl / qty)
          : exitPrice + (pnl / qty);

        return {
          id: o.id,
          timestamp: o.created_at,
          symbol: o.symbol,
          type: o.order_type === 'SELL' ? 'LONG' : 'SHORT',
          quantity: qty,
          entryPrice: Number(entryPrice.toFixed(2)),
          exitPrice: Number(exitPrice.toFixed(2)),
          pnl: pnl,
          isAutoSettled: o.breach_reason?.includes('[SYSTEM]') || false,
          reason: o.breach_reason || 'Manual'
        };
      });

    // 6. CONSTRUCT SYNCED RESPONSE
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        identity: {
          id: targetUserId,
          email: targetEmail,
          fullName: profileRes.data?.full_name || 'N/A',
          role: profileRes.data?.role || 'student',
          isActive: profileRes.data?.is_active ?? true,
          isKycBlocked: profileRes.data?.is_kyc_blocked ?? false,
          classification: profileRes.data?.account_classification || 'evaluation',
          model: profileRes.data?.account_model || 'normal',
          marketType: profileRes.data?.market_type || 'indian'
        },
        financials: {
          cashBalance: Number(portfolioRes.data?.cash_balance || 0),
          highWaterMark: Number(portfolioRes.data?.high_water_mark || 0),
          openingBalanceToday: Number(portfolioRes.data?.opening_balance_today || portfolioRes.data?.high_water_mark || 0),
        },
        risk: {
          overallRiskLimit: Number(profileRes.data?.loss_limit_percentage || 0),
          dailyLossLimit: Number(profileRes.data?.daily_loss_limit_percentage || 0),
          perTradeLossLimit: Number(profileRes.data?.per_trade_loss_limit_percentage || 0),
          leverage: {
            equity: Number(leverageRes.data?.equity || 1),
            forex: Number(leverageRes.data?.currency || 1),
            commodity: Number(leverageRes.data?.commodity || 1)
          }
        },
        ledger: {
          executionStream: mappedExecutionStream,
          tradesLedger: completedTrades,
          pnlHistory: pnlRes.data || []
        }
      }
    });

  } catch (error: any) {
    console.error('[MASTER SYNC API] Critical Failure:', error.message);
    return NextResponse.json({ success: false, message: 'Internal bridge synchronization error.' }, { status: 500 });
  }
}
