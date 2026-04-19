import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSessionAccounts } from '@/lib/enablebanking';
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

    // 1. Validăm sesiunea cu parola de la ING
    const newSession = await createSession(authId, codeQuery);
    const realSessionId = newSession.session_id;

    // 2. Extragem detaliile complete folosind noul endpoint!
    console.log("⏳ Cerem detaliile conturilor pentru sesiunea:", realSessionId);
    
    const sessionAccountsData = await getSessionAccounts(realSessionId);
    // În funcție de cum ne dă banca, luăm array-ul direct sau din proprietatea 'accounts'
    const accountsArray = sessionAccountsData.accounts || sessionAccountsData; 

    // 3. Iterăm prin conturile primite și le salvăm direct
    for (const acc of accountsArray) {
      // Un sistem de siguranță ca să nu mai dăm de 'undefined'
      const accountUid = acc.uid || acc.id; 
      if (!accountUid) continue;

      const accountName = acc.name || acc.product || 'Cont ING';
      const isSavings = accountName.toLowerCase().includes('economii') || accountName.toLowerCase().includes('saving');
      const accountType = isSavings ? 'savings' : 'main';
      const iban = acc.account_id?.iban || acc.iban || 'Fără IBAN';
      const currency = acc.currency || 'RON';

      console.log(`💾 Salvăm: ${accountName} (${currency}) cu IBAN ${iban}`);

      const { error: dbError } = await supabase.from('enable_banking_accounts').upsert({
        user_id: userId,
        account_uid: accountUid,
        account_name: accountName,
        iban: iban,
        currency: currency,
        type: accountType
      }, { onConflict: 'account_uid' });

      if (dbError) {
        console.error("🔴 EROARE DB:", dbError);
      } else {
        console.log(`✅ Cont salvat cu succes: ${accountName}`);
      }
    }

    // Curățăm cookie-urile că ne-am terminat treaba
    cookies().delete('eb_state');
    cookies().delete('eb_session_id');

    return NextResponse.redirect(new URL('/?success=true', req.url));

  } catch (error) {
    console.error("🔴 EROARE FATALĂ CALLBACK:", error);
    return NextResponse.redirect(new URL('/?error=callback_failed', req.url));
  }
}