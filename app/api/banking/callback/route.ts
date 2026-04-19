import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession, getAllAccounts } from '@/lib/enablebanking';
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

    // 2. Extragem lista de ID-uri de la sesiune
    const sessionDetails = await getSession(realSessionId);
    const accountUids = sessionDetails.accounts || [];
    
    // 3. Descărcăm TOATE detaliile conturilor de la bancă
    console.log("⏳ Cerem detaliile tuturor conturilor...");
    const allAccountsRes = await getAllAccounts();
    const allAccounts = allAccountsRes.accounts || [];

    // 4. Potrivim ID-urile cu detaliile și salvăm
    for (const uid of accountUids) {
      // Căutăm contul nostru în lista mare primită de la bancă
      const acc = allAccounts.find((a: any) => a.uid === uid);

      if (!acc) {
        console.error(`🔴 Nu s-au găsit detalii pentru UID-ul: ${uid}`);
        continue; // Trecem la următorul dacă nu-l găsește
      }

      const accountName = acc.name || acc.product || 'Cont ING';
      const isSavings = accountName.toLowerCase().includes('economii') || accountName.toLowerCase().includes('saving');
      const accountType = isSavings ? 'savings' : 'main';
      const iban = acc.account_id?.iban || 'Fără IBAN';
      const currency = acc.currency || 'RON';

      console.log(`💾 Salvăm în baza de date: ${accountName} (${currency}) cu IBAN ${iban}`);

      const { error: dbError } = await supabase.from('enable_banking_accounts').upsert({
        user_id: userId,
        account_uid: uid,
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

    cookies().delete('eb_state');
    cookies().delete('eb_session_id');

    return NextResponse.redirect(new URL('/?success=true', req.url));

  } catch (error) {
    console.error("🔴 EROARE FATALĂ CALLBACK:", error);
    return NextResponse.redirect(new URL('/?error=callback_failed', req.url));
  }
}