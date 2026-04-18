'use client';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Utensils, Zap, MessageSquare, Loader2 } from "lucide-react";

// For this prototype phase, we use the same hardcoded ID we used in the callback
const MOCK_USER_ID = "a1063603-8032-453d-baee-4e1ccbfdb869"; 

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSyncingING, setIsSyncingING] = useState(false);
  const [ingConnected, setIngConnected] = useState(false);

  // In a real app, we'd check Supabase for the connection status on load.
  // For now, we'll let the Sync button handle the 401 "needs_reconnect" fallback.
  useEffect(() => {
    // Note: You can add a fetch here later to check `enable_banking_accounts` table
    setIngConnected(true); // Assuming connected for the UI state, will fail gracefully if not
  }, []);

  const handleConnectING = () => {
    // Redirects the user to our Connect API route, which starts the Enable Banking flow
    window.location.href = '/api/banking/connect';
  };

  const handleSyncING = async () => {
    setIsSyncingING(true);
    try {
      const res = await fetch('/api/banking/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MOCK_USER_ID })
      });
      
      const data = await res.json();

      if (res.status === 401 && data.error === 'needs_reconnect') {
        setIngConnected(false);
        alert("Sesiunea ING nu există sau a expirat. Te rugăm să conectezi contul.");
      } else if (res.ok) {
        alert(`Sincronizare completă! S-au adăugat ${data.added} tranzacții noi.`);
        // Here you would trigger a re-fetch of the balances from Supabase
      } else {
        alert("Eroare la sincronizare: " + data.error);
      }
    } catch (error) {
      console.error("Sync failed", error);
    } finally {
      setIsSyncingING(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 font-sans p-4 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-emerald-500">BugetPersonal.</h1>
        <div className="flex gap-2">
          
          {/* Dynamic ING Button */}
          {!ingConnected ? (
            <button 
              onClick={handleConnectING}
              className="px-4 py-2 text-sm bg-emerald-600 rounded-md hover:bg-emerald-500 transition font-semibold"
            >
              Conectează ING
            </button>
          ) : (
            <button 
              onClick={handleSyncING}
              disabled={isSyncingING}
              className="px-4 py-2 text-sm bg-gray-800 rounded-md hover:bg-gray-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSyncingING ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSyncingING ? 'Se sincronizează...' : 'Sync ING'}
            </button>
          )}

          <button className="px-4 py-2 text-sm bg-gray-800 rounded-md hover:bg-gray-700 transition">
            Sync Pluxee
          </button>
        </div>
      </header>

      {/* ... [KEEP THE REST OF THE TABS AND CARDS EXACTLY AS THEY WERE] ... */}
      <Tabs defaultValue="overview" className="w-full">
         {/* ... Tabs List & Content ... */}
      </Tabs>
    </div>
  );
}