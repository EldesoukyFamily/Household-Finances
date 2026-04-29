import { useState, useRef } from 'react'
import { autoCategorize, fmt, ALL_CATEGORIES } from '../lib/constants'

function parseAmt(str) {
  if (!str) return 0
  const s = String(str).trim()
  const neg = s.startsWith('(') || s.startsWith('-')
  const clean = s.replace(/[$(),\s]/g, '')
  return (neg ? -1 : 1) * (parseFloat(clean) || 0)
}

// Always skip — internal transfers, CC payments, savings moves
const TRANSFER_KEYWORDS = [
  'KIDS SAVINGS', 'SAVINGS ACCOUNT', 'TO: SAVINGS', 'TO SAVINGS',
  '360 PERFORMANCE SAVINGS',    // CapOne internal savings transfer
  'CRCARDPMT',                  // CC payment
  'BARCLAYCARD US CREDITCARD',  // Barclays CC payment
  'MOBILE PMT',                 // CapOne mobile CC payment
  'AUTOPAY',                    // auto CC payment
  'CREDIT CARD PMT',
  'AUTOMATIC PAYMENT - THANK',  // Chase auto payment
  'CRDWEB',                     // Axos → Chase web payment
  'EPAY CHASE CREDIT',          // Axos Chase epay
  'FROM: CHECKING',             // Axos internal
  'DEBIT - CHASE',              // Axos → Chase debit
  'DEBIT - CHA',                // Axos → Chase (truncated)
]
function isTransfer(desc) {
  const d = (desc || '').toUpperCase()
  return TRANSFER_KEYWORDS.some(k => d.includes(k))
}

// Credits that should be silently skipped (noise/reimbursements)
const SKIP_CREDIT_KEYWORDS = [
  'MONTHLY INTEREST',       // bank interest
  'INTEREST PAID',          // Axos interest
  'CHECK DEPOSIT',          // mobile check deposits
  'ZELLE MONEY RECEIVED',   // incoming Zelle reimbursements
  '360 PERFORMANCE',        // internal savings transfer
]
function skipCredit(desc) {
  const d = (desc || '').toUpperCase()
  return SKIP_CREDIT_KEYWORDS.some(k => d.includes(k))
}

// Payroll / income — import as Income category
const INCOME_KEYWORDS = [
  'PAYROLL', 'VEECO INSTRUMENT', 'GUIDEHOUSE',
  'TAX REF', 'IRS  TREAS', 'IRS   TREAS',   // federal tax refund (handle spacing variations)
  'VA DEPT TAXATION', 'VATXREBATE', 'VASTTAXRFD',  // VA state tax refund
  'DIRECT DEP',
]
function isIncome(desc) {
  const d = (desc || '').toUpperCase()
  return INCOME_KEYWORDS.some(k => d.includes(k))
}

