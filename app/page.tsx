'use client';
import { useState, useEffect, useRef } from 'react';
import { Loader2, Wallet, PiggyBank, TrendingDown, Plus, Trash2, Send, RefreshCw, Link } from 'lucide-react';

const MOCK_USER_ID = "a1063603-8032-453d-baee-4e1ccbfdb869";
const HOURLY_RATE = 35;
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

function MiniCalendar({ selectedDays, onToggle }: {
  selectedDays: number[]; onToggle: (d: number) => void;
}) {
  const weekDays = ['L','M','M','J','V','S','D'];
  const offset = 1; // April 2025 starts on Tuesday
  const days = Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1);

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
        {weekDays.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#4b5563' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
        {Array.from({ length: offset }).map((_,i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const isSelected = selectedDays.includes(day);
          const idx = (day + offset - 1) % 7;
          const isWeekend = idx === 5 || idx === 6;
          return (
            <button key={day} onClick={() => !isWeekend && onToggle(day)} style={{
              borderRadius:6, padding:'5px 0', fontSize:12,
              fontWeight: isSelected ? 700 : 400,
              cursor: isWeekend ? 'default' : 'pointer',
              background: isSelected ? 'linear-gradient(135deg,#10b981,#059669)'
                : isWeekend ? 'transparent' : '#1f2937',
              color: isSelected ? '#fff' : isWeekend ? '#374151' : '#9ca3af',
              border: isSelected ? 'none' : '1px solid #1f2937',
              transition: 'all 0.15s'
            }}>{day}</button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  // Work state
  const [selectedDays, setSelectedDays] = useState<number[]>([1,2,3,4,7,8,9,10,11,14,15]);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [salary, setSalary] = useState<number | null>(null);

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [newExp, setNewExp] = useState({ name:'', amount:'', category:'food', card:'main' });

  // Balance state
  const [mainBalance, setMainBalance] = useState(0);
  const [voucherBalance, setVoucherBalance] = useState(0);
  const [savingsBalance, setSavingsBalance] = useState(0);

  // ING sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'Salut! Sunt asistentul tău financiar. Pot să adaug cheltuieli, să calculez economii, sau să îți explic situația financiară. Cu ce te ajut?'
  }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Derived values
  const estimatedSalary = selectedDays.length * hoursPerDay * HOURLY_RATE;
  const totalMain = expenses.filter(e => e.card === 'main').reduce((s,e) => s + e.amount, 0);
  const totalVoucher = expenses.filter(e => e.card === 'voucher').reduce((s,e) => s + e.amount, 0);
  const savingsPotential = mainBalance * 0.2;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  // Sync ING
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/banking/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MOCK_USER_ID })
      });
      const data = await res.json();
      if (res.status === 401 && data.error === 'needs_reconnect') {
        alert('Sesiunea ING a expirat. Reconectează contul.');
      } else if (res.ok) {
        setLastSync(new Date().toLocaleTimeString('ro-RO'));
        alert(`Sync complet! ${data.added} tranzacții noi.`);
      }
    } catch (e) { console.error(e); }
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

  // Toggle work day
  const toggleDay = (day: number) => setSelectedDays(prev =>
    prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a,b) => a-b)
  );

  // Chat with AI
  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const newMessages: Message[] = [...messages, { role:'user', content: userMsg }];
    setMessages([...newMessages, { role:'assistant', content:'', loading:true }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role:m.role, content:m.content })), userId: MOCK_USER_ID })
      });
      const data = await res.json();
      setMessages([...newMessages, { role:'assistant', content: data.text || 'Eroare la răspuns.' }]);
      if (data.actionResult) {
        setTimeout(() => alert(data.actionResult), 300);
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
    { id:'work',     label:'Lucru',       icon:'◷' },
    { id:'expenses', label:'Cheltuieli',  icon:'◎' },
    { id:'chat',     label:'AI Chat',     icon:'✦' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#030712', color:'#f9fafb',
      fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>

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
            {/* Balance Cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',
              gap:14, marginBottom:20 }}>
              <BalanceCard title="Card Principal (ING)" balance={mainBalance}
                icon={Wallet} color="#10b981"
                subtitle={`−${totalMain.toFixed(0)} RON cheltuieli`} />
              <BalanceCard title="Card Bonuri (Pluxee)" balance={voucherBalance}
                icon={TrendingDown} color="#6366f1"
                subtitle={`−${totalVoucher.toFixed(0)} RON cheltuieli`} />
              <BalanceCard title="Cont Economii" balance={savingsBalance}
                icon={PiggyBank} color="#f59e0b"
                subtitle="ING Savings" />
              <BalanceCard title="Economii Posibile" balance={savingsPotential}
                icon={PiggyBank} color="#ec4899"
                subtitle="~20% din balanță principală" />
            </div>

            {/* Charts + Work Summary */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div style={cardStyle}>
                <div style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Cheltuieli pe Categorii</div>
                {catTotals.filter(c => c.total > 0).map(({ cat, total }) => (
                  <div key={cat} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, color:'#9ca3af' }}>
                        {CATEGORIES[cat].icon} {CATEGORIES[cat].label}
                      </span>
                      <span style={{ fontSize:12, fontWeight:600 }}>{total.toFixed(0)} RON</span>
                    </div>
                    <div style={{ background:'#1f2937', borderRadius:4, height:6, overflow:'hidden' }}>
                      <div style={{ width:`${(total/maxCat)*100}%`, height:'100%',
                        background:CATEGORIES[cat].color, borderRadius:4, transition:'width 0.5s' }} />
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
                <div style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Rezumat Lunar</div>
                {[
                  { label:'Zile lucrate',       value:`${selectedDays.length} / ${DAYS_IN_MONTH}` },
                  { label:'Ore lucrate',         value:`${selectedDays.length * hoursPerDay}h` },
                  { label:'Salariu estimat',     value:`${estimatedSalary.toLocaleString('ro-RO')} RON` },
                  { label:'Salariu înregistrat', value: salary ? `${salary.toLocaleString('ro-RO')} RON` : '—' },
                  { label:'Total cheltuieli',    value:`${(totalMain+totalVoucher).toFixed(2)} RON` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between',
                    padding:'10px 0', borderBottom:'1px solid #1f2937' }}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#10b981' }}>{value}</span>
                  </div>
                ))}
                <div style={{ marginTop:12, padding:10, background:'#10b98111',
                  borderRadius:8, border:'1px solid #10b98133', fontSize:11, color:'#10b981' }}>
                  💬 Spune AI-ului: "am primit 4500 RON luna trecută" ca să înregistrezi salariul
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LUCRU ── */}
        {activeTab === 'work' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={cardStyle}>
              <div style={{ fontWeight:700, marginBottom:4, fontSize:14 }}>Calendar Lucru</div>
              <div style={{ color:'#6b7280', fontSize:12, marginBottom:16 }}>
                Click pe zi pentru a marca ca lucrată
              </div>
              <MiniCalendar selectedDays={selectedDays} onToggle={toggleDay} />
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
                <div style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Ore pe Zi</div>
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
                <div style={{ fontWeight:700, marginBottom:4, fontSize:14 }}>Statistici</div>
                {[
                  { label:'Total zile',     val:`${selectedDays.length}` },
                  { label:'Total ore',      val:`${selectedDays.length * hoursPerDay}h` },
                  { label:'Estimare',       val:`${estimatedSalary.toLocaleString('ro-RO')} RON` },
                  { label:'Tarif/oră',      val:`${HOURLY_RATE} RON` },
                  { label:'Medie/zi',       val:`${(estimatedSalary / (selectedDays.length || 1)).toFixed(0)} RON` },
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
                <span style={{ fontWeight:700, fontSize:14 }}>Tranzacții</span>
                <span style={{ color:'#10b981', fontWeight:700 }}>
                  −{(totalMain + totalVoucher).toFixed(2)} RON total
                </span>
              </div>
              {expenses.length === 0 && (
                <div style={{ padding:40, textAlign:'center', color:'#4b5563', fontSize:13 }}>
                  Nicio cheltuială. Adaugă manual sau sincronizează ING / Pluxee.
                </div>
              )}
              {expenses.map(exp => (
                <div key={exp.id} style={{ display:'flex', alignItems:'center', gap:14,
                  padding:'14px 20px', borderBottom:'1px solid #1f2937' }}>
                  <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
                    background:`${CATEGORIES[exp.category]?.color || '#6b7280'}22`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                    {CATEGORIES[exp.category]?.icon || '📦'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{exp.name}</div>
                    <div style={{ fontSize:11, color:'#6b7280' }}>
                      {exp.date} · {CATEGORIES[exp.category]?.label} ·{' '}
                      {exp.card === 'main' ? '💳 Principal' : '🎫 Bonuri'} ·{' '}
                      <span style={{ color: exp.source === 'manual' ? '#6b7280'
                        : exp.source === 'gmail' ? '#6366f1' : '#10b981' }}>
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

            {/* Input */}
            <div style={{ background:'#111827', border:'1px solid #1f2937',
              borderTop:'none', borderRadius:'0 0 16px 16px',
              padding:12, display:'flex', gap:8 }}>
              <input style={{ ...inputStyle, flex:1 }}
                placeholder='Ex: "Am primit 4500 RON luna trecută" sau "Adaugă 89 RON la Lidl"'
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
                'Câți bani am cheltuit pe mâncare?',
                'Cât pot economisi luna asta?',
                'Adaugă 89 RON la Lidl pe bonuri',
                'Am primit 4500 RON luna trecută',
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
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
