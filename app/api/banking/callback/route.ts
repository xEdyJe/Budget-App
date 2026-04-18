import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/enablebanking';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const stateQuery = url.searchParams.get('state');
  
  const savedState = cookies().get('eb_state')?.value;
  const sessionId = cookies().get('eb_session_id')?.value;

  if (!stateQuery || stateQuery !== savedState || !sessionId) {
    return NextResponse.redirect(new URL('/?error=invalid_state', req.url));
  }

  try {
    // Hardcoded User ID for single-user context (replace with auth.uid() in full app)
    const userId = "a1063603-8032-453d-baee-4e1ccbfdb869"; 

    const sessionDetails = await getSession(sessionId);
    
    // Process and store accounts
    for (const acc of sessionDetails.accounts) {
      // Basic heuristic to differentiate savings vs main. Adjust as needed based on actual ING account names.
      const isSavings = acc.name?.toLowerCase().includes('economii') || acc.name?.toLowerCase().includes('saving');
      const accountType = isSavings ? 'savings' : 'main';

      await supabase.from('enable_banking_accounts').upsert({
        user_id: userId,
        account_uid: acc.uid,
        account_name: acc.name,
        iban: acc.account_id?.iban,
        currency: acc.currency,
        type: accountType
      }, { onConflict: 'account_uid' });
    }

    // Clear cookies
    cookies().delete('eb_state');
    cookies().delete('eb_session_id');

    return NextResponse.redirect(new URL('/', req.url));

  } catch (error) {
    return NextResponse.redirect(new URL('/?error=callback_failed', req.url));
  }
}