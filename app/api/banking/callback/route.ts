import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession, getAccountDetails } from '@/lib/enablebanking';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const stateQuery = url.searchParams.get('state');
  const codeQuery = url.searchParams.get('code'); 

  const savedState = cookies().get('eb_state')?.value;
  const authId = cookies().get('eb_session_id')?.value; 

  if (!stateQuery || stateQuery !== savedState || !authId || !codeQuery) {
    return NextResponse.redirect(new URL('/?error=invalid_state', req.url));
  }

  try {
    const userId = "a1063603-8032-453d-baee-4e1ccbfdb869"; 

    // 1. Validăm sesiunea
    const newSession = await createSession(authId, codeQuery);
    const realSessionId = newSession.session_id;

    // 2. Extragem lista de ID-uri (String-uri)
    const sessionDetails = await getSession(realSessionId);
    
    // 3. Extragem detaliile PENTRU FIECARE ID
    for (const uid of sessionDetails.accounts) {
      console.log(`⏳ Cerem detalii complete pentru contul UID: ${uid}`);
      const acc = await getAccountDetails(uid);

      // Sistem de siguranță: unele bănci dau .name, altele .product, altele nimic
      const accountName = acc.name || acc.product || 'Cont ING';
      const isSavings = accountName.toLowerCase().includes('economii') || accountName.toLowerCase().includes('saving');
      const accountType = isSavings ? 'savings' : 'main';
      const iban = acc.account_id?.iban || 'Fără IBAN';
      const currency = acc.currency || 'RON';

      console.log(`💾 Salvăm în baza de date: ${accountName} (${currency}) cu IBAN ${iban}`);

      const { error: dbError } = await supabase.from('enable_banking_accounts').upsert({
        user_id: userId,
        account_uid: uid,       // Folosim string-ul curat primit la început
        account_name: accountName,
        iban: iban,
        currency: currency,
        type: accountType
      }, { onConflict: 'account_uid' });

      if (dbError) {
        console.error("🔴 EROARE DB:", dbError);
      }
    }

    cookies().delete('eb_state');
    cookies().delete('eb_session_id');

    return NextResponse.redirect(new URL('/?success=true', req.url));

  } catch (error) {
    console.error("🔴 EROARE FATALĂ CALLBACK:", error);
    return NextResponse.redirect(new URL('/?error=callback_failed', req.url));
  }
}