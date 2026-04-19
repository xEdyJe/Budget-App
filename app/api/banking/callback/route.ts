import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/enablebanking';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  console.log("🟢 CALLBACK INIȚIAT");
  const url = new URL(req.url);
  const stateQuery = url.searchParams.get('state');

  const savedState = cookies().get('eb_state')?.value;
  const authId = cookies().get('eb_session_id')?.value; // Acesta e authorization_id-ul nostru

  console.log("🔍 State primit:", stateQuery);
  console.log("🔍 Auth ID:", authId);

  if (!stateQuery || stateQuery !== savedState || !authId) {
    console.error("🔴 EROARE: Cookie-uri lipsă sau state invalid.");
    return NextResponse.redirect(new URL('/?error=invalid_state', req.url));
  }

  try {
    const userId = "a1063603-8032-453d-baee-4e1ccbfdb869"; 

    console.log("⏳ Pas 1: Schimbăm chitanța pe o sesiune validă...");
    // Aici trimitem băncii url-ul complet cu care ne-a întors (req.url)
    const newSession = await createSession(authId, req.url);
    const realSessionId = newSession.session_id;

    console.log("⏳ Pas 2: Apelăm Enable Banking pentru extragerea conturilor...");
    const sessionDetails = await getSession(realSessionId);
    console.log("✅ Conturi primite:", sessionDetails.accounts?.length);
    
    for (const acc of sessionDetails.accounts) {
      const isSavings = acc.name?.toLowerCase().includes('economii') || acc.name?.toLowerCase().includes('saving');
      const accountType = isSavings ? 'savings' : 'main';

      console.log(`💾 Salvăm: ${acc.name} (${acc.currency})`);

      const { error: dbError } = await supabase.from('enable_banking_accounts').upsert({
        user_id: userId,
        account_uid: acc.uid,
        account_name: acc.name,
        iban: acc.account_id?.iban,
        currency: acc.currency,
        type: accountType
      }, { onConflict: 'account_uid' });

      if (dbError) {
        console.error("🔴 EROARE DB:", dbError);
      } else {
        console.log(`✅ Cont salvat: ${acc.name}`);
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