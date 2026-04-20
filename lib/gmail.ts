function decodeBase64(data: string) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

function getEmailBody(payload: any): string {
  let body = "";
  if (payload.body?.data) {
    body += decodeBase64(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      body += getEmailBody(part);
    }
  }
  return body;
}

export async function parsePluxeeEmails(accessToken: string, userId: string) {
  // Căutăm email-uri din ultima lună de la Pluxee cu un query mai larg
  const query = 'from:pluxee.ro (incarcat OR alimentat OR platit OR suma OR reincarcare OR confirmat OR disponibil) newer_than:30d';
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
    
    // Decodificăm corpul email-ului complet
    const bodyContent = getEmailBody(email.payload);
    const content = (email.snippet + " " + bodyContent).replace(/\s+/g, ' ');
    const emailTimestamp = parseInt(email.internalDate);

    // 1. Detectăm SOLDUL rămas (Regex mai flexibil)
    const matchSold = content.match(/(?:sold|disponibil|ramasa|total|noua valoare)(?:[^0-9]{1,50})(\d+[.,]\d{2})\s*(RON|lei)/i);
    if (matchSold && emailTimestamp > latestDate) {
       latestBalance = parseFloat(matchSold[1].replace(',', '.'));
       latestDate = emailTimestamp;
    }

    // 2. Extragem suma tranzacției
    let amount = 0;
    const matchDirect = content.match(/(?:valoare de|suma de|platit|achitat|cheltuit|alimentat|incarcat|reincarcat)(?:[^0-9]{1,30})(\d+[.,]\d{2})\s*(RON|lei)/i);
    
    if (matchDirect) {
        amount = parseFloat(matchDirect[1].replace(',', '.'));
    } else {
        const matchesSume = [...content.matchAll(/(\d+[.,]\d{2})\s*(RON|lei)/gi)];
        if (matchesSume.length >= 2) {
             const sume = matchesSume.map(m => parseFloat(m[1].replace(',', '.')));
             // De obicei, într-un email de plată, suma mai mică e plata și cea mai mare e noul sold
             // Excludem soldul dacă l-am detectat deja
             const filteredSume = latestBalance ? sume.filter(s => s !== latestBalance) : sume;
             amount = filteredSume.length > 0 ? Math.min(...filteredSume) : Math.min(...sume);
        } else if (matchesSume.length === 1) {
             amount = parseFloat(matchesSume[0][1].replace(',', '.'));
        }
    }
    
    // 3. Detectăm dacă e ÎNCĂRCARE sau PLATĂ
    const contentLower = content.toLowerCase();
    const isReload = contentLower.includes('incarcat') || contentLower.includes('alimentat') || contentLower.includes('primiti') || contentLower.includes('reincarcare');
    
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