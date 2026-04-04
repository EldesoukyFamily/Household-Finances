import { useState } from 'react'
import { NON_RECURRING, fmt, catColor, ALL_CATEGORIES } from '../lib/constants'

const MONTHS = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03']
const ML =     ['Aug-25','Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26']

export default function TransactionsTab({ transactions, onUpdateCategory, onDelete, onToggleBusiness }) {
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('')
  const [fMo, setFMo] = useState('')
  const [showNR, setShowNR] = useState(false)
  const [showBiz, setShowBiz] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  let rows = [...transactions]
  if (!showBiz) rows = rows.filter(t => !t.is_business)
  if (!showNR) rows = rows.filter(t => !NON_RECURRING.has(t.category))
  if (q) rows = rows.filter(t => t.description?.toLowerCase().includes(q.toLowerCase()) || t.category?.toLowerCase().includes(q.toLowerCase()))
  if (fCat) rows = rows.filter(t => t.category === fCat)
  if (fMo) rows = rows.filter(t => t.date?.startsWith(fMo))

  const allCats = [...new Set(transactions.map(t => t.category))].sort()
  const total = rows.reduce((s, t) => s + parseFloat(t.amount), 0)
  const bizCount = transactions.filter(t => t.is_business).length

  async function handleCatChange(id, newCat) {
    await onUpdateCategory(id, newCat)
    setEditingId(null)
  }

  async function handleDelete(id, desc) {
    if (!confirm(`Delete "${desc}"?`)) return
    await onDelete(id)
  }

  async function handleToggleBusiness(t) {
    setTogglingId(t.id)
    await onToggleBusiness(t.id, !t.is_business)
    setTogglingId(null)
  }

  return (
    <div>
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'14px', alignItems:'center' }}>
        <input type="text" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." style={{ maxWidth:'200px' }} />
        <select value={fCat} onChange={e=>setFCat(e.target.value)} style={{ maxWidth:'200px' }}>
          <option value="">All categories</option>
          {allCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fMo} onChange={e=>setFMo(e.target.value)} style={{ maxWidth:'140px' }}>
          <option value="">All months</option>
          {MONTHS.map((m,i) => <option key={m} value={m}>{ML[i]}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#9499b8', cursor:'pointer', marginLeft:'4px' }}>
          <input type="checkbox" checked={showNR} onChange={e=>setShowNR(e.target.checked)} />
          Show non-recurring
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color: showBiz ? '#f5a623' : '#9499b8', cursor:'pointer' }}>
          <input type="checkbox" checked={showBiz} onChange={e=>setShowBiz(e.target.checked)} />
          Show business ({bizCount})
        </label>
        <span style={{ marginLeft:'auto', fontSize:'12px', color:'#9499b8' }}>
          {rows.length} transactions · {fmt(total)}
        </span>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div style={{ overflowY:'auto', maxHeight:'520px' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th style={{ textAlign:'right' }}>Amount</th>
                <th>Account</th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map(t => (
                <tr key={t.id} style={ t.is_business ? { opacity: 0.75, background: 'rgba(245,166,35,0.04)' } : {} }>
                  <td style={{ fontFamily:'monospace', color:'#9499b8', fontSize:'11.5px', whiteSpace:'nowrap' }}>{t.date}</td>
                  <td style={{ maxWidth:'260px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.description}>
                    {t.is_business && (
                      <span style={{ fontSize:'10px', fontWeight:'600', color:'#f5a623', background:'rgba(245,166,35,0.15)', border:'1px solid rgba(245,166,35,0.3)', borderRadius:'4px', padding:'1px 5px', marginRight:'6px', letterSpacing:'0.3px' }}>LLC</span>
                    )}
                    {t.description}
                  </td>
                  <td style={{ fontFamily:'monospace', textAlign:'right', fontWeight:'500' }}>{fmt(parseFloat(t.amount))}</td>
                  <td style={{ color:'#9499b8', fontSize:'11.5px' }}>{t.account}</td>
                  <td>
                    {editingId === t.id ? (
                      <select defaultValue={t.category} onChange={e=>handleCatChange(t.id, e.target.value)}
                        style={{ fontSize:'11.5px', padding:'3px 6px', width:'auto', minWidth:'150px' }}>
                        {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span className="badge" style={{ background:`${catColor(t.category)}22`, color:catColor(t.category), cursor:'pointer' }}
                        onClick={() => setEditingId(t.id)} title="Click to edit">
                        {t.category}
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace:'nowrap' }}>
                    {editingId === t.id ? (
                      <button onClick={()=>setEditingId(null)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.2)', color:'#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggleBusiness(t)}
                          disabled={togglingId === t.id}
                          title={t.is_business ? 'Mark as household expense' : 'Mark as business/LLC expense'}
                          style={{ background: t.is_business ? 'rgba(245,166,35,0.15)' : 'none', border: `1px solid ${t.is_business ? 'rgba(245,166,35,0.4)' : 'rgba(255,255,255,0.1)'}`, color: t.is_business ? '#f5a623' : '#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px', marginRight:'4px' }}>
                          {togglingId === t.id ? '...' : t.is_business ? 'LLC ✓' : 'Biz'}
                        </button>
                        <button onClick={()=>setEditingId(t.id)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.15)', color:'#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px', marginRight:'4px' }}>Edit</button>
                        <button onClick={()=>handleDelete(t.id, t.description)} style={{ background:'none', border:'none', color:'#9499b8', cursor:'pointer', fontSize:'15px', lineHeight:1 }}>×</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div style={{ padding:'40px', textAlign:'center', color:'#9499b8', fontSize:'13px' }}>No transactions found</div>}
        </div>
      </div>
    </div>
  )
}
