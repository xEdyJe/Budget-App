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
    const tranzactiiNoi = await parsePluxeeEmails(integration.access_token, userId);

    if (tranzactiiNoi.length === 0) {
      return NextResponse.json({ message: "Nu s-au găsit tranzacții noi." });
    }

    // 3. Le salvăm în tabela 'transactions' (folosim upsert ca să nu duplicăm)
    const { error: dbError } = await supabase
      .from('transactions')
      .upsert(tranzactiiNoi, { onConflict: 'external_id' });

    if (dbError) throw dbError;

    return NextResponse.json({ 
      success: true, 
      count: tranzactiiNoi.length,
      data: tranzactiiNoi 
    });

  } catch (error: any) {
    console.error("🔴 EROARE SYNC GMAIL:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}