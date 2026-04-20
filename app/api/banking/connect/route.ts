import { NextRequest, NextResponse } from 'next/server';
import { startAuthSession } from '@/lib/enablebanking';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
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
      // 👇 IMPORTANT: Pune link-ul tău real de la Vercel aici
      redirect_url: "https://buget-personal.vercel.app/api/banking/callback",
      state: state
    };

    const sessionData = await startAuthSession(authPayload);
    
    // Radar
    console.log("🟢 DATE SESIUNE ENABLE BANKING:", sessionData); 

    // 👇 AICI ERA SECRETUL! Banca îi spune "authorization_id"
    const sessionIdToSave = sessionData.authorization_id;

    // Blindăm cookie-urile
    const cookieOptions = { 
        httpOnly: true, 
        secure: true, 
        maxAge: 3600, 
        path: '/', 
        sameSite: 'lax' as const 
    };

    cookies().set('eb_state', state, cookieOptions);
    cookies().set('eb_session_id', sessionIdToSave, cookieOptions);

    return NextResponse.redirect(sessionData.url);

  } catch (error: any) {
    console.error("Eroare la generarea sesiunii de auth:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}