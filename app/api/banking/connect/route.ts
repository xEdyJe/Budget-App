import { NextRequest, NextResponse } from 'next/server';
import { startAuthSession, getEnableBankingToken } from '@/lib/enablebanking';
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
      redirect_url: "https://buget-personal-gkjbh4t0n-xedyjes-projects.vercel.app/api/banking/callback",
      state: state
    };

    const token = await getEnableBankingToken();
console.log('JWT:', token.substring(0, 100));

// Test direct
const testRes = await fetch('https://api.enablebanking.com/aspsps', {
  headers: { 'Authorization': `Bearer ${token}` }
});
console.log('Test status:', testRes.status);
const testData = await testRes.json();
console.log('Test response:', JSON.stringify(testData).substring(0, 200));

    const sessionData = await startAuthSession(authPayload);

    // Store state and session_id in HTTP-only cookies for the callback
    cookies().set('eb_state', state, { httpOnly: true, secure: true, maxAge: 3600 });
    cookies().set('eb_session_id', sessionData.session_id, { httpOnly: true, secure: true, maxAge: 3600 });

    return NextResponse.redirect(sessionData.url);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}