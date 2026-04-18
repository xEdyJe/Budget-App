import { NextRequest, NextResponse } from 'next/server';
import { startAuthSession } from '@/lib/enablebanking';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    // Note: In production, validate Supabase session here first

    const state = crypto.randomUUID();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 180); // 180 days

    const authPayload = {
      access: {
        balances: true,
        transactions: true,
        valid_until: validUntil.toISOString()
      },
      aspsp: { name: "ING", country: "RO" },
      psu_type: "personal",
      redirect_url: "https://buget-personal.vercel.app/api/banking/callback",
      state: state
    };

    const sessionData = await startAuthSession(authPayload);

    // Store state and session_id in HTTP-only cookies for the callback
    cookies().set('eb_state', state, { httpOnly: true, secure: true, maxAge: 3600 });
    cookies().set('eb_session_id', sessionData.session_id, { httpOnly: true, secure: true, maxAge: 3600 });

    return NextResponse.redirect(sessionData.url);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}