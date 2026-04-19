import { NextRequest, NextResponse } from 'next/server';
import { startAuthSession } from '@/lib/enablebanking';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const state = crypto.randomUUID();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 180);

    const authPayload = {
      access: {
        balances: true,
        transactions: true,
        valid_until: validUntil.toISOString()
      },
      aspsp: { name: "ING", country: "RO" },
      psu_type: "personal",
      redirect_url: `${process.env.NEXTAUTH_URL}/api/banking/callback`,
      state: state
    };

    const sessionData = await startAuthSession(authPayload);

    cookies().set('eb_state', state, { httpOnly: true, secure: true, maxAge: 3600 });
    cookies().set('eb_session_id', sessionData.session_id, { httpOnly: true, secure: true, maxAge: 3600 });

    return NextResponse.redirect(sessionData.url);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}