import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { userId, title, target_amount, deadline, goalId, add_amount } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (goalId && add_amount !== undefined) {
       // Suntem in modul "Adauga fonduri"
       const { data: existing } = await supabase.from('goals').select('saved_amount').eq('id', goalId).single();
       if (!existing) return NextResponse.json({ error: 'Goal Not Found' }, { status: 404 });
       
       const noileFonduri = Number(existing.saved_amount) + Number(add_amount);
       await supabase.from('goals').update({ saved_amount: noileFonduri }).eq('id', goalId);
       return NextResponse.json({ success: true, updated: noileFonduri });
    }

    // Altfel inseram Goal nou
    const { error } = await supabase.from('goals').insert({
      user_id: userId,
      title,
      target_amount,
      deadline
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
