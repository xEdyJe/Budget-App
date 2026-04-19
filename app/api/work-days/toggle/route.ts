import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { userId, date, hours } = await req.json();

    if (!userId || !date) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Check if the work day exists
    const { data: existingDay } = await supabase
      .from('work_days')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (existingDay) {
      // If it exists and hours is 0, delete it (toggle off based on our logic maybe? Or we just delete)
      // Actually let's assume if it exists we delete it to "toggle" it off.
      const { error } = await supabase
        .from('work_days')
        .delete()
        .eq('id', existingDay.id);
        
      if (error) throw error;
      
      return NextResponse.json({ success: true, action: 'removed' });
    } else {
      // Insert it
      const { error } = await supabase
        .from('work_days')
        .insert({
          user_id: userId,
          date: date, // YYYY-MM-DD
          hours_worked: hours || 8
        });
        
      if (error) throw error;
      
      return NextResponse.json({ success: true, action: 'added' });
    }
  } catch (error: any) {
    console.error('Error toggling work day:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
