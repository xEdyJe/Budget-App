require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: expenses } = await supabase.from('expenses').select('*').limit(1);
  console.log("EXPENSES:", expenses);

  const { data: transactions } = await supabase.from('transactions').select('*').limit(1);
  console.log("TRANSACTIONS:", transactions);
  
  const { data: card_balances } = await supabase.from('card_balances').select('*').limit(1);
  console.log("CARD BALANCES:", card_balances);
  
  const { data: work_days } = await supabase.from('work_days').select('*').limit(1);
  console.log("WORK DAYS:", work_days);
}

main().catch(console.error);
