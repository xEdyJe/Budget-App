import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Inițializăm Gemini și Supabase
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    // Preluăm messages (pentru text) și imageBase64 (pentru poză)
    const { messages, message, imageBase64, userId } = await req.json();

    // 1. Preluăm contextul financiar curent
    const { data: balances } = await supabase.from('card_balances').select('*').eq('user_id', userId);
    const { data: goals } = await supabase.from('goals').select('*').eq('user_id', userId);

    // 2. Construim "creierul" (Instrucțiunile de bază)
    // Am adăugat "update_hourly_rate" la lista ta de acțiuni posibile!
    const systemPrompt = `
      Ești asistentul financiar personal al utilizatorului. Răspunzi mereu în limba română, scurt, prietenos și la obiect.
      Context financiar curent:
      - Sold Card Principal: ${balances?.find((b: any) => b.card === 'main')?.balance || 0} RON
      - Sold Card Bonuri (Pluxee): ${balances?.find((b: any) => b.card === 'voucher')?.balance || 0} RON
      - Obiective Financiare (Goals): ${goals && goals.length > 0 ? goals.map((g: any) => `${g.title}: ${g.saved_amount} / ${g.target_amount} RON (până pe ${g.deadline})`).join(', ') : 'Niciun obiectiv activ.'}
      
      REGULĂ STRICTĂ NECELIAZĂ: Când procesezi un fluturaș de salariu, sau adaugi cheltuieli, sau setezi obiective la cererea utilizatorului, TU EȘTI OBLIGAT să adaugi un bloc JSON la finalul textului. FĂRĂ ACEST JSON, BAZA DE DATE NU SE ACTUALIZEAZĂ.
      Lipește JSON-ul la final:
      {"action": "update_hourly_rate", "rate": NUMAR}
      SAU
      {"action": "add_expense", "name": "...", "amount": NUMAR, "category": "food", "card": "main"}
      SAU (Pentru adăugarea unui nou obiectiv):
      {"action": "add_goal", "title": "Numele dorintei", "amount": NUMAR, "deadline": "YYYY-MM-DD"}
      
      Nu folosi caractere markdown \`\`\` în jurul JSON-ului. Doar textul brut!
    `;

    // 3. Convertim istoricul mesajelor într-un text clar pentru Gemini
    const conversationHistory = messages
      ? messages.map((m: any) => `${m.role === 'user' ? 'Utilizator' : 'Asistent'}: ${m.content}`).join('\n')
      : `Utilizator: ${message}`;

    const finalPrompt = `${systemPrompt}\n\nIstoric conversație:\n${conversationHistory}\n\nRăspunde acum la ultimul mesaj:`;

    const parts: any[] = [finalPrompt];

    // 4. Dacă am primit o poză din Frontend, o atașăm la cerere
    if (imageBase64) {
      const mimeType = imageBase64.split(';')[0].split(':')[1];
      const base64Data = imageBase64.split(',')[1];
      parts.push({
        inlineData: { data: base64Data, mimeType: mimeType }
      });
    }

    // 5. Apelăm Gemini 2.5 Flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(parts);
    const replyText = result.response.text();

    // 6. Căutăm acțiunea ascunsă (Regex avansat pentru multiline)
    let actionResult = null;
    let newHourlyRate = null;
    const jsonMatch = replyText.match(/\{[\s\S]*"action"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const action = JSON.parse(jsonMatch[0]);

        // Acțiunea 1: Adaugă cheltuială
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

        // Acțiunea 2: Setează tariful orar (din fluturașul de salariu)
        else if (action.action === 'update_hourly_rate') {
          await supabase.from('user_settings').upsert({
            user_id: userId,
            hourly_rate: action.rate,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

          actionResult = `Am actualizat tariful tău orar la ${action.rate} RON/oră!`;
          newHourlyRate = action.rate; // Trimitem spre frontend ca să dea refresh
        }

        // Actiunea 3: Creare Objective / Goal nou
        else if (action.action === 'add_goal') {
          await supabase.from('goals').insert({
            user_id: userId,
            title: action.title,
            target_amount: action.amount,
            deadline: action.deadline
          });
          actionResult = `Obiectivul '${action.title}' a fost creat cu succes! Mult noroc la economisit!`;
        }

      } catch (e) {
        console.error("Eroare la parsarea sau executarea acțiunii JSON:", e);
      }
    }

    // 7. Trimitem răspunsul către Frontend (fără JSON-ul ascuns)
    return NextResponse.json({
      text: replyText.replace(/\{[\s\S]*"action"[\s\S]*\}/, '').replace(/```json/g, '').replace(/```/g, '').trim(),
      actionResult,
      newHourlyRate
    });

  } catch (error: any) {
    console.error("Eroare la procesarea cererii Gemini:", error);
    return NextResponse.json({
      text: `Eroare Tehnică Server: ${error.message || 'Necunoscută'}. Verifică consola terminalului!`
    }, { status: 500 });
  }
}