import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Use Service Role for backend admin tasks, or pass user token for RLS
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json();

    // 1. Fetch user context from Supabase (Mocked extraction for brevity)
    const { data: balances } = await supabase.from('card_balances').select('*').eq('user_id', userId);
    
    const systemPrompt = `
      Ești asistentul financiar personal al utilizatorului. Răspunzi mereu în limba română, scurt și la obiect.
      Context financiar curent:
      - Sold Card Principal: ${balances?.find(b => b.card === 'main')?.balance || 0} RON
      - Sold Card Bonuri (Pluxee): ${balances?.find(b => b.card === 'voucher')?.balance || 0} RON
      
      Dacă utilizatorul îți cere să faci o acțiune (ex: adaugă o cheltuială, setează salariul), TREBUIE să incluzi un bloc JSON la finalul răspunsului tău pe un singur rând, în acest format:
      {"action": "add_expense", "name": "...", "amount": NUMBER, "category": "food|transport|entertainment|utilities|other", "card": "main|voucher"}
      {"action": "set_salary", "value": NUMBER, "month": "YYYY-MM"}
    `;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620', // Using the latest Sonnet model
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

   const firstContent = response.content[0];
const replyText = firstContent.type === 'text' ? firstContent.text : '';
    
    // 2. Parse potential JSON actions
    let actionResult = null;
    const jsonMatch = replyText.match(/\{.*"action".*\}/);
    
    if (jsonMatch) {
      const action = JSON.parse(jsonMatch[0]);
      // Execute DB action based on parsed JSON
      if (action.action === 'add_expense') {
        await supabase.from('expenses').insert({
          user_id: userId,
          name: action.name,
          amount: action.amount,
          category: action.category,
          card: action.card,
          date: new Date().toISOString().split('T')[0],
          source: 'manual'
        });
        actionResult = "Cheltuială adăugată cu succes în baza de date.";
      }
      // Implement other actions (set_salary, etc.) here
    }

    return NextResponse.json({ 
      text: replyText.replace(/\{.*"action".*\}/, ''), // Hide JSON from UI
      actionResult 
    });

  } catch (error) {
    return NextResponse.json({ error: 'Eroare la procesarea cererii' }, { status: 500 });
  }
}