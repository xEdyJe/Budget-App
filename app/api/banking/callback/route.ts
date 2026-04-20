import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/enablebanking';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

    // 2. Tragem "cheile" (UID-urile simple) de la ING
    console.log("⏳ Tragem lista de chei...");
    const sessionDetails = await getSession(realSessionId);
    
    // Asigurăm-ne că e array-ul de string-uri pe care l-am văzut în log-ul tău
    const accountUids = sessionDetails.accounts || []; 
    console.log(`✅ Am primit ${accountUids.length} chei de cont.`);

    // 3. Salvăm cheile direct în baza de date
    let counter = 1;
    for (const uid of accountUids) {
      if (typeof uid !== 'string') continue; // Verificare de siguranță

      // Le dăm un nume temporar. Primul e de obicei contul curent, al doilea economii.
      const accountName = `Cont ING ${counter}`;
      const accountType = counter === 1 ? 'main' : 'savings';

      console.log(`💾 Salvăm în baza de date UID-ul: ${uid}`);

      const { error: dbError } = await supabase.from('enable_banking_accounts').upsert({
        user_id: userId,
        account_uid: uid,
        account_name: accountName,
        iban: 'Ascuns de bancă',
        currency: 'RON',
        type: accountType
      }, { onConflict: 'account_uid' });

      if (dbError) {
        console.error("🔴 EROARE DB:", dbError);
      } else {
        console.log(`✅ Cont salvat cu succes: ${uid}`);
      }
      
      counter++;
    }

    cookies().delete('eb_state');
    cookies().delete('eb_session_id');

    return NextResponse.redirect(new URL('/?success=true', req.url));

  } catch (error) {
    console.error("🔴 EROARE FATALĂ CALLBACK:", error);
    return NextResponse.redirect(new URL('/?error=callback_failed', req.url));
  }
}