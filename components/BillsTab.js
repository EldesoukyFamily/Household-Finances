import { useState } from 'react'
import { fmt } from '../lib/constants'

const KNOWN_BILLS = [
  { name:'Capital One Venture X annual fee', amount:395, expected_month:'Feb 2027' },
  { name:'Chase Sapphire annual fee', amount:550, expected_month:'Sep 2026' },
  { name:'VYS Soccer — fall season', amount:1125, expected_month:'Aug 2026' },
]

const FUTURE_MONTHS = ['Apr 2026','May 2026','Jun 2026','Jul 2026','Aug 2026','Sep 2026','Oct 2026','Nov 2026','Dec 2026','Jan 2027','Feb 2027','Mar 2027']

export default function BillsTab({ bills, onAdd, onDelete }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!name || !amount || !month) return
    setAdding(true)
    await onAdd({ name, amount: parseFloat(amount), expected_month: month })
    setName(''); setAmount(''); setMonth('')
    setAdding(false)
  }

  const allBills = [...KNOWN_BILLS, ...bills]
  const total = allBills.reduce((s,b)=>s+parseFloat(b.amount),0)
  const monthly = Math.ceil(total/12)
  const maxAmt = Math.max(...allBills.map(b=>parseFloat(b.amount)),1)

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
        <div>
          {/* Add form */}
          <div className="card" style={{ marginBottom:'14px' }}>
            <div className="label" style={{ marginBottom:'12px' }}>Add expected bill</div>
            <form onSubmit={handleAdd} style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Bill name (e.g. Property Tax)" required />
              <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount ($)" required min="1" step="0.01" />
              <select value={month} onChange={e=>setMonth(e.target.value)} required>
                <option value="">Expected month</option>
                {FUTURE_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button className="btn-primary" type="submit" disabled={adding}>{adding?'Adding...':'Add to planner'}</button>
            </form>
          </div>

          {/* Bill list */}
          <div className="card">
            <div className="label" style={{ marginBottom:'12px' }}>All upcoming bills</div>

            <div style={{ marginBottom:'8px' }}>
              <div style={{ fontSize:'11.5px', color:'#9499b8', marginBottom:'6px', fontWeight:'500' }}>Built-in (recurring)</div>
              {KNOWN_BILLS.map((b,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize:'11px', fontFamily:'monospace', background:'var(--s3)', padding:'2px 7px', borderRadius:'5px', color:'#9499b8', flexShrink:0 }}>{b.expected_month.toUpperCase().replace(' ','-')}</span>
                  <span style={{ flex:1, fontSize:'12.5px' }}>{b.name}</span>
                  <span style={{ fontFamily:'monospace', fontWeight:'600' }}>{fmt(b.amount)}</span>
                </div>
              ))}
            </div>

            {bills.length > 0 && (
              <div style={{ marginTop:'8px' }}>
                <div style={{ fontSize:'11.5px', color:'#9499b8', marginBottom:'6px', fontWeight:'500' }}>Custom bills</div>
                {bills.map(b => (
                  <div key={b.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize:'11px', fontFamily:'monospace', background:'var(--s3)', padding:'2px 7px', borderRadius:'5px', color:'#9499b8', flexShrink:0 }}>{b.expected_month.toUpperCase().replace(' ','-')}</span>
                    <span style={{ flex:1, fontSize:'12.5px' }}>{b.name}</span>
                    <span style={{ fontFamily:'monospace', fontWeight:'600' }}>{fmt(b.amount)}</span>
                    <button onClick={()=>onDelete(b.id)} style={{ background:'none', border:'none', color:'#9499b8', cursor:'pointer', fontSize:'15px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reserve analysis */}
        <div className="card">
          <div className="label" style={{ marginBottom:'12px' }}>Reserve analysis</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
            {[
              ['Total known annual bills', fmt(total), '#eef0f8'],
              ['Monthly reserve needed', `${fmt(monthly)}/mo`, '#f5a623'],
              ['Revised savings target (incl. reserve)', `${fmt(1700+monthly)}/mo`, '#4f8ef7'],
            ].map(([l,v,c]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:'12.5px' }}>
                <span style={{ color:'#9499b8' }}>{l}</span>
                <span style={{ fontFamily:'monospace', fontWeight:'600', color:c }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="alert alert-warn" style={{ marginTop:'14px', fontSize:'12px' }}>
            Set aside <strong>{fmt(monthly)}/mo</strong> into a dedicated sinking fund. This way large annual bills don't disrupt your monthly cash flow.
          </div>

          <div style={{ marginTop:'18px' }}>
            <div className="label" style={{ marginBottom:'10px' }}>Bill timeline</div>
            {allBills.sort((a,b)=>a.expected_month.localeCompare(b.expected_month)).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 0', fontSize:'12px' }}>
                <span style={{ width:'65px', fontFamily:'monospace', color:'#9499b8', flexShrink:0 }}>{b.expected_month.replace(' ','-')}</span>
                <div style={{ flex:1, background:'var(--s3)', borderRadius:'3px', height:'12px', overflow:'hidden' }}>
                  <div style={{ width:`${Math.round(parseFloat(b.amount)/maxAmt*100)}%`, height:'100%', borderRadius:'3px', background:'#f5a623' }} />
                </div>
                <span style={{ width:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>{b.name}</span>
                <span style={{ fontFamily:'monospace', fontWeight:'600', color:'#f5a623', width:'52px', textAlign:'right', flexShrink:0 }}>{fmt(b.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
