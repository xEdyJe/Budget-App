import { NextRequest, NextResponse } from 'next/server';
import { startAuthSession } from '@/lib/enablebanking';
import { cookies } from 'next/headers';
import crypto from 'crypto';

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
      // 👇 IMPORTANT: Pune link-ul tău real de la Vercel aici în loc de textul ăsta
      redirect_url: "https://buget-personal.vercel.app/api/banking/callback",
      state: state
    };

    // Apelăm funcția pe care am reparat-o în lib/enablebanking.ts
    const sessionData = await startAuthSession(authPayload);

    // Salvăm cookie-urile pentru securitate
    cookies().set('eb_state', state, { httpOnly: true, secure: true, maxAge: 3600 });
    cookies().set('eb_session_id', sessionData.session_id, { httpOnly: true, secure: true, maxAge: 3600 });

    // Redirecționăm utilizatorul spre portalul băncii
    return NextResponse.redirect(sessionData.url);

  } catch (error: any) {
    console.error("Eroare la generarea sesiunii de auth:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}