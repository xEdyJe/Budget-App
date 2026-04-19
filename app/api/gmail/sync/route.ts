import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parsePluxeeEmails } from '@/lib/gmail';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  const userId = "a1063603-8032-453d-baee-4e1ccbfdb869";

  try {
    // 1. Luăm token-ul Gmail din tabela integrations
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('access_token')
      .eq('user_id', userId)
      .eq('service_name', 'gmail')
      .single();

    if (intError || !integration) {
      return NextResponse.json({ error: "Gmail nu este conectat" }, { status: 400 });
    }

    // 2. Parsăm email-urile
    const { extractedData: tranzactiiNoi, latestBalance } = await parsePluxeeEmails(integration.access_token, userId);

    if (tranzactiiNoi.length === 0 && latestBalance === null) {
      return NextResponse.json({ message: "Nu s-au găsit tranzacții sau solduri noi." });
    }

    // 3. Le salvăm în tabela 'transactions' (folosim upsert ca să nu duplicăm)
    if (tranzactiiNoi.length > 0) {
      const { error: dbError } = await supabase
        .from('transactions')
        .upsert(tranzactiiNoi, { onConflict: 'external_id' });

      if (dbError) throw dbError;
    }

    // 4. Actualizăm Soldul Voucher direct din email, dacă l-am găsit
    if (latestBalance !== null) {
       const { error: balError } = await supabase.from('card_balances').upsert({
           user_id: userId,
           card: 'voucher',
           balance: latestBalance,
           updated_at: new Date().toISOString()
       }, { onConflict: 'card' }).select();
       
       if (balError) console.error("Eroare update sold voucher:", balError);
    }

    return NextResponse.json({ 
      success: true, 
      count: tranzactiiNoi.length,
      newBalance: latestBalance,
      data: tranzactiiNoi 
    });

  } catch (error: any) {
    console.error("🔴 EROARE SYNC GMAIL:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}