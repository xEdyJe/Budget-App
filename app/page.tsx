'use client';
import { useState, useEffect, useRef } from 'react';
import { Loader2, Wallet, PiggyBank, TrendingDown, Plus, Trash2, Send, RefreshCw, Link, Paperclip, Sparkles } from 'lucide-react';

const MOCK_USER_ID = "a1063603-8032-453d-baee-4e1ccbfdb869";
const DAYS_IN_MONTH = 30;

const CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
  food:          { label: 'Mâncare',   color: '#f97316', icon: '🍔' },
  transport:     { label: 'Transport', color: '#3b82f6', icon: '🚌' },
  entertainment: { label: 'Distracție',color: '#a855f7', icon: '🎬' },
  utilities:     { label: 'Utilități', color: '#eab308', icon: '💡' },
  other:         { label: 'Altele',    color: '#6b7280', icon: '📦' },
};

type Expense = {
  id: string;
  name: string;
  amount: number;
  category: string;
  card: string;
  date: string;
  source: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
  image?: string;
};

type Goal = {
  id: string;
  title: string;
  target_amount: number;
  saved_amount: number;
  deadline: string;
};

type Subscription = {
  id: string;
  name: string;
  amount: number;
  due_day: number;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function BalanceCard({ title, balance, icon: Icon, color, subtitle }: {
  title: string; balance: number; icon: any; color: string; subtitle?: string;
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, #0f172a 60%, ${color}18)`,
      border: `1px solid ${color}33`,
      borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80,
        borderRadius:'50%', background:`${color}10` }} />
      <Icon size={22} color={color} style={{ marginBottom: 8 }} />
      <div style={{ color:'#6b7280', fontSize:11, textTransform:'uppercase',
        letterSpacing:'0.1em', marginBottom:4 }}>{title}</div>
      <div style={{ color:'#f9fafb', fontSize:26, fontWeight:800, letterSpacing:'-0.5px' }}>
        {balance.toFixed(2)} <span style={{ fontSize:13, color:'#9ca3af' }}>RON</span>
      </div>
      {subtitle && <div style={{ color, fontSize:12, marginTop:6 }}>{subtitle}</div>}
    </div>
  );
}

