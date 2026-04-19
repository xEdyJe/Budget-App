import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/enablebanking';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  console.log("🟢 CALLBACK INIȚIAT");
  const url = new URL(req.url);
  const stateQuery = url.searchParams.get('state');

  const savedState = cookies().get('eb_state')?.value;
  const sessionId = cookies().get('eb_session_id')?.value;

  console.log("🔍 State primit de la bancă:", stateQuery);
  console.log("🔍 State din Cookie intern:", savedState);
  console.log("🔍 Session ID:", sessionId);

  if (!stateQuery || stateQuery !== savedState || !sessionId) {
    console.error("🔴 EROARE: Cookie-urile s-au pierdut pe drum sau state-ul e invalid.");
    return NextResponse.redirect(new URL('/?error=invalid_state', req.url));
  }

  try {
    const userId = "a1063603-8032-453d-baee-4e1ccbfdb869"; 

    console.log("⏳ Apelăm Enable Banking pentru extragerea conturilor...");
    const sessionDetails = await getSession(sessionId);
    console.log("✅ Conturi primite de la bancă:", sessionDetails.accounts?.length);
    
    for (const acc of sessionDetails.accounts) {
      const isSavings = acc.name?.toLowerCase().includes('economii') || acc.name?.toLowerCase().includes('saving');
      const accountType = isSavings ? 'savings' : 'main';

      console.log(`💾 Încercăm salvarea contului: ${acc.name} (${acc.currency})`);

      const { error: dbError } = await supabase.from('enable_banking_accounts').upsert({
        user_id: userId,
        account_uid: acc.uid,
        account_name: acc.name,
        iban: acc.account_id?.iban,
        currency: acc.currency,
        type: accountType
      }, { onConflict: 'account_uid' });

      if (dbError) {
        console.error("🔴 EROARE BAZĂ DE DATE SUPABASE:", dbError);
      } else {
        console.log(`✅ Contul ${acc.name} a fost salvat cu succes!`);
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