function parseCSV(text, fname) {
  const fn = fname.toUpperCase()
  const lines = text.split('\n').map(l => l.trim().replace(/\r$/, '')).filter(l => l)

  let hi = 0
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    if (lines[i].toLowerCase().includes('date') || lines[i].toLowerCase().includes('transaction')) { hi = i; break }
  }

  const heads = lines[hi].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
  const txns = []

  for (let i = hi + 1; i < lines.length; i++) {
    // Handle quoted fields with commas inside
    const cols = []
    let cur = '', inQ = false
    for (const ch of lines[i]) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cols.push(cur.trim())

    if (cols.length < 3) continue
    const row = {}
    heads.forEach((h, idx) => { row[h] = cols[idx] || '' })

    try {
      let date = '', desc = '', amount = 0, account = ''

      // ── TRUIST MORTGAGE
      // Detected by "full description" column header
      // Amount format: ($7,600.70)
      if (fn.includes('TRUIST') || heads.includes('full description')) {
        date = row['posted date'] || row['transaction date'] || ''
        desc = row['full description'] || 'Mortgage Payment'
        if (isTransfer(desc)) continue
        amount = Math.abs(parseAmt(row['amount'] || '0'))
        if (!amount) continue
        account = 'Truist'

      // ── AXOS CHECKING
      // Detected by "transaction number" column header
      // Separate Amount Debit / Amount Credit columns
      } else if (fn.includes('AXOS') || heads.includes('transaction number')) {
        date = row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        const d = parseFloat(row['amount debit'] || '0') || 0
        const c = parseFloat(row['amount credit'] || '0') || 0
        if (d > 0) {
          amount = d
        } else if (c > 0) {
          if (isIncome(desc)) {
            amount = c              // Salary → Income
          } else if (skipCredit(desc) || c < 20) {
            continue               // Skip interest and tiny credits
          } else {
            amount = -c            // Refund → negative expense
          }
        } else continue
        account = 'Axos Checking'

      // ── CAPITAL ONE 360 CHECKING
      // Detected by "transaction description" + "transaction type" columns
      // Date format: MM/DD/YY  Amount always positive, direction from Transaction Type
      } else if (row['transaction description'] !== undefined && row['transaction type'] !== undefined) {
        date = row['transaction date'] || ''
        desc = row['transaction description'] || ''
        if (isTransfer(desc)) continue
        const typ = (row['transaction type'] || '').toLowerCase()
        const raw = parseFloat(row['transaction amount'] || '0') || 0
        if (typ === 'debit') {
          amount = raw
          if (!amount) continue
        } else if (typ === 'credit') {
          if (isIncome(desc)) {
            amount = raw            // Payroll/tax refund → Income
          } else if (skipCredit(desc) || raw < 20) {
            continue               // Skip interest, check deposits, Zelle received, tiny credits
          } else {
            amount = -raw          // Real refund → negative expense
          }
        } else continue
        account = 'CapOne Checking'

      // ── VENTURE X (Capital One credit card)
      // Detected by "card no." column header
      // Separate Debit / Credit columns, dates YYYY-MM-DD
      } else if (fn.includes('VENTURE') || row['card no.'] !== undefined) {
        date = row['transaction date'] || row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        const d = parseFloat(row['debit'] || '0') || 0
        const c = parseFloat(row['credit'] || '0') || 0
        if (d > 0) {
          amount = d
        } else if (c > 0) {
          amount = -c              // Merchant credit
        } else continue
        account = 'Venture X'

      // ── CHASE CREDIT CARDS
      // Detected by "post date" column header
      // Single Amount column: negative = purchase, positive = credit
      } else if (fn.includes('CHASE') || row['post date'] !== undefined) {
        date = row['transaction date'] || row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        const tt = (row['type'] || '').toLowerCase()
        const raw = parseFloat(row['amount'] || '0') || 0
        if (tt === 'payment') continue
        if (raw < 0) {
          amount = Math.abs(raw)   // Normal purchase
        } else if (raw > 0 && tt === 'adjustment') {
          amount = -raw            // Merchant credit/refund
        } else continue
        account = fn.includes('6949') ? 'Chase Prime Visa'
                : fn.includes('3914') ? 'Chase Sapphire'
                : fn.includes('AMAZON') ? 'Chase Amazon'
                : 'Chase'

      // ── BARCLAYS
      } else if (fn.includes('BARCLAY')) {
        date = row['transaction date'] || row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        const raw = parseAmt(row['amount'] || '0')
        if (raw >= 0) continue
        amount = Math.abs(raw)
        account = 'Barclays'

      } else continue

      if (!date || !desc || amount === 0) continue

      // Normalize date → YYYY-MM-DD
      let d
      if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
        d = date.substring(0, 10)
      } else if (date.includes('/')) {
        const p = date.split('/')
        const yr = p[2]?.length === 2 ? '20' + p[2] : p[2]
        d = `${yr}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}`
      } else continue

      if (!d || d < '2025-09-01') continue

      txns.push({
        date: d,
        description: desc.substring(0, 100),
        amount: Math.round(amount * 100) / 100,
        account,
        category: autoCategorize(desc),
      })
    } catch (e) {}
  }
  return txns
}

