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
      .setAudience('enablebanking.com')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    // Decodam JWT-ul ca sa vedem exact ce contine
    const parts = jwt.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());

    // Testam API-ul
    const testRes = await fetch('https://api.enablebanking.com/aspsps?country=RO', {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
    const testData = await testRes.json();

    return NextResponse.json({
      jwtHeader: header,
      jwtPayload: payload,
      apiStatus: testRes.status,
      apiResponse: testData
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}