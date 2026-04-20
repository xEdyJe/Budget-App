import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Luăm setarea curentă
    const { data: settings } = await supabase
      .from('user_settings')
      .select('swap_accounts')
      .eq('user_id', userId)
      .single();

    const newMode = !(settings?.swap_accounts || false);

    // Salvăm noul status
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      swap_accounts: newMode,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (error) throw error;

    return NextResponse.json({ success: true, swap_accounts: newMode });
  } catch (error: any) {
    console.error('Error toggling swap_accounts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