export default function UploadTab({ transactions, onSave }) {
  const [staged, setStaged] = useState([])
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const dropRef = useRef(null)

  function onDrop(e) { e.preventDefault(); dropRef.current?.classList.remove('drag'); handleFiles(e.dataTransfer.files) }
  function onDragOver(e) { e.preventDefault(); dropRef.current?.classList.add('drag') }
  function onDragLeave() { dropRef.current?.classList.remove('drag') }

  function handleFiles(files) {
    if (!files.length) return
    setStatus('Parsing files...')
    const allTxns = []
    let done = 0
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        allTxns.push(...parseCSV(e.target.result, file.name))
        done++
        if (done === files.length) processNew(allTxns)
      }
      reader.readAsText(file)
    })
  }

  function processNew(txns) {
    const existing = new Set(transactions.map(t => `${t.date}|${t.description}|${t.amount}`))
    const newT = txns.filter(t => !existing.has(`${t.date}|${t.description}|${t.amount}`))
    if (!newT.length) { setStatus('All transactions already exist — nothing new to add.'); return }
    setStaged(newT.sort((a, b) => b.date.localeCompare(a.date)))
    setStatus(`Found ${newT.length} new transactions. Review below before saving.`)
  }

  async function handleSave() {
    setSaving(true)
    const count = await onSave(staged)
    setStaged([])
    setStatus(`✓ ${count} transactions saved to your household.`)
    setSaving(false)
  }

  function updateStagedCat(idx, cat) { setStaged(prev => prev.map((t, i) => i === idx ? { ...t, category: cat } : t)) }
  function removeStaged(idx) { setStaged(prev => prev.filter((_, i) => i !== idx)) }

  // ── Mortgage auto-generator ──────────────────────────────────────────────
  const MORTGAGE_AMOUNT = 7600

  function getAllMortgageMonths() {
    // Generate all months from Sep 2025 to current month
    const months = []
    let d = new Date(2025, 8, 1) // Sep 2025
    const now = new Date()
    while (d <= now) {
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
      d.setMonth(d.getMonth()+1)
    }
    return months
  }

  function addMortgageMonths() {
    const allMonths = getAllMortgageMonths()
    const existing = new Set(transactions.map(t => `${t.date}|${t.description}|${t.amount}`))
    const alreadyHas = new Set(
      transactions.filter(t => t.account === 'Truist').map(t => t.date?.slice(0,7))
    )
    const mortgageTxns = allMonths
      .filter(m => !alreadyHas.has(m))
      .map(m => ({
        date: `${m}-05`,
        description: 'Truist Mortgage Payment',
        amount: MORTGAGE_AMOUNT,
        account: 'Truist',
        category: 'Mortgage & Housing',
      }))
      .filter(t => !existing.has(`${t.date}|${t.description}|${t.amount}`))

    if (!mortgageTxns.length) {
      setStatus('All mortgage months already added.')
      return
    }
    setStaged(prev => [...prev, ...mortgageTxns].sort((a,b) => b.date.localeCompare(a.date)))
    setStatus(`Added ${mortgageTxns.length} mortgage entries to review queue — save to confirm.`)
  }
  const credits = staged.filter(t => t.amount < 0 && t.category !== 'Income')
  const expenses = staged.filter(t => t.amount > 0 && t.category !== 'Income')

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <div>
          <div ref={dropRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            onClick={() => document.getElementById('fi-input').click()}
            style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '10px', padding: '36px', textAlign: 'center', cursor: 'pointer', transition: '.2s' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '5px' }}>Drop CSV files here</div>
            <div style={{ fontSize: '12.5px', color: '#9499b8' }}>Capital One · Chase · Venture X · Axos · Truist · Barclays</div>
          </div>
          <input id="fi-input" type="file" accept=".csv,.CSV" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          {status && (
            <div className={`alert ${status.startsWith('✓') ? 'alert-ok' : status.includes('nothing') ? 'alert-ok' : 'alert-info'}`} style={{ marginTop: '12px' }}>
              {status}
            </div>
          )}
        </div>

        <div className="card">
          <div className="label" style={{ marginBottom: '10px' }}>Supported formats</div>
          <div style={{ fontSize: '12px', color: '#9499b8', lineHeight: '2' }}>
            <strong style={{ color: '#eef0f8' }}>Axos Checking</strong> — filename: 100001755451-...<br />
            <strong style={{ color: '#eef0f8' }}>CapOne 360 Checking</strong> — filename: 360Checking...<br />
            <strong style={{ color: '#eef0f8' }}>Venture X</strong> — filename: transaction_download<br />
            <strong style={{ color: '#eef0f8' }}>Chase Sapphire</strong> — filename includes 3914<br />
            <strong style={{ color: '#eef0f8' }}>Chase Prime Visa</strong> — filename includes 6949<br />
            <strong style={{ color: '#eef0f8' }}>Truist Mortgage</strong> — filename: acct_6230...
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: '12px', paddingTop: '12px' }}>
            <div className="label" style={{ marginBottom: '6px' }}>Auto-rules</div>
            <div style={{ fontSize: '12px', color: '#9499b8', lineHeight: '1.9' }}>
              Veeco / Guidehouse payroll → <span style={{color:'#2dd4a0'}}>Income</span><br />
              IRS / VA tax refunds → <span style={{color:'#2dd4a0'}}>Income</span><br />
              Zelle to Nicoly / Anne → Childcare<br />
              Zelle to Mirian / Banegas → Home Services<br />
              Cultural Care → Childcare<br />
              Tesla Finance / HMF / Macys Auto → Car Payments<br />
              CC payments, savings transfers → excluded<br />
              Bank interest, check deposits → excluded
            </div>
          </div>
        </div>
      </div>

      {/* Mortgage auto-generator — always visible */}
      <div className="card" style={{ marginBottom:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px' }}>
        <div>
          <div style={{ fontSize:'13px', fontWeight:'600', marginBottom:'3px' }}>🏠 Truist Mortgage</div>
          <div style={{ fontSize:'12px', color:'#9499b8' }}>
            Auto-generate <strong style={{color:'#eef0f8'}}>$7,600/mo</strong> entries for Sep 2025 → today. Already-added months are skipped automatically.
          </div>
        </div>
        <button className="btn-primary" onClick={addMortgageMonths}
          style={{ padding:'7px 16px', fontSize:'12px', whiteSpace:'nowrap', flexShrink:0 }}>
          Add mortgage entries
        </button>
      </div>

      {staged.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {staged.length} new transactions —
                <span style={{ color: '#2dd4a0', marginLeft: '8px' }}>{income.length} income</span>
                <span style={{ color: '#9d7ff4', marginLeft: '8px' }}>{credits.length} credits</span>
                <span style={{ color: '#eef0f8', marginLeft: '8px' }}>{expenses.length} expenses</span>
              </div>
              <div style={{ fontSize: '12px', color: '#9499b8', marginTop: '3px' }}>
                Review before saving. Income shown in green, credits in purple.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-outline" onClick={() => { setStaged([]); setStatus('') }} style={{ padding: '6px 12px', fontSize: '12px' }}>Discard</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '6px 12px', fontSize: '12px' }}>
                {saving ? 'Saving...' : `Save ${staged.length} transactions`}
              </button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '450px' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Account</th><th>Category</th><th></th>
                </tr>
              </thead>
              <tbody>
                {staged.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#9499b8' }}>{t.date}</td>
                    <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.description}>{t.description}</td>
                    <td style={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: '600',
                      color: t.category === 'Income' ? '#2dd4a0' : t.amount < 0 ? '#9d7ff4' : 'inherit' }}>
                      {t.category === 'Income' ? '+' : t.amount < 0 ? '−' : ''}{fmt(Math.abs(t.amount))}
                    </td>
                    <td style={{ fontSize: '11.5px', color: '#9499b8' }}>{t.account}</td>
                    <td>
                      <select value={t.category} onChange={e => updateStagedCat(i, e.target.value)}
                        style={{ fontSize: '11.5px', padding: '3px 6px', width: 'auto', minWidth: '150px' }}>
                        {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <button onClick={() => removeStaged(i)}
                        style={{ background: 'none', border: 'none', color: '#9499b8', cursor: 'pointer', fontSize: '15px' }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}