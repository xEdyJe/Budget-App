import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';

export async function GET(req: NextRequest) {
  try {
    const appId = process.env.ENABLE_BANKING_APP_ID!;
    const privateKeyPem = process.env.ENABLE_BANKING_PRIVATE_KEY!
      .replace(/\\n/g, '\n')
      .trim();

    const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');
    const now = Math.floor(Date.now() / 1000);

    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: appId })
      .setIssuer(appId)
      .setAudience(['enablebanking.com'])
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    // Afisam JWT-ul si testam
    const testRes = await fetch('https://api.enablebanking.com/aspsps?country=RO', {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
    const testData = await testRes.json();

    return NextResponse.json({
      status: testRes.status,
      appId: appId.substring(0, 8) + '...', // primele 8 caractere ca sa verificam
      jwtPreview: jwt.substring(0, 80) + '...',
      response: testData
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}