import * as jose from 'jose';

const BASE_URL = 'https://api.enablebanking.com';

export async function getEnableBankingToken(): Promise<string> {
  const appId = process.env.ENABLE_BANKING_APP_ID!;
  const privateKeyPem = process.env.ENABLE_BANKING_PRIVATE_KEY!
    .replace(/\\n/g, '\n')
    .trim();

  const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: appId })
    .setIssuer(appId)
    .setAudience('api.enablebanking.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  return jwt;
}

async function fetchEB(endpoint: string, options: RequestInit = {}) {
  const token = await getEnableBankingToken();
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    // Printăm eroarea exactă în consola din Vercel ca să o putem citi
    console.error("🔴 EROARE ENABLE BANKING DETALIATĂ:", res.status, errorBody);
    
    if (res.status === 401) throw new Error('EB_UNAUTHORIZED');
    throw new Error(`Enable Banking API Error: ${res.statusText}`);
  }

  return res.json();
}

export const startAuthSession = (body: unknown) =>
  fetchEB('/auth', { method: 'POST', body: JSON.stringify(body) });

// ADAUGĂ ACEASTĂ FUNCȚIE ÎN lib/enablebanking.ts (jos de tot)
export const createSession = (authorizationId: string, code: string) =>
  fetchEB('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      authorization_id: authorizationId,
      code: code // Aici trimitem codul cerut de bancă!
    }),
  });

export const getSession = (sessionId: string) =>
  fetchEB(`/sessions/${sessionId}`);

export const getBalances = (accountUid: string) =>
  fetchEB(`/accounts/${accountUid}/balances`);

export const getTransactions = (accountUid: string, dateFrom: string) =>
  fetchEB(`/accounts/${accountUid}/transactions?date_from=${dateFrom}`);
// Adaugă asta jos de tot în lib/enablebanking.ts
// Cerem toată lista de conturi (nu doar unul singur)
// Cerem detaliile conturilor STRICT pentru sesiunea noastră activă
export const getSessionAccounts = (sessionId: string) => 
  fetchEB(`/sessions/${sessionId}/accounts`);