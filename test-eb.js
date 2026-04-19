require('dotenv').config({path: '.env.local'});
const jose = require('jose');

const BASE_URL = 'https://api.enablebanking.com';

async function getEnableBankingToken() {
  const appId = process.env.ENABLE_BANKING_APP_ID;
  const privateKeyPem = process.env.ENABLE_BANKING_PRIVATE_KEY.replace(/\\n/g, '\n').trim();

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

async function fetchEB(endpoint, options = {}) {
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
    throw new Error(`EB Error: ${res.status} ${res.statusText} - ${errorBody}`);
  }

  return res.json();
}

async function run() {
  try {
    const accountId = '201afbb3-b1d7-46fd-9bb2-927abf472401';
    console.log(`Fetching balances for account: ${accountId}`);
    const balances = await fetchEB(`/accounts/${accountId}/balances`);
    console.log("Balances:", JSON.stringify(balances, null, 2));

    const dateFrom = new Date(Date.now() - 30 * 86400 * 1000).toISOString().split('T')[0];
    console.log(`Fetching txs from ${dateFrom}`);
    const txs = await fetchEB(`/accounts/${accountId}/transactions?date_from=${dateFrom}`);
    console.log("Transactions count:", txs.transactions?.booked?.length);
    console.log("First transaction:", JSON.stringify(txs.transactions?.booked?.[0], null, 2));
  } catch (err) {
    console.error(err.message);
  }
}

run();
