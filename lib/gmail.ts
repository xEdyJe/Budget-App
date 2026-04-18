export async function parsePluxeeEmails(accessToken: string, userId: string) {
  // Use Gmail API to search
  const query = 'from:noreply@pluxee.ro newer_than:30d';
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const { messages } = await listRes.json();
  
  if (!messages) return [];

  const expenses = [];
  
  for (const msg of messages) {
    const emailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const email = await emailRes.json();
    
    // Find snippet or body
    const text = email.snippet; // Often enough for Pluxee emails
    
    // Regex tailored for Pluxee RO: "Suma: 34,50 RON" or "Ai platit 12.00 lei la Auchan"
    const amountMatch = text.match(/(\d+[.,]\d{2})\s*(RON|lei)/i);
    const merchantMatch = text.match(/la\s+([^.]+)/i); // Simple extraction, can be refined
    
    if (amountMatch) {
      expenses.push({
        user_id: userId,
        external_id: msg.id,
        amount: parseFloat(amountMatch[1].replace(',', '.')),
        name: merchantMatch ? merchantMatch[1].trim() : 'Comerciant Pluxee',
        category: 'food', // Voucher defaults to food
        card: 'voucher',
        source: 'gmail',
        date: new Date(parseInt(email.internalDate)).toISOString().split('T')[0]
      });
    }
  }
  
  return expenses;
}