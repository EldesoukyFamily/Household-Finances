import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { NON_RECURRING, fmt, fmtS, catColor, ALL_CATEGORIES } from '../lib/constants'
import DashboardTab from '../components/DashboardTab'
import BaselineTab from '../components/BaselineTab'
import TransactionsTab from '../components/TransactionsTab'
import UploadTab from '../components/UploadTab'
import SavingsTab from '../components/SavingsTab'
import BillsTab from '../components/BillsTab'
import ChatTab from '../components/ChatTab'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'baseline',  label: 'Baseline' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'upload',    label: 'Upload' },
  { id: 'savings',   label: 'Savings' },
  { id: 'bills',     label: 'Bill Planner' },
  { id: 'chat',      label: 'AI Chat' },
]

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [householdId, setHouseholdId] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  // Shared data state
  const [transactions, setTransactions] = useState([])
  const [baseline, setBaseline] = useState({})
  const [bills, setBills] = useState([])
  const [joinCode, setJoinCode] = useState('')

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      setUser(session.user)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) router.push('/')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Load profile + household
  useEffect(() => {
    if (!user) return
    async function loadProfile() {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof?.household_id) { setLoading(false); return }
      setProfile(prof)
      setHouseholdId(prof.household_id)

      // Load join code
      const { data: hh } = await supabase.from('households').select('join_code,name').eq('id', prof.household_id).single()
      if (hh) setJoinCode(hh.join_code)
    }
    loadProfile()
  }, [user])

  // Load data when householdId is set
  useEffect(() => {
    if (!householdId) return
    loadAllData()
  }, [householdId])

  async function loadAllData() {
    setLoading(true)
    await Promise.all([loadTransactions(), loadBaseline(), loadBills()])
    setLoading(false)
  }

  async function loadTransactions() {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('household_id', householdId)
      .order('date', { ascending: false })
    setTransactions(data || [])
  }

  async function loadBaseline() {
    const { data } = await supabase
      .from('baseline')
      .select('*')
      .eq('household_id', householdId)
    const bl = {}
    ;(data || []).forEach(row => { bl[row.category] = parseFloat(row.amount) })
    setBaseline(bl)
  }

  async function loadBills() {
    const { data } = await supabase
      .from('bills')
      .select('*')
      .eq('household_id', householdId)
      .order('expected_month')
    setBills(data || [])
  }

  async function updateCategory(txnId, newCat) {
    await supabase.from('transactions').update({ category: newCat }).eq('id', txnId)
    setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, category: newCat } : t))
  }

  async function deleteTransaction(txnId) {
    await supabase.from('transactions').delete().eq('id', txnId)
    setTransactions(prev => prev.filter(t => t.id !== txnId))
  }

  async function saveTransactions(newTxns) {
    const rows = newTxns.map(t => ({ ...t, household_id: householdId }))
    const { data } = await supabase.from('transactions').insert(rows).select()
    setTransactions(prev => [...(data || []), ...prev])
    return data?.length || 0
  }

  async function updateBaseline(category, amount) {
    await supabase.from('baseline').upsert(
      { household_id: householdId, category, amount },
      { onConflict: 'household_id,category' }
    )
    setBaseline(prev => ({ ...prev, [category]: amount }))
  }

  async function addBill(bill) {
    const { data } = await supabase.from('bills').insert({ ...bill, household_id: householdId }).select().single()
    if (data) setBills(prev => [...prev, data])
  }

  async function deleteBill(billId) {
    await supabase.from('bills').delete().eq('id', billId)
    setBills(prev => prev.filter(b => b.id !== billId))
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) return null

  if (!householdId && !loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No household linked</div>
          <div style={{ fontSize: 13, color: '#9499b8', marginBottom: 16 }}>Your account isn't linked to a household yet. Sign out and either create a new account or join with a code.</div>
          <button className="btn-outline" onClick={signOut}>Sign out</button>
        </div>
      </div>
    )
  }

  const sharedProps = { transactions, baseline, bills, householdId, joinCode }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 22px', background: 'var(--s1)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '700' }}>
          home<span style={{ color: '#2dd4a0' }}>finance</span>
          <span style={{ fontSize: '10px', background: '#2dd4a0', color: '#000', padding: '2px 6px', borderRadius: '10px', marginLeft: '8px', fontFamily: 'sans-serif', fontWeight: '600' }}>V5</span>
        </div>
        <nav style={{ display: 'flex', gap: '2px' }}>
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {joinCode && (
            <span style={{ fontSize: '11px', color: '#9499b8' }}>
              Code: <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#4f8ef7', letterSpacing: '2px' }}>{joinCode}</span>
            </span>
          )}
          <span style={{ fontSize: '12px', color: '#9499b8' }}>{profile?.display_name || user.email}</span>
          <button className="btn-outline" onClick={signOut} style={{ padding: '5px 12px', fontSize: '12px' }}>Sign out</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 22px', maxWidth: '1100px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9499b8' }}>
            Loading your financial data...
          </div>
        ) : (
          <>
            {tab === 'dashboard'     && <DashboardTab {...sharedProps} />}
            {tab === 'baseline'      && <BaselineTab {...sharedProps} onUpdateBaseline={updateBaseline} />}
            {tab === 'transactions'  && <TransactionsTab {...sharedProps} onUpdateCategory={updateCategory} onDelete={deleteTransaction} />}
            {tab === 'upload'        && <UploadTab {...sharedProps} onSave={saveTransactions} onReload={loadTransactions} />}
            {tab === 'savings'       && <SavingsTab {...sharedProps} />}
            {tab === 'bills'         && <BillsTab {...sharedProps} onAdd={addBill} onDelete={deleteBill} />}
            {tab === 'chat'          && <ChatTab {...sharedProps} />}
          </>
        )}
      </div>
    </div>
  )
}
