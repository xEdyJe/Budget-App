export async function parsePluxeeEmails(accessToken: string, userId: string) {
  // Căutăm email-uri din ultima lună de la Pluxee
  const query = 'from:pluxee.ro (incarcat OR platit OR suma) newer_than:30d';
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const { messages } = await listRes.json();
  if (!messages) return [];

  const extractedData = [];
  
  for (const msg of messages) {
    const emailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const email = await emailRes.json();
    
    // Luăm snippet-ul ȘI body-ul (decodat din base64 dacă e nevoie, dar snippet e de obicei 90% ok)
    const content = email.snippet + " " + (email.payload?.body?.data || "");

    // 1. Căutăm suma: prinde "440,00 RON", "12.50 lei", etc.
    const amountMatch = content.match(/(\d+[.,]\d{2})\s*(RON|lei)/i);
    
    // 2. Detectăm dacă e ÎNCĂRCARE sau PLATĂ
    const isReload = content.toLowerCase().includes('incarcat') || content.toLowerCase().includes('alimentat');
    
    // 3. Încercăm să găsim comerciantul (doar pentru plăți)
    const merchantMatch = content.match(/(?:la|comerciantul)\s+([^,.]+)/i);

    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(',', '.'));
      
      extractedData.push({
        user_id: userId,
        external_id: msg.id,
        // Dacă e încărcare e cu PLUS, dacă e plată e cu MINUS
        amount: isReload ? amount : -amount, 
        description: isReload ? 'Încărcare Tichete Pluxee' : `Plată: ${merchantMatch ? merchantMatch[1].trim() : 'Comerciant Pluxee'}`,
        category: 'Food',
        source: 'Pluxee',
        date: new Date(parseInt(email.internalDate)).toISOString()
      });
    }
  }
  
  return extractedData;
}