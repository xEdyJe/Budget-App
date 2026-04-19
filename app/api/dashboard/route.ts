import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 1. Fetch Balances
    const { data: balancesData } = await supabase
      .from('card_balances')
      .select('*')
      .eq('user_id', userId);

    const balances = {
      main: 0,
      savings: 0,
      voucher: 0
    };

    if (balancesData) {
      balances.main = balancesData.find((b: any) => b.card === 'main')?.balance || 0;
      balances.savings = balancesData.find((b: any) => b.card === 'savings')?.balance || 0;
      balances.voucher = balancesData.find((b: any) => b.card === 'voucher')?.balance || 0;
    }

    // 2. Fetch Expenses (ING - from 'expenses' table)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimit = thirtyDaysAgo.toISOString();

    const { data: expensesData } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', dateLimit);

    // 3. Fetch Transactions (Pluxee/Other - from 'transactions' table)
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      // Pluxee transactions have 'created_at' or 'date', depending on schema. 
      // Assuming they don't have a strict 'date' filter if we want all recent ones, or just pull last 100.
      .order('id', { ascending: false })
      .limit(100);

    // Merge expenses
    let unifiedExpenses: any[] = [];
    if (expensesData) unifiedExpenses = [...expensesData];
    
    if (transactionsData) {
      const pluxeeExpenses = transactionsData
        .filter((t: any) => t.amount < 0) // only expenses
        .map((t: any) => ({
          id: t.id,
          name: t.description,
          amount: Math.abs(t.amount),
          category: t.category || 'other',
          card: 'voucher', // Pluxee is voucher
          date: new Date().toISOString().split('T')[0], // we map if it lacks 'date'
          source: t.source || 'pluxee'
        }));
      unifiedExpenses = [...unifiedExpenses, ...pluxeeExpenses];
    }
    
    // sort by latest
    unifiedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 4. Fetch Work Days
    const { data: workDaysData } = await supabase
      .from('work_days')
      .select('date, hours_worked')
      .eq('user_id', userId);

    // 5. Fetch Settings
    const { data: settingsData } = await supabase
      .from('user_settings')
      .select('hourly_rate')
      .eq('user_id', userId)
      .single();

    return NextResponse.json({
      balances,
      expenses: unifiedExpenses,
      workDays: workDaysData || [],
      settings: settingsData || { hourly_rate: 35 } // default to 35
    });
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
