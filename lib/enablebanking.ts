import * as jose from 'jose';

const BASE_URL = 'https://api.enablebanking.com';

// 1. Generate JWT
export async function getEnableBankingToken(): Promise<string> {
  const appId = process.env.ENABLE_BANKING_APP_ID!;
  // Fix potential newline escaping issues from .env
  const privateKeyPem = process.env.ENABLE_BANKING_PRIVATE_KEY!.replace(/\\n/g, '\n');

  const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new jose.SignJWT({
    iss: appId,
    iat: now,
    exp: now + 3600, // 1 hour expiry
  })
    .setProtectedHeader({ alg: 'RS256', kid: appId })
    .sign(privateKey);

  return jwt;
}

// 2. Fetch Helper
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
    if (res.status === 401) throw new Error('EB_UNAUTHORIZED');
    throw new Error(`Enable Banking API Error: ${res.statusText}`);
  }
  return res.json();
}

// 3. API Wrappers
export const startAuthSession = (body: any) => fetchEB('/auth', { method: 'POST', body: JSON.stringify(body) });
export const getSession = (sessionId: string) => fetchEB(`/sessions/${sessionId}`);
export const getBalances = (accountUid: string) => fetchEB(`/accounts/${accountUid}/balances`);
export const getTransactions = (accountUid: string, dateFrom: string) => 
  fetchEB(`/accounts/${accountUid}/transactions?date_from=${dateFrom}`);