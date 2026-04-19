import { NextRequest, NextResponse } from 'next/server';
import { getEnableBankingToken } from '@/lib/enablebanking';

export async function GET(req: NextRequest) {
  try {
    const token = await getEnableBankingToken();

    // Test: vedem ce zice Enable Banking
    const testRes = await fetch('https://api.enablebanking.com/aspsps?country=RO', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const testData = await testRes.json();
    
    // Returnam direct raspunsul ca sa vedem ce primim
    return NextResponse.json({ 
      status: testRes.status, 
      data: testData 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}