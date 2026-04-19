import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
);

export async function GET() {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly' // Cerem doar voie să citim, nu să trimitem email-uri
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Important: ne dă un "refresh token" ca să nu te loghezi zilnic
    scope: scopes,
    prompt: 'consent'
  });

  return NextResponse.redirect(url);
}