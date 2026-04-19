import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code_gmail', req.url));
  }

  try {
    // 1. Schimbăm codul pe token-uri
    const { tokens } = await oauth2Client.getToken(code);
    
    // ID-ul tău hardcodat pe care l-am folosit și la bancă
    const userId = "a1063603-8032-453d-baee-4e1ccbfdb869";

    console.log("🟢 GMAIL: Token-uri primite cu succes.");

    // 2. Salvăm în Supabase folosind UPSERT 
    // (dacă există deja, actualizează; dacă nu, creează)
    const { error } = await supabase.from('integrations').upsert({
      user_id: userId,
      service_name: 'gmail',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token, // Acesta vine doar prima dată!
      expires_at: tokens.expiry_date,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id, service_name' });

    if (error) {
      console.error("🔴 EROARE SALVARE GMAIL DB:", error);
      throw error;
    }

    console.log("✅ GMAIL: Integrare salvată în baza de date.");

    // Te trimitem înapoi pe pagina principală cu un mesaj de succes
    return NextResponse.redirect(new URL('/?success=gmail_connected', req.url));

  } catch (error) {
    console.error("🔴 EROARE FATALĂ GMAIL CALLBACK:", error);
    return NextResponse.redirect(new URL('/?error=gmail_callback_failed', req.url));
  }
}