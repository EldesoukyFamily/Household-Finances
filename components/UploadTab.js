import { useState, useRef } from 'react'
import { autoCategorize, fmt, ALL_CATEGORIES } from '../lib/constants'

// Descriptions that are always internal transfers — never import as expenses
const TRANSFER_SKIP = [
  'KIDS SAVINGS','SAVINGS ACCOUNT','CRCARDPMT','BARCLAYCARD','MOBILE PMT',
  'AUTOPAY','CREDIT CARD PMT','CHASE CREDIT','CAPITAL ONE','CREDITCARD',
]

function isTransfer(desc) {
  const d = desc.toUpperCase()
  return TRANSFER_SKIP.some(k => d.includes(k))
}

function parseCSV(text, fname) {
  const fn = fname.toUpperCase()
  const lines = text.split('\n').map(l => l.trim()).filter(l => l)

  // Find header row
  let hi = 0
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    if (lines[i].toLowerCase().includes('date') || lines[i].toLowerCase().includes('transaction')) { hi = i; break }
  }

  const heads = lines[hi].split(',').map(h => h.trim().replace(/"/g,'').toLowerCase())
  const txns = []

  for (let i = hi+1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g,''))
    if (cols.length < 3) continue
    const row = {}; heads.forEach((h,idx) => { row[h] = cols[idx]||'' })
    try {
      let date='', desc='', amount=0, account=''

      // ── Format: separate "amount debit" + "amount credit" columns (Capital One 360, Axos, etc.)
      const hasDebitCol = heads.some(h => h.includes('amount debit') || h === 'amount de')
      const hasCreditCol = heads.some(h => h.includes('amount credit'))

      if (hasDebitCol || hasCreditCol) {
        // Find actual column keys (handles leading/trailing spaces in headers)
        const debitKey  = heads.find(h => h.includes('amount debit') || h === 'amount de') || ''
        const creditKey = heads.find(h => h.includes('amount credit')) || ''
        const dateKey   = heads.find(h => h === 'date' || h.includes('transaction date')) || 'date'
        const descKey   = heads.find(h => h === 'description' || h.includes('transaction description')) || 'description'

        date = row[dateKey] || ''
        desc = row[descKey] || ''
        if (isTransfer(desc)) continue

        const debitAmt  = parseFloat(row[debitKey]  || '0') || 0
        const creditAmt = parseFloat(row[creditKey] || '0') || 0
        const typ = (row['transaction type'] || row['type'] || '').toLowerCase()

        if (debitAmt > 0) {
          // It's an expense/payment
          amount = debitAmt
        } else if (creditAmt > 0) {
          // It's a credit — import as negative (reduces spending), but skip payroll/income
          const isPayroll = desc.toUpperCase().includes('PAYROLL') || desc.toUpperCase().includes('DIRECT DEP')
          if (isPayroll) continue   // Income — not a transaction expense
          amount = -creditAmt       // Negative = refund/credit
        } else {
          continue
        }

        account = fn.includes('AXOS') ? (fn.includes('SAVING') ? 'Axos Savings' : 'Axos Checking')
                : fn.includes('SAVING') ? 'CapOne Savings'
                : 'CapOne Checking'

      // ── Capital One credit card CSV (single amount column)
      } else if (row['transaction description'] && row['transaction type'] && !hasDebitCol) {
        date = row['transaction date'] || ''
        desc = row['transaction description'] || ''
        if (isTransfer(desc)) continue
        const typ = (row['transaction type']||'').toLowerCase()
        const rawAmt = parseFloat(row['transaction amount']||'0')
        if (typ === 'debit' || rawAmt < 0) {
          amount = Math.abs(rawAmt)
          if (!amount) continue
        } else if (typ === 'credit' || rawAmt > 0) {
          amount = -Math.abs(rawAmt)  // Credit/refund
        } else continue
        account = fn.includes('CHECKING') ? 'CapOne Checking' : fn.includes('SAVINGS') ? 'CapOne Savings' : 'Venture X'

      // ── Chase (single Amount column: negative = purchase, positive = credit/refund)
      } else if (fn.includes('CHASE') || row['card no.'] !== undefined || (row['debit'] !== undefined && row['posted date'] !== undefined)) {
        date = row['transaction date'] || row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        const tt = (row['type']||'').toLowerCase()
        if (tt === 'payment') continue  // Skip CC payments

        // Format 1: separate Debit column
        if (row['debit'] !== undefined && row['debit'] !== '') {
          amount = parseFloat(row['debit'] || '0')
          if (!amount || amount <= 0) continue
        } else {
          // Format 2: single Amount column (negative = charge, positive = credit/refund)
          const rawAmt = parseFloat(row['amount'] || '0')
          if (rawAmt < 0) {
            amount = Math.abs(rawAmt)   // Normal purchase
          } else if (rawAmt > 0 && tt === 'adjustment') {
            amount = -rawAmt            // Credit/refund — reduces spending
          } else {
            continue                    // Zero or unhandled positive
          }
        }
        account = fn.includes('SAPPHIRE') ? 'Chase Sapphire' : fn.includes('AMAZON') ? 'Chase Amazon' : 'Chase Sapphire'

      // ── Barclays
      } else if (fn.includes('BARCLAY')) {
        date = row['transaction date'] || row['date'] || ''
        desc = row['description'] || ''
        if (isTransfer(desc)) continue
        amount = parseFloat(row['amount'] || '0')
        if ((row['category']||'').toUpperCase() === 'CREDIT' || amount >= 0) continue
        amount = Math.abs(amount); account = 'Barclays'

      // ── Truist
      } else if (fn.includes('TRUIST')) {
        date = row['date'] || ''
        desc = row['description'] || row['memo'] || 'Truist Mortgage Payment'
        amount = parseFloat(row['amount'] || row['debit'] || '0')
        if (amount <= 0) continue; account = 'Truist'

      } else continue

      if (!date || !desc || amount === 0) continue

      // Normalize date to YYYY-MM-DD
      let d
      if (date.includes('-')) d = date.substring(0,10)
      else if (date.includes('/')) {
        const p = date.split('/')
        const yr = p[2]?.length === 2 ? '20'+p[2] : p[2]
        d = `${yr}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`
      } else continue

      if (!d || d < '2025-08-01') continue
      txns.push({ date:d, description:desc.substring(0,100), amount:Math.round(amount*100)/100, account, category:autoCategorize(desc) })
    } catch(e) {}
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

  function updateStagedCat(idx, cat) { setStaged(prev => prev.map((t,i) => i===idx ? {...t,category:cat} : t)) }
  function removeStaged(idx) { setStaged(prev => prev.filter((_,i) => i!==idx)) }

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
        <div>
          <div ref={dropRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            onClick={() => document.getElementById('fi-input').click()}
            style={{ border:'2px dashed rgba(255,255,255,0.15)', borderRadius:'10px', padding:'36px', textAlign:'center', cursor:'pointer', transition:'.2s' }}>
            <div style={{ fontSize:'28px', marginBottom:'8px' }}>📂</div>
            <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'5px' }}>Drop CSV files here</div>
            <div style={{ fontSize:'12.5px', color:'#9499b8' }}>Capital One · Chase · Axos · Barclays · Truist</div>
          </div>
          <input id="fi-input" type="file" accept=".csv,.CSV" multiple style={{ display:'none' }} onChange={e=>handleFiles(e.target.files)} />
          {status && (
            <div className={`alert ${status.startsWith('✓')?'alert-ok':status.includes('nothing')?'alert-ok':'alert-info'}`} style={{ marginTop:'12px' }}>
              {status}
            </div>
          )}
        </div>

        <div className="card">
          <div className="label" style={{ marginBottom:'10px' }}>How it works</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {['Export CSVs from each bank for the new month','Drop all files at once — any order','Auto-categorizes using your household rules','Review & change any category, then save'].map((s,i) => (
              <div key={i} style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                <div style={{ width:'20px', height:'20px', borderRadius:'50%', background:'#4f8ef7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'700', flexShrink:0, color:'#fff' }}>{i+1}</div>
                <div style={{ fontSize:'12.5px', color:'#9499b8' }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', marginTop:'14px', paddingTop:'12px' }}>
            <div className="label" style={{ marginBottom:'6px' }}>Smart rules</div>
            <div style={{ fontSize:'12px', color:'#9499b8', lineHeight:'1.8' }}>
              Credits & refunds → imported as negative amounts<br/>
              Payroll deposits → excluded (income tracked separately)<br/>
              Cultural Care → Childcare & Education<br/>
              Truist → Mortgage & Housing<br/>
              Zelle Nicoly/Anne → Childcare<br/>
              Zelle Mirian → Home Services<br/>
              CC payments & transfers → excluded
            </div>
          </div>
        </div>
      </div>

      {staged.length > 0 && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <div>
              <div style={{ fontSize:'14px', fontWeight:'600' }}>{staged.length} new transactions to review</div>
              <div style={{ fontSize:'12px', color:'#9499b8' }}>Credits show as negative amounts (they reduce your spending totals)</div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button className="btn-outline" onClick={()=>{setStaged([]);setStatus('')}} style={{ padding:'6px 12px', fontSize:'12px' }}>Discard</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding:'6px 12px', fontSize:'12px' }}>
                {saving ? 'Saving...' : 'Save to household'}
              </button>
            </div>
          </div>
          <div style={{ overflowY:'auto', maxHeight:'340px' }}>
            <table>
              <thead><tr><th>Date</th><th>Description</th><th style={{ textAlign:'right' }}>Amount</th><th>Account</th><th>Category</th><th></th></tr></thead>
              <tbody>
                {staged.map((t,i) => (
                  <tr key={i}>
                    <td style={{ fontFamily:'monospace', fontSize:'11.5px', color:'#9499b8' }}>{t.date}</td>
                    <td style={{ maxWidth:'240px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</td>
                    <td style={{ fontFamily:'monospace', textAlign:'right', color: t.amount < 0 ? '#2dd4a0' : 'inherit' }}>
                      {t.amount < 0 ? `−${fmt(Math.abs(t.amount))}` : fmt(t.amount)}
                    </td>
                    <td style={{ fontSize:'11.5px', color:'#9499b8' }}>{t.account}</td>
                    <td>
                      <select value={t.category} onChange={e=>updateStagedCat(i,e.target.value)} style={{ fontSize:'11.5px', padding:'3px 6px', width:'auto', minWidth:'150px' }}>
                        {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><button onClick={()=>removeStaged(i)} style={{ background:'none', border:'none', color:'#9499b8', cursor:'pointer', fontSize:'15px' }}>×</button></td>
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
