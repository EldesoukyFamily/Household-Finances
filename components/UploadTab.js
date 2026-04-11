import { useState, useRef } from 'react'
import { autoCategorize, fmt, ALL_CATEGORIES } from '../lib/constants'

// Clean dollar strings like ($7,600.70) or -$515.09 → number
function parseAmt(str) {
  if (str === null || str === undefined || str === '') return 0
  const s = String(str).trim()
  const negative = s.startsWith('(') || s.startsWith('-')
  const clean = s.replace(/[$(),\s]/g, '')
  const val = parseFloat(clean) || 0
  return negative ? -val : val
}

// Descriptions that are always internal transfers — never import
const TRANSFER_KEYWORDS = [
  'KIDS SAVINGS', 'SAVINGS ACCOUNT', 'CRCARDPMT', 'BARCLAYCARD US CREDITCARD',
  'MOBILE PMT', 'AUTOPAY', 'CREDIT CARD PMT', 'AUTOMATIC PAYMENT',
]
function isTransfer(desc) {
  const d = (desc || '').toUpperCase()
  return TRANSFER_KEYWORDS.some(k => d.includes(k))
}

// Payroll / income deposits — import as "Income" category (not expenses)
const INCOME_KEYWORDS = ['PAYROLL', 'VEECO INSTRUMENT', 'GUIDEHOUSE', 'TAX REF', 'IRS   TREAS', 'DIRECT DEP']
function isIncome(desc) {
  const d = (desc || '').toUpperCase()
  return INCOME_KEYWORDS.some(k => d.includes(k))
}

