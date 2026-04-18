import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBalances, getTransactions } from '@/lib/enablebanking';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    // 1. Fetch linked accounts
    const { data: accounts } = await supabase
      .from('enable_banking_accounts')
      .select('*')
      .eq('user_id', userId);

    if (!accounts || accounts.length === 0) return NextResponse.json({ message: "No linked accounts" });

    let addedExpenses = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];

    for (const acc of accounts) {
      // 2. Sync Balances (for both main and savings)
      const balanceData = await getBalances(acc.account_uid);
      const bookedBalance = balanceData.balances.find((b: any) => b.balance_type === 'CLBD');
      
      if (bookedBalance) {
         await supabase.from('card_balances').upsert({
           user_id: userId,
           card: acc.type, // 'main' or 'savings'
           balance: parseFloat(bookedBalance.balance_amount.amount),
           updated_at: new Date().toISOString()
         }, { onConflict: 'card' });
      }

      // 3. Sync Transactions (ONLY for main account)
      if (acc.type === 'main') {
        const txData = await getTransactions(acc.account_uid, dateFrom);
        const bookedTx = txData.transactions?.booked || [];

        for (const tx of bookedTx) {
          const amount = parseFloat(tx.transaction_amount.amount);
          
          // Only map negative amounts (expenses)
          if (amount < 0) {
            const expenseName = tx.creditor_name || tx.remittance_information_unstructured?.join(' ') || 'Tranzacție Necunoscută';
            
            const { error } = await supabase.from('expenses').insert({
              user_id: userId,
              name: expenseName,
              amount: Math.abs(amount),
              category: 'other', // Let AI chatbot update this later
              card: 'main',
              date: tx.booking_date,
              source: 'gocardless', // Keeping this enum value to avoid breaking existing DB schemas, or update enum if you wish
              external_id: tx.transaction_id
            });
            
            // Ignore uniqueness constraint errors
            if (!error) addedExpenses++;
          }
        }
      }
    }

    return NextResponse.json({ success: true, added: addedExpenses });

  } catch (error: any) {
    // If we catch a 401, tell the frontend to show the "Reconnect ING" button
    if (error.message === 'EB_UNAUTHORIZED') {
      return NextResponse.json({ error: "needs_reconnect" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}