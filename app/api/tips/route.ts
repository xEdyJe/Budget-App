import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    // 1. Fetch simplified context
    const { data: balancesData } = await supabase.from('card_balances').select('card, balance').eq('user_id', userId);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimit = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: expenses } = await supabase.from('expenses').select('amount, category').eq('user_id', userId).gte('date', dateLimit);
    const { data: transactions } = await supabase.from('transactions').select('amount, category').eq('user_id', userId).lt('amount', 0).gte('created_at', dateLimit);

    const totalExtExp = (expenses||[]).reduce((sum: number, e: any) => sum + e.amount, 0) + 
                        (transactions||[]).reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
                        
    const mainBalance = balancesData?.find((b: any) => b.card === 'main')?.balance || 0;
    const savingsBalance = balancesData?.find((b: any) => b.card === 'savings')?.balance || 0;

    const summary = `
    Am ${mainBalance} RON pe cardul principal, ${savingsBalance} RON in contul de economii. 
    In ultimele 30 zile am cheltuit aproximativ ${totalExtExp.toFixed(0)} RON în total.
    `;

    // 2. Apelăm Gemini pentru Daily Tips
    const systemPrompt = `
      Ești un consilier financiar personal empatic și inteligent. 
      Vreau să generezi un "Daily Tip" pentru mine pe baza contextului meu financiar actual. 
      Trebuie să oferi 1-2 propoziții cu un sfat clar, scurt, și motivant, eventual un "Daily Goal" legat de cum să salvez niște bani sau să-mi optimizez bugetul.
      Folosește un ton optimist.
      
      Format cerut STRICT: returnează doar textul sfatului, fără markdown, fără prefixe precum "Iată un sfat:".
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([systemPrompt, "Contextul meu:\n" + summary]);
    
    return NextResponse.json({ tip: result.response.text().trim() });
  } catch (error: any) {
    console.error("Eroare generare tips:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
