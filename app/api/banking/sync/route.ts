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

    // Fetch swap_accounts setting
    const { data: settings } = await supabase.from('user_settings').select('swap_accounts').eq('user_id', userId).single();
    const shouldSwap = settings?.swap_accounts || false;

    for (const acc of accounts) {
      // Determinăm tipul cardului bazat pe nume, deoarece coloana "type" nu este expusă clar.
      let cardType = 'main';
      if (acc.account_name && (acc.account_name.toLowerCase().includes('economii') || acc.account_name.includes('2') || acc.account_name.toLowerCase().includes('savings'))) {
          cardType = 'savings';
      }

      // Supra-scriere manuală prin Swap_Accounts
      if (shouldSwap) {
          cardType = cardType === 'main' ? 'savings' : 'main';
      }

      // 2. Sync Balances (for both main and savings)
      const balanceData = await getBalances(acc.account_uid);
      const bookedBalance = balanceData.balances.find((b: any) => b.balance_type === 'CLBD') || balanceData.balances[0];
      
      if (bookedBalance) {
         await supabase.from('card_balances').upsert({
           user_id: userId,
           card: cardType, // 'main' or 'savings'
           balance: parseFloat(bookedBalance.balance_amount.amount),
           updated_at: new Date().toISOString()
         }, { onConflict: 'card' }).select(); // Am adaugat un mic workaround
      }

      // 3. Sync Transactions (ONLY for main account)
      if (cardType === 'main') {
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