function MiniCalendar({ selectedDays, onSelect, calendarDate, setCalendarDate }: {
  selectedDays: Record<string, number>; onSelect: (dateStr: string) => void;
  calendarDate: Date; setCalendarDate: (d: Date) => void;
}) {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Align to Monday

  const weekDays = ['L','M','M','J','V','S','D'];
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));

  const monthName = calendarDate.toLocaleString('ro-RO', { month: 'long' });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <button onClick={prevMonth} style={{ background:'#1f2937', border:'none', color:'#9ca3af', padding:'4px 8px', borderRadius:4, cursor:'pointer' }}>&lt;</button>
        <div style={{ fontWeight:700, textTransform:'capitalize' }}>{monthName} {year}</div>
        <button onClick={nextMonth} style={{ background:'#1f2937', border:'none', color:'#9ca3af', padding:'4px 8px', borderRadius:4, cursor:'pointer' }}>&gt;</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
        {weekDays.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#4b5563' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
        {Array.from({ length: offset }).map((_,i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selectedDays[dateStr] !== undefined;
          const hours = selectedDays[dateStr];
          const idx = (day + offset - 1) % 7;
          const isWeekend = idx === 5 || idx === 6;
          
          return (
            <button key={day} onClick={() => onSelect(dateStr)} style={{
              borderRadius:6, padding:'2px 0 5px 0', fontSize:12,
              fontWeight: isSelected ? 700 : 400,
              cursor: 'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              background: isSelected ? 'linear-gradient(135deg,#10b981,#059669)'
                : isWeekend ? 'transparent' : '#1f2937',
              color: isSelected ? '#fff' : isWeekend ? '#4b5563' : '#9ca3af',
              border: isSelected ? 'none' : '1px solid #1f2937',
              transition: 'all 0.15s'
            }}>
                {day}
                {isSelected && <span style={{fontSize:8, fontWeight:800, marginTop:1, color:'#d1fae5'}}>{hours}h</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function getNextPayDate(targetDay: number, isVoucher: boolean) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  
  if (now.getDate() > targetDay) {
    month++;
    if (month > 11) { month = 0; year++; }
  }
  
  const date = new Date(year, month, targetDay);
  const dayOfWeek = date.getDay(); // 0 Duminica, 6 Sambata
  
  if (dayOfWeek === 6) {
    date.setDate(targetDay + (isVoucher ? 2 : -1));
  } else if (dayOfWeek === 0) {
    date.setDate(targetDay + 1);
  }
  return date.toLocaleString('ro-RO', { day: 'numeric', month: 'long' });
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isInitializing, setIsInitializing] = useState(true);

  // Work state
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDays, setSelectedDays] = useState<Record<string, number>>({});
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingHours, setEditingHours] = useState(8);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [hourlyRate, setHourlyRate] = useState(35);
  const [salary, setSalary] = useState<number | null>(null);

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExp, setNewExp] = useState({ name:'', amount:'', category:'food', card:'main' });

  // Goals state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState({ title: '', amount: '', deadline: '' });
  const [fundInput, setFundInput] = useState<{ [key: string]: string }>({});
  
  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [newSub, setNewSub] = useState({ name: '', amount: '', due_day: '' });

  // Settings
  const [swapAccounts, setSwapAccounts] = useState(false);

  // Balance state
  const [mainBalance, setMainBalance] = useState(0);
  const [voucherBalance, setVoucherBalance] = useState(0);
  const [savingsBalance, setSavingsBalance] = useState(0);

  // Daily Tips
  const [dailyTip, setDailyTip] = useState<string | null>(null);
  const [loadingTip, setLoadingTip] = useState(true);

  // Sync ING
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'Salut! Încarcă fluturașul tău de salariu aici (butonul paperclip), sau dacă ai alte întrebări.'
  }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived values for View Month (Calendar Tab)
  const calendarYearMonth = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}`;
  const viewedMonthDates = Object.keys(selectedDays).filter(d => d.startsWith(calendarYearMonth));
  const currentWorkDaysCount = viewedMonthDates.length;
  const totalHoursWorked = viewedMonthDates.reduce((s, k) => s + selectedDays[k], 0);
  const estimatedSalary = totalHoursWorked * hourlyRate;
  const estimatedVouchersAmount = (totalHoursWorked / 8) * 40;

  // Derived predictive values for Current Real Month (Overview Tab)
  const realCurrentYearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const realCurrentHours = Object.keys(selectedDays)
      .filter(d => d.startsWith(realCurrentYearMonth))
      .reduce((s, d) => s + selectedDays[d], 0);
      
  const nextExpectedSalary = realCurrentHours * hourlyRate;
  const nextExpectedVouchers = (realCurrentHours / 8) * 40;

  const totalMain = expenses.filter(e => e.card === 'main').reduce((s,e) => s + e.amount, 0);
  const totalVoucher = expenses.filter(e => e.card === 'voucher').reduce((s,e) => s + e.amount, 0);
  const savingsPotential = mainBalance * 0.2;

  // Function to load all data from database seamlessly
  const fetchDashboardData = async (silent = false) => {
    if (!silent) setIsInitializing(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MOCK_USER_ID })
      });
      const data = await res.json();
      if (data.balances) {
        setMainBalance(data.balances.main);
        setSavingsBalance(data.balances.savings);
        setVoucherBalance(data.balances.voucher);
      }
      if (data.expenses) setExpenses(data.expenses);
      if (data.workDays) {
        const daysRecord: Record<string, number> = {};
        data.workDays.forEach((wd: any) => { daysRecord[wd.date] = wd.hours_worked; });
        setSelectedDays(daysRecord);
      }
      if (data.goals) setGoals(data.goals);
      if (data.subscriptions) setSubscriptions(data.subscriptions);
      if (data.settings) {
        if (data.settings.hourly_rate) setHourlyRate(data.settings.hourly_rate);
        if (data.settings.swap_accounts !== undefined) setSwapAccounts(data.settings.swap_accounts);
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      if (!silent) setIsInitializing(false);
    }
  };

  // Initial Fetch Data
  useEffect(() => {
    fetchDashboardData();

    // Load Tip
    async function fetchTip() {
      try {
        const tipRes = await fetch('/api/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: MOCK_USER_ID })
        });
        const tipData = await tipRes.json();
        if (tipData.tip) setDailyTip(tipData.tip);
      } catch (err) {
        console.error("Failed to load tip", err);
      } finally {
        setLoadingTip(false);
      }
    }
    fetchTip();

    // Auto-Sync and Silent Polling Logic
    const silentSync = async () => {
      try {
        await fetch('/api/banking/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: MOCK_USER_ID }) });
        await fetch('/api/gmail/sync');
        fetchDashboardData(true); // refetch visually seamlessly
      } catch (e) {
        console.error("Silent sync failed", e);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentSync(); // when user brings app back to screen exactly as requested
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Polling every 2 minutes ONLY when app is visible on screen
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        silentSync();
      }
    }, 2 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  // Manual Sync Data Button
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const resING = await fetch('/api/banking/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MOCK_USER_ID })
      });
      const dataING = await resING.json();

      if (resING.status === 401 && dataING.error === 'needs_reconnect') {
        alert('Sesiunea ING a expirat. Reconectează contul.');
        setIsSyncing(false);
        return;
      }

      const resGmail = await fetch('/api/gmail/sync');
      const dataGmail = await resGmail.json();

      if (resING.ok || resGmail.ok) {
        setLastSync(new Date().toLocaleTimeString('ro-RO'));
        
        let msg = `Sync complet!`;
        if (dataGmail.newBalance) msg += `\nSold Pluxee actualizat la ${dataGmail.newBalance} RON.`;
        
        // Remove reload, use our seamless fetcher!
        await fetchDashboardData(true);
        alert(msg);
      } else {
        alert(`Eroare la sync. ING: ${dataING.error}. Gmail: ${dataGmail.error}`);
      }
    } catch (e: any) { 
        console.error(e); 
        alert(`A apărut o problemă: ${e.message}`);
    }
    finally { setIsSyncing(false); }
  };

  // Add expense manually
  const handleAddExpense = async () => {
    if (!newExp.name || !newExp.amount) return;
    const exp: Expense = {
      id: Date.now().toString(),
      name: newExp.name,
      amount: parseFloat(newExp.amount),
      category: newExp.category,
      card: newExp.card,
      date: new Date().toISOString().split('T')[0],
      source: 'manual'
    };
    setExpenses(prev => [exp, ...prev]);
    setNewExp({ name:'', amount:'', category:'food', card:'main' });
  };

  // Delete expense
  const handleDelete = (id: string) => setExpenses(prev => prev.filter(e => e.id !== id));

  // Add Goal
  const handleAddGoal = async () => {
    if (!newGoal.title || !newGoal.amount || !newGoal.deadline) return;
    try {
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MOCK_USER_ID, title: newGoal.title, target_amount: Number(newGoal.amount), deadline: newGoal.deadline })
      });
      fetchDashboardData();
      setNewGoal({ title: '', amount: '', deadline: '' });
    } catch (err) { console.error(err); }
  };

  // Add Funds to Goal
  const handleAddFund = async (goalId: string) => {
    const amount = Number(fundInput[goalId]);
    if (!amount || amount <= 0) return;
    try {
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MOCK_USER_ID, goalId, add_amount: amount })
      });
      setFundInput({ ...fundInput, [goalId]: '' });
      fetchDashboardData();
    } catch (err) { console.error(err); }
  };

  // Add / Delete Subscription
  const handleAddSubscription = async () => {
    if (!newSub.name || !newSub.amount || !newSub.due_day) return;
    try {
      await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', userId: MOCK_USER_ID, name: newSub.name, amount: Number(newSub.amount), due_day: Number(newSub.due_day) })
      });
      fetchDashboardData();
      setNewSub({ name: '', amount: '', due_day: '' });
    } catch (e) { console.error(e); }
  };

  const handleDeleteSubscription = async (id: string) => {
    try {
      await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId: MOCK_USER_ID, id })
      });
      fetchDashboardData();
    } catch (e) { console.error(e); }
  };

  // Start editing a work day
  const handleDaySelect = (dateStr: string) => {
    setEditingDate(dateStr);
    setEditingHours(selectedDays[dateStr] !== undefined ? selectedDays[dateStr] : hoursPerDay);
  };

  // Save specific hours for a day
  const saveDayHours = async (dateStr: string, hours: number) => {
    setSelectedDays(prev => {
      const copy = { ...prev };
      if (hours > 0) copy[dateStr] = hours;
      else delete copy[dateStr];
      return copy;
    });
    setEditingDate(null);

    try {
      await fetch('/api/work-days/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MOCK_USER_ID, date: dateStr, hours })
      });
    } catch (err) {
      console.error("Failed to save work day", err);
    }
  };

  // Image Upload Handle
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSwapAccounts = async () => {
    // Optimistic UI Swap
    setSwapAccounts(prev => !prev);
    // Realistically, to accurately reflect balances, we just swap local state or re-fetch dashboard.
    // For visual immediacy, let's just trigger a swap of the balances locally too.
    const tempMain = mainBalance;
    setMainBalance(voucherBalance); // Wait, ING Savings vs Main. If we don't have separate variables for both, we swap main and savings!
    setMainBalance(savingsBalance);
    setSavingsBalance(tempMain);

    try {
      await fetch('/api/settings/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MOCK_USER_ID })
      });
      // Optionally sync to lock it in
    } catch (err) {
      console.error(err);
    }
  };

  // Chat with AI
  const handleChat = async () => {
    if ((!chatInput.trim() && !selectedImage) || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const base64Img = selectedImage;
    setSelectedImage(null);

    const newMessages: Message[] = [...messages, { role:'user', content: userMsg || 'Am încărcat un fluturaș de salariu.', image: base64Img || undefined }];
    setMessages([...newMessages, { role:'assistant', content:'', loading:true }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages.map(m => ({ role:m.role, content:m.content })), 
          userId: MOCK_USER_ID,
          message: userMsg,
          imageBase64: base64Img 
        })
      });
      const data = await res.json();
      setMessages([...newMessages, { role:'assistant', content: data.text || 'Eroare la răspuns.' }]);
      if (data.actionResult) {
        // Automatically fetch to show updates seamlessly
        fetchDashboardData(true);
        setTimeout(() => alert(data.actionResult), 300);
      }
      if (data.newHourlyRate) {
        setHourlyRate(data.newHourlyRate);
        fetchDashboardData(true);
      }
    } catch {
      setMessages([...newMessages, { role:'assistant', content:'Eroare de conexiune.' }]);
    }
    setChatLoading(false);
  };

  // Styles
  const inputStyle: React.CSSProperties = {
    background:'#111827', border:'1px solid #374151', borderRadius:8,
    color:'#f9fafb', padding:'8px 12px', fontSize:13, outline:'none', width:'100%'
  };
  const cardStyle: React.CSSProperties = {
    background:'#0f172a', border:'1px solid #1f2937', borderRadius:16, padding:20
  };
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding:'14px 20px', background:'transparent', border:'none',
    borderBottom: active ? '2px solid #10b981' : '2px solid transparent',
    color: active ? '#10b981' : '#6b7280',
    fontWeight: active ? 600 : 400, fontSize:13, cursor:'pointer',
    display:'flex', alignItems:'center', gap:6, transition:'all 0.2s',
    fontFamily: 'inherit'
  });

  const catTotals = Object.keys(CATEGORIES).map(cat => ({
    cat, total: expenses.filter(e => e.category === cat).reduce((s,e) => s+e.amount, 0)
  }));
  const maxCat = Math.max(...catTotals.map(c => c.total), 1);

  const tabs = [
    { id:'overview', label:'Overview',    icon:'◈' },
    { id:'goals',    label:'Obiective',   icon:'🎯' },
    { id:'work',     label:'Lucru & AI',  icon:'◷' },
    { id:'expenses', label:'Cheltuieli',  icon:'◎' },
    { id:'chat',     label:'Asistent',    icon:'✦' },
  ];

  if (isInitializing) {
    return (
      <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#030712' }}>
        <Loader2 size={32} color="#10b981" style={{ animation:'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#030712', color:'#f9fafb', fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ background:'#0a0f1a', borderBottom:'1px solid #1f2937',
        padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8,
            background:'linear-gradient(135deg,#10b981,#6366f1)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>◈</div>
          <span style={{ fontWeight:800, fontSize:18, letterSpacing:'-0.5px' }}>BugetPersonal</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleSwapAccounts} style={{
            display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
            background:'#f59e0b22', border:'1px solid #f59e0b44', borderRadius:8,
            color:'#f59e0b', fontSize:12, cursor:'pointer' }}>
            🔁 Inversează Conturile
          </button>
          <button onClick={handleSync} disabled={isSyncing} style={{
            display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
            background:'#1f2937', border:'1px solid #374151', borderRadius:8,
            color:'#9ca3af', fontSize:12, cursor:'pointer' }}>
            {isSyncing ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }} />
              : <RefreshCw size={14} />}
            {isSyncing ? 'Se sincronizează...' : 'Sync ING'}
          </button>
          <a href="/api/banking/connect" style={{
            display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
            background:'#10b98122', border:'1px solid #10b98144', borderRadius:8,
            color:'#10b981', fontSize:12, textDecoration:'none' }}>
            <Link size={14} /> Reconectează ING
          </a>
          {lastSync && <span style={{ fontSize:11, color:'#4b5563', alignSelf:'center' }}>
            Sync: {lastSync}
          </span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #1f2937',
        background:'#0a0f1a', padding:'0 16px', overflowX:'auto' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={tabBtnStyle(activeTab === tab.id)}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding:20, maxWidth:960, margin:'0 auto' }}>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div>
            {/* AI DAILY TIPS PANEL */}
            <div style={{
              background: 'linear-gradient(135deg, #10b98122, #6366f122)',
              border: '1px solid #10b98144',
              borderRadius: 16,
              padding: '24px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 20
            }}>
              <div style={{ background: '#10b981', padding: 16, borderRadius: '50%', color: '#fff' }}>
                <Sparkles size={32} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 800, color: '#f9fafb' }}>Tip-ul Zilei & Financial Goals</h3>
                {loadingTip ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8, color:'#9ca3af', fontSize:14 }}>
                    <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} /> AI-ul analizează finanțele tale...
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 15, color: '#d1d5db', lineHeight: 1.6 }}>
                    {dailyTip || "Continuă să îți urmărești cheltuielile pentru ai primi sfaturi noi!"}
                  </p>
                )}
              </div>
            </div>

            {/* Balance Cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',
              gap:14, marginBottom:20 }}>
              <BalanceCard title="Card Principal (ING)" balance={mainBalance}
                icon={Wallet} color="#10b981"
                subtitle={`−${totalMain.toFixed(0)} RON cheltuieli luna curentă`} />
              <BalanceCard title="Card Bonuri (Pluxee)" balance={voucherBalance}
                icon={TrendingDown} color="#6366f1"
                subtitle={`−${totalVoucher.toFixed(0)} RON cheltuieli luna curentă`} />
              <BalanceCard title="Cont Economii" balance={savingsBalance}
                icon={PiggyBank} color="#f59e0b"
                subtitle="ING Savings" />
              <BalanceCard title="Economii Posibile" balance={savingsPotential}
                icon={PiggyBank} color="#ec4899"
                subtitle="~20% din balanță principală" />
            </div>

            {/* PREDICTIVE PANELS */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b' }}>
                <Sparkles size={18} /> Finanțe Previzionate (Luna Următoare)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                <div style={{ ...cardStyle, border: '1px solid #f59e0b44', background: 'linear-gradient(135deg, #0f172a, #f59e0b11)' }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Total Avere Principal (Bază + Salariu)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{(mainBalance + nextExpectedSalary).toFixed(2)} <span style={{fontSize:12}}>RON</span></div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                    +{nextExpectedSalary.toFixed(0)} lei din salariu estimat
                  </div>
                </div>
                <div style={{ ...cardStyle, border: '1px solid #10b98144', background: 'linear-gradient(135deg, #0f172a, #10b98111)' }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Total Avere Bonuri (Bază + Bonuri viitoare)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{(voucherBalance + nextExpectedVouchers).toFixed(2)} <span style={{fontSize:12}}>RON</span></div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                    +{nextExpectedVouchers.toFixed(0)} lei ({(realCurrentHours / 8).toFixed(1)} zile cumulate)
                  </div>
                </div>
              </div>
            </div>
            {/* SUBSCRIPTIONS PANEL */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#ec4899' }}>
                <TrendingDown size={18} /> Costuri Fixe lunare (Abonamente)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                {subscriptions.map(s => (
                  <div key={s.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#f9fafb' }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Zi de plată: {s.due_day}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#ec4899' }}>-{s.amount} <span style={{fontSize:11}}>RON</span></div>
                      <button onClick={() => handleDeleteSubscription(s.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', marginTop: 4 }}>Șterge</button>
                    </div>
                  </div>
                ))}
                <div style={{ ...cardStyle, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>Adaugă Abonament Nou</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input style={{...inputStyle, padding: '6px 10px'}} placeholder="Nume" value={newSub.name} onChange={e => setNewSub({...newSub, name: e.target.value})} />
                    <input style={{...inputStyle, padding: '6px 10px', width: 60}} type="number" placeholder="RON" value={newSub.amount} onChange={e => setNewSub({...newSub, amount: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input style={{...inputStyle, padding: '6px 10px'}} type="number" placeholder="Zi plată (1-31)" value={newSub.due_day} onChange={e => setNewSub({...newSub, due_day: e.target.value})} />
                    <button onClick={handleAddSubscription} style={{ background:'#ec4899', border:'none', borderRadius:8, padding:'0 14px', color:'#fff', fontWeight:700, cursor:'pointer' }}>+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts + Work Summary */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div style={cardStyle}>
                <div style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Cheltuieli pe Categorii</div>
                {catTotals.filter(c => c.total > 0).map(({ cat, total }) => (
                  <div key={cat} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, color:'#9ca3af' }}>
                        {CATEGORIES[cat]?.icon} {CATEGORIES[cat]?.label}
                      </span>
                      <span style={{ fontSize:12, fontWeight:600 }}>{total.toFixed(0)} RON</span>
                    </div>
                    <div style={{ background:'#1f2937', borderRadius:4, height:6, overflow:'hidden' }}>
                      <div style={{ width:`${(total/maxCat)*100}%`, height:'100%',
                        background:CATEGORIES[cat]?.color, borderRadius:4, transition:'width 0.5s' }} />
                    </div>
                  </div>
                ))}
                {catTotals.every(c => c.total === 0) && (
                  <div style={{ color:'#4b5563', fontSize:13, textAlign:'center', padding:'20px 0' }}>
                    Nicio cheltuială înregistrată încă
                  </div>
                )}
              </div>

              <div style={cardStyle}>
                <div style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Rezumat Lunar Calendar</div>
                {[
                  { label:'Zile lucrate',       value:`${currentWorkDaysCount} / ${DAYS_IN_MONTH}` },
                  { label:'Ore lucrate',         value:`${totalHoursWorked}h` },
                  { label:'Salariu estimat următor', value:`${estimatedSalary.toLocaleString('ro-RO')} RON` },
                  { label:'Tarif orar curent',   value:`${hourlyRate} RON/oră` },
                  { label:'Data Salariu (10)',   value:`${getNextPayDate(10, false)}` },
                  { label:'Data Bonuri (5)',     value:`${getNextPayDate(5, true)}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between',
                    padding:'10px 0', borderBottom:'1px solid #1f2937' }}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#10b981' }}>{value}</span>
                  </div>
                ))}
                <div style={{ marginTop:12, padding:10, background:'#10b98111',
                  borderRadius:8, border:'1px solid #10b98133', fontSize:11, color:'#10b981' }}>
                  💬 Du-te în Asistent pentru a încărca fluturașul tău de salariu și AI-ul va actualiza valoarea automat!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GOALS / OBIECTIVE ── */}
        {activeTab === 'goals' && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Creare Obiectiv Nou</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10 }}>
                <input style={inputStyle} placeholder="Nume (ex: Chirie)" value={newGoal.title} onChange={e => setNewGoal({...newGoal, title:e.target.value})} />
                <input style={inputStyle} type="number" placeholder="Sumă (RON)" value={newGoal.amount} onChange={e => setNewGoal({...newGoal, amount:e.target.value})} />
                <input style={inputStyle} type="date" value={newGoal.deadline} onChange={e => setNewGoal({...newGoal, deadline:e.target.value})} />
                <button onClick={handleAddGoal} style={{ background:'#10b981', border:'none', borderRadius:8, padding:'0 20px', color:'#fff', fontWeight:700, cursor:'pointer' }}>Adaugă</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {goals.map(g => {
                const percent = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
                const d1 = new Date(); const d2 = new Date(g.deadline);
                const daysLeft = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
                const neededPerDay = daysLeft > 0 ? ((g.target_amount - g.saved_amount) / daysLeft).toFixed(1) : 0;
                
                return (
                  <div key={g.id} style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#f9fafb' }}>{g.title}</div>
                        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Deadline: {new Date(g.deadline).toLocaleDateString('ro-RO')} ({daysLeft > 0 ? `${daysLeft} zile rămase` : 'Expirat'})</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{g.saved_amount} <span style={{ fontSize: 14, color: '#6b7280' }}>/ {g.target_amount} RON</span></div>
                        {daysLeft > 0 && g.saved_amount < g.target_amount && (
                          <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, background: '#f59e0b22', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
                            Target Zilnic: {neededPerDay} RON / zi
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ background: '#1f2937', borderRadius: 8, height: 12, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', transition: 'width 1s ease-in-out' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>{percent}% Completat</div>
                      
                      {daysLeft > 0 && g.saved_amount < g.target_amount && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input 
                            style={{ ...inputStyle, padding: '4px 8px', width: 80 }} 
                            placeholder="+RON" 
                            type="number"
                            value={fundInput[g.id] || ''} 
                            onChange={e => setFundInput({ ...fundInput, [g.id]: e.target.value })} 
                          />
                          <button 
                            onClick={() => handleAddFund(g.id)} 
                            style={{ background: '#10b981', border: 'none', borderRadius: 6, color: '#fff', padding: '4px 10px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Depune
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {goals.length === 0 && <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>Nu ai setat niciun obiectiv încă. AI-ul abia așteaptă să te ajute să le atingi!</div>}
            </div>
          </div>
        )}

        {/* ── LUCRU ── */}
        {activeTab === 'work' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={cardStyle}>
              <div style={{ fontWeight:700, marginBottom:4, fontSize:14 }}>Calendar Lucru</div>
              <div style={{ color:'#6b7280', fontSize:12, marginBottom:16 }}>
                Click pe zi pentru a marca ca lucrată. Afișăm luna {calendarDate.toLocaleString('ro-RO', { month: 'long' })}.
              </div>
              <MiniCalendar selectedDays={selectedDays} onSelect={handleDaySelect} calendarDate={calendarDate} setCalendarDate={setCalendarDate} />
              
              {editingDate && (
                <div style={{ marginTop:16, padding:16, background:'#1f2937', borderRadius:12, border:'1px solid #374151', animation:'slideIn 0.3s ease-out forwards' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#f9fafb', marginBottom:12 }}>
                    Câte ore ai lucrat pe {new Date(editingDate).toLocaleDateString('ro-RO')}?
                  </div>
                  <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:16 }}>
                    <input type="range" min="0" max="14" step="0.5" 
                      value={editingHours} onChange={e => setEditingHours(Number(e.target.value))}
                      style={{ flex:1, accentColor:'#10b981' }} />
                    <div style={{ background:'#10b98122', padding:'4px 10px', borderRadius:8, color:'#10b981', fontWeight:800, minWidth:48, textAlign:'center' }}>
                      {editingHours}h
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
                    <button onClick={() => saveDayHours(editingDate, 0)} style={{ background:'transparent', color:'#ef4444', border:'none', padding:'8px 12px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>Șterge / 0h</button>
                    <button onClick={() => saveDayHours(editingDate, editingHours)} style={{ background:'#10b981', color:'#fff', border:'none', padding:'8px 20px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>Salvează</button>
                  </div>
                </div>
              )}
              <div style={{ marginTop:16, display:'flex', gap:12 }}>
                {[
                  { color:'linear-gradient(135deg,#10b981,#059669)', label:'Lucrată' },
                  { color:'#1f2937', label:'Nelucrat' },
                  { color:'transparent', label:'Weekend' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                    <div style={{ width:12, height:12, borderRadius:3, background:color,
                      border:'1px solid #374151' }} />
                    <span style={{ color:'#9ca3af' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={cardStyle}>
                <div style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Ore pe Zi standard</div>
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  <input type="range" min={4} max={12} value={hoursPerDay}
                    onChange={e => setHoursPerDay(+e.target.value)}
                    style={{ flex:1, accentColor:'#10b981' }} />
                  <div style={{ background:'#10b98122', border:'1px solid #10b98144',
                    borderRadius:8, padding:'4px 14px', color:'#10b981',
                    fontWeight:700, minWidth:50, textAlign:'center' }}>
                    {hoursPerDay}h
                  </div>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ fontWeight:700, marginBottom:4, fontSize:14 }}>Statistici AI Predicție</div>
                {[
                  { label:'Total zile lucrate', val:`${currentWorkDaysCount}` },
                  { label:'Total ore estimativ',      val:`${totalHoursWorked}h` },
                  { label:'Salariu de încasat',       val:`${estimatedSalary.toLocaleString('ro-RO')} RON` },
                  { label:'Valoare Bonuri încasat',   val:`${estimatedVouchersAmount.toFixed(0)} RON` },
                  { label:'Următorul Salariu (din L-V)', val:`${getNextPayDate(10, false)}` },
                  { label:'Următoarele Bonuri (din L-V)', val:`${getNextPayDate(5, true)}` },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between',
                    padding:'8px 0', borderBottom:'1px solid #1f2937' }}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#10b981' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CHELTUIELI ── */}
        {activeTab === 'expenses' && (
          <div>
            {/* Add form */}
            <div style={{ ...cardStyle, marginBottom:16, border:'1px solid #374151' }}>
              <div style={{ fontWeight:700, marginBottom:12, fontSize:14 }}>+ Adaugă Cheltuială</div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:8 }}>
                <input style={inputStyle} placeholder="Denumire..."
                  value={newExp.name} onChange={e => setNewExp(p => ({...p, name:e.target.value}))} />
                <input style={inputStyle} type="number" placeholder="Sumă RON"
                  value={newExp.amount} onChange={e => setNewExp(p => ({...p, amount:e.target.value}))} />
                <select style={inputStyle} value={newExp.category}
                  onChange={e => setNewExp(p => ({...p, category:e.target.value}))}>
                  {Object.entries(CATEGORIES).map(([k,v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
                <select style={inputStyle} value={newExp.card}
                  onChange={e => setNewExp(p => ({...p, card:e.target.value}))}>
                  <option value="main">💳 Principal</option>
                  <option value="voucher">🎫 Bonuri</option>
                </select>
                <button onClick={handleAddExpense} style={{
                  background:'linear-gradient(135deg,#10b981,#059669)', border:'none',
                  borderRadius:8, color:'#fff', fontWeight:700, padding:'8px 18px',
                  cursor:'pointer', fontSize:20 }}>+</button>
              </div>
            </div>

            {/* Expenses list */}
            <div style={{ ...cardStyle, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #1f2937',
                display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:14 }}>Tranzacții Centrale (ING & Pluxee)</span>
                <span style={{ color:'#10b981', fontWeight:700 }}>
                  −{(totalMain + totalVoucher).toFixed(2)} RON total selectat
                </span>
              </div>
              {expenses.length === 0 && (
                <div style={{ padding:40, textAlign:'center', color:'#4b5563', fontSize:13 }}>
                  Nicio cheltuială recentă. Apasă "Sync ING" sau așteaptă citirea Email-urilor Pluxee.
                </div>
              )}
              {expenses.map((exp, index) => (
                <div key={exp.id} style={{ 
                  display:'flex', alignItems:'center', gap:14,
                  padding:'14px 20px', borderBottom:'1px solid #1f2937',
                  animation: `slideIn 0.4s ease-out forwards`,
                  animationDelay: `${Math.min(index * 0.05, 0.5)}s`,
                  opacity: 0 // starts invisible for animation
                }}>
                  <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
                    background:`${CATEGORIES[exp.category]?.color || '#6b7280'}22`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                    {CATEGORIES[exp.category]?.icon || '📦'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{exp.name}</div>
                    <div style={{ fontSize:11, color:'#6b7280' }}>
                      {exp.date} · {CATEGORIES[exp.category]?.label || 'Altele'} ·{' '}
                      {exp.card === 'main' ? '💳 Principal' : '🎫 Bonuri'} ·{' '}
                      <span style={{ color: exp.source === 'manual' ? '#6b7280'
                        : exp.source === 'pluxee' ? '#6366f1' : '#10b981' }}>
                        {exp.source}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontWeight:700, color:'#f87171' }}>
                    −{exp.amount.toFixed(2)} RON
                  </div>
                  <button onClick={() => handleDelete(exp.id)} style={{
                    background:'#1f2937', border:'none', borderRadius:6,
                    color:'#6b7280', cursor:'pointer', padding:'4px 8px', fontSize:12 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CHAT ── */}
        {activeTab === 'chat' && (
          <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 200px)' }}>
            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', ...cardStyle,
              borderRadius:'16px 16px 0 0', padding:20 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display:'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom:12 }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0,
                      background:'linear-gradient(135deg,#10b981,#6366f1)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:14, marginRight:8 }}>✦</div>
                  )}
                  <div style={{
                    maxWidth:'80%', padding:'10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg,#10b981,#059669)' : '#1f2937',
                    color:'#f9fafb', fontSize:13, lineHeight:1.5,
                    border: msg.role === 'user' ? 'none' : '1px solid #374151'
                  }}>
                    {msg.image && (
                      <div style={{ marginBottom: 6 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.image} alt="Uploaded file" style={{ maxWidth: 200, borderRadius: 8, border: '1px solid #374151' }} />
                      </div>
                    )}
                    {msg.loading ? (
                      <span style={{ display:'inline-flex', gap:3 }}>
                        {[0,1,2].map(i => (
                          <span key={i} style={{ width:5, height:5, borderRadius:'50%',
                            background:'#6b7280', display:'inline-block',
                            animation:`bounce 1s ease-in-out ${i*0.2}s infinite` }} />
                        ))}
                      </span>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Image Preview Block */}
            {selectedImage && (
              <div style={{ background: '#1f2937', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedImage} alt="preview" style={{ height: 40, width: 40, objectFit: 'cover', borderRadius: 4 }} />
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Imagine atașată.</span>
                <button onClick={() => setSelectedImage(null)} style={{ marginLeft: 'auto', background: 'transparent', border:'none', color:'#f87171', cursor:'pointer' }}>x</button>
              </div>
            )}

            {/* Input */}
            <div style={{ background:'#111827', border:'1px solid #1f2937',
              borderTop:'none', borderRadius: selectedImage ? '0 0 16px 16px' : '0 0 16px 16px',
              padding:12, display:'flex', gap:8 }}>
              
              <button onClick={() => fileInputRef.current?.click()} style={{
                background: '#1f2937', border: '1px solid #374151', borderRadius: 8,
                padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center'
              }}>
                <Paperclip size={18} color="#9ca3af" />
              </button>
              <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageChange} />

              <input style={{ ...inputStyle, flex:1 }}
                placeholder='Mesaj sau atașează fluturaș...'
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()} />

              <button onClick={handleChat} disabled={chatLoading} style={{
                background: chatLoading ? '#374151' : 'linear-gradient(135deg,#10b981,#059669)',
                border:'none', borderRadius:10, color:'#fff', fontWeight:700,
                padding:'8px 18px', cursor: chatLoading ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', gap:6 }}>
                <Send size={16} />
              </button>
            </div>

            {/* Quick prompts */}
            <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
              {[
                'Analizează acest fluturaș de salariu',
                'Câți bani am cheltuit pe mâncare luna asta?',
                'Actualizează-mi tariful orar la 45'
              ].map(hint => (
                <button key={hint} onClick={() => setChatInput(hint)} style={{
                  background:'#1f2937', border:'1px solid #374151', borderRadius:8,
                  color:'#9ca3af', padding:'6px 12px', fontSize:11, cursor:'pointer',
                  fontFamily:'inherit' }}>{hint}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes slideIn { 
          from { opacity: 0; transform: translateY(-15px) scale(0.98); } 
          to { opacity: 1; transform: translateY(0) scale(1); } 
        }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
