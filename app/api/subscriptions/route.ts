import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId, name, amount, due_day, id } = body;

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (action === 'add') {
      const { error } = await supabase.from('subscriptions').insert({
        user_id: userId,
        name,
        amount,
        due_day
      });
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Subscription added' });
    } 
    
    else if (action === 'delete') {
      const { error } = await supabase.from('subscriptions').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Subscription deleted' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error handling subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