function parseCSV(text, fname) {
  const fn = fname.toUpperCase()
  const lines = text.split('\n').map(l => l.trim().replace(/\r$/, '')).filter(l => l)

  // Find header row (first row containing 'date' or 'transaction')
  let hi = 0
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    if (lines[i].toLowerCase().includes('date') || lines[i].toLowerCase().includes('transaction')) { hi = i; break }
  }

  const heads = lines[hi].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
  const txns = []

  for (let i = hi + 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 3) continue
    const row = {}
    heads.forEach((h, idx) => { row[h] = cols[idx] || '' })

    try {
      let date = '', desc = '', amount = 0, account = ''

      // ─────────────────────────────────────────────────
      // TRUIST MORTGAGE
      // Detected by filename OR unique "Full description" column header
      // Amount format: ($7,600.70)
      // ─────────────────────────────────────────────────
      if (fn.includes('TRUIST') || heads.includes('full description')) {
        date = row['posted date'] || row['transaction date'] || ''
        desc = row['full description'] || row['description'] || 'Mortgage Payment'
        if (isTransfer(desc)) continue
        amount = Math.abs(parseAmt(row['amount'] || '0'))
        if (!amount) continue
        account = 'Truist'

      // ─────────────────────────────────────────────────
      // AXOS CHECKING
      // Headers: Account Number, Transaction Number, Date, Transaction Type,
      //          Description, Memo, Amount Debit, Amount Credit, Balance, ...
      // Debits: Amount Debit column populated
      // Credits: Amount Credit column populated (payroll, refunds)
      // ─────────────────────────────────────────────────
      } else if (fn.includes('AXOS') || heads.includes('transaction number')) {
        date = row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        const debitAmt  = parseFloat(row['amount debit']  || '0') || 0
        const creditAmt = parseFloat(row['amount credit'] || '0') || 0
        if (debitAmt > 0) {
          amount = debitAmt
        } else if (creditAmt > 0) {
          if (isIncome(desc)) {
            amount = creditAmt   // Import salary as positive Income
          } else {
            amount = -creditAmt  // Other credits reduce spending
          }
        } else continue
        account = 'Axos Checking'

      // ─────────────────────────────────────────────────
      // CAPITAL ONE 360 CHECKING
      // Headers: Account Number, Transaction Description, Transaction Date,
      //          Transaction Type, Transaction Amount, Balance
      // Transaction Type: "Debit" or "Credit"
      // ─────────────────────────────────────────────────
      } else if (row['transaction description'] !== undefined && row['transaction type'] !== undefined) {
        date = row['transaction date'] || ''
        desc = row['transaction description'] || ''
        if (isTransfer(desc)) continue
        const typ    = (row['transaction type'] || '').toLowerCase()
        const rawAmt = parseFloat(row['transaction amount'] || '0') || 0
        if (typ === 'debit') {
          amount = rawAmt
          if (!amount) continue
        } else if (typ === 'credit') {
          if (isIncome(desc)) {
            amount = rawAmt     // Payroll/tax refund → positive Income
          } else if (rawAmt < 2) {
            continue            // Skip tiny interest credits (noise)
          } else {
            amount = -rawAmt    // Other credits reduce spending
          }
        } else continue
        account = 'CapOne Checking'

      // ─────────────────────────────────────────────────
      // VENTURE X (Capital One credit card)
      // Headers: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit
      // ─────────────────────────────────────────────────
      } else if (fn.includes('VENTURE') || row['card no.'] !== undefined) {
        date = row['transaction date'] || row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        const debit  = parseFloat(row['debit']  || '0') || 0
        const credit = parseFloat(row['credit'] || '0') || 0
        if (debit > 0) {
          amount = debit
        } else if (credit > 0) {
          amount = -credit      // Refund/credit — reduces spending
        } else continue
        account = 'Venture X'

      // ─────────────────────────────────────────────────
      // CHASE CREDIT CARDS (Prime Visa, Sapphire, Amazon)
      // Headers: Transaction Date, Post Date, Description, Category, Type, Amount, Memo
      // Amount: negative = purchase, positive = credit/refund
      // Type: Sale | Payment | Adjustment
      // ─────────────────────────────────────────────────
      } else if (fn.includes('CHASE') || row['post date'] !== undefined) {
        date = row['transaction date'] || row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        const tt     = (row['type'] || '').toLowerCase()
        const rawAmt = parseFloat(row['amount'] || '0') || 0
        if (tt === 'payment') continue                  // CC payment — skip
        if (rawAmt < 0) {
          amount = Math.abs(rawAmt)                     // Normal purchase
        } else if (rawAmt > 0 && tt === 'adjustment') {
          amount = -rawAmt                              // Merchant credit/refund
        } else continue
        account = fn.includes('AMAZON') || fn.includes('6949') ? 'Chase Prime Visa'
                : fn.includes('SAPPHIRE') || fn.includes('3914') ? 'Chase Sapphire'
                : 'Chase'

      // ─────────────────────────────────────────────────
      // BARCLAYS
      // ─────────────────────────────────────────────────
      } else if (fn.includes('BARCLAY')) {
        date = row['transaction date'] || row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        const rawAmt = parseAmt(row['amount'] || '0')
        if (rawAmt >= 0) continue
        amount = Math.abs(rawAmt)
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

      if (!d || d < '2025-08-01') continue

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
    setStaged(newT)
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

  const expenses = staged.filter(t => t.amount > 0)
  const credits  = staged.filter(t => t.amount < 0)

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
            <strong style={{ color: '#eef0f8' }}>Chase</strong> — Prime Visa, Sapphire, Amazon<br />
            <strong style={{ color: '#eef0f8' }}>Capital One</strong> — Venture X, 360 Checking<br />
            <strong style={{ color: '#eef0f8' }}>Axos</strong> — Checking (debit + credit columns)<br />
            <strong style={{ color: '#eef0f8' }}>Truist</strong> — Mortgage statement<br />
            <strong style={{ color: '#eef0f8' }}>Barclays</strong> — Credit card
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: '12px', paddingTop: '12px' }}>
            <div className="label" style={{ marginBottom: '6px' }}>Auto-rules</div>
            <div style={{ fontSize: '12px', color: '#9499b8', lineHeight: '1.9' }}>
              Payroll (Veeco / Guidehouse) → Income<br />
              Zelle to Nicoly / Anne → Childcare<br />
              Zelle to Mirian → Home Services<br />
              Cultural Care → Childcare<br />
              Merchant credits → negative (reduce spend)<br />
              CC payments & transfers → excluded
            </div>
          </div>
        </div>
      </div>

      {staged.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {staged.length} new transactions — {expenses.length} expenses, {credits.length} credits
              </div>
              <div style={{ fontSize: '12px', color: '#9499b8' }}>
                Income rows are excluded from spending totals. Credits shown in green reduce spending.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-outline" onClick={() => { setStaged([]); setStatus('') }} style={{ padding: '6px 12px', fontSize: '12px' }}>Discard</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '6px 12px', fontSize: '12px' }}>
                {saving ? 'Saving...' : 'Save to household'}
              </button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
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
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                    <td style={{ fontFamily: 'monospace', textAlign: 'right', color: t.amount < 0 ? '#2dd4a0' : t.category === 'Income' ? '#4f8ef7' : 'inherit' }}>
                      {t.amount < 0 ? `−${fmt(Math.abs(t.amount))}` : `+${fmt(t.amount)}`}
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
