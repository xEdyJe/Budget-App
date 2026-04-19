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
      // 👇 Pune link-ul tău real de la Vercel aici
      redirect_url: "https://buget-personal.vercel.app/api/banking/callback",
      state: state
    };

    const sessionData = await startAuthSession(authPayload);
    
    // 1. Radar nou: Printăm exact ce ne-a returnat banca ca să vedem cheile
    console.log("🟢 DATE SESIUNE ENABLE BANKING:", sessionData); 

    // 2. Acoperim ambele variante de nume pe care le-ar putea returna API-ul
    const sessionIdToSave = sessionData.session_id || sessionData.id;

    // 3. Blindăm cookie-urile împotriva ștergerii de către browser
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