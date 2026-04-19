export async function parsePluxeeEmails(accessToken: string, userId: string) {
  // Căutăm email-uri din ultima lună de la Pluxee
  const query = 'from:pluxee.ro (incarcat OR platit OR suma) newer_than:30d';
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const { messages } = await listRes.json();
  if (!messages) return { extractedData: [], latestBalance: null };

  const extractedData = [];
  let latestBalance: number | null = null;
  let latestDate = 0;
  
  for (const msg of messages) {
    const emailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const email = await emailRes.json();
    
    const content = email.snippet + " " + (email.payload?.body?.data || "");
    const emailTimestamp = parseInt(email.internalDate);

    // 1. Detectăm SOLDUL rămas
    const matchSold = content.match(/(?:sold|disponibil|ramasa)(?:[^0-9]{1,30})(\d+[.,]\d{2})\s*(RON|lei)/i);
    if (matchSold && emailTimestamp > latestDate) {
       latestBalance = parseFloat(matchSold[1].replace(',', '.'));
       latestDate = emailTimestamp;
    }

    // 2. Extragem corect suma tranzacției / încărcării
    let amount = 0;
    const matchDirect = content.match(/(?:valoare de|suma de|platit|achitat|cheltuit|alimentat)(?:[^0-9]{1,30})(\d+[.,]\d{2})\s*(RON|lei)/i);
    
    if (matchDirect) {
        amount = parseFloat(matchDirect[1].replace(',', '.'));
    } else {
        const matchesSume = [...content.matchAll(/(\d+[.,]\d{2})\s*(RON|lei)/gi)];
        if (matchesSume.length >= 2) {
             const sume = matchesSume.map(m => parseFloat(m[1].replace(',', '.')));
             amount = Math.min(...sume); // Deductem suma mai mică ca fiind plata
        } else if (matchesSume.length === 1) {
             amount = parseFloat(matchesSume[0][1].replace(',', '.'));
        }
    }
    
    // 3. Detectăm dacă e ÎNCĂRCARE sau PLATĂ
    const isReload = content.toLowerCase().includes('incarcat') || content.toLowerCase().includes('alimentat') || content.toLowerCase().includes('primiti');
    
    // 4. Comercianți
    const merchantMatch = content.match(/(?:la|comerciantul)\s+([^,.]+)/i);

    if (amount > 0) {
      extractedData.push({
        user_id: userId,
        external_id: msg.id,
        amount: isReload ? amount : -amount, 
        description: isReload ? 'Încărcare Tichete Pluxee' : `Plată: ${merchantMatch ? merchantMatch[1].trim() : 'Comerciant Pluxee'}`,
        category: 'other',
        source: 'Pluxee',
        date: new Date(emailTimestamp).toISOString()
      });
    }
  }
  
  return { extractedData, latestBalance };
}