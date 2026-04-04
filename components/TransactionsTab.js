import { useState } from 'react'
import { NON_RECURRING, fmt, catColor, ALL_CATEGORIES } from '../lib/constants'

const MONTHS = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03']
const ML =     ['Aug-25','Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26']

export default function TransactionsTab({ transactions, baseline, onUpdateCategory, onDelete, onToggleBusiness }) {
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('')
  const [fMo, setFMo] = useState('')
  const [showNR, setShowNR] = useState(false)
  const [showBiz, setShowBiz] = useState(false)
  const [bizOnly, setBizOnly] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  let rows = [...transactions]
  if (bizOnly) rows = rows.filter(t => t.is_business)
  else if (!showBiz) rows = rows.filter(t => !t.is_business)
  if (!showNR) rows = rows.filter(t => !NON_RECURRING.has(t.category))
  if (q) rows = rows.filter(t => t.description?.toLowerCase().includes(q.toLowerCase()) || t.category?.toLowerCase().includes(q.toLowerCase()))
  if (fCat) rows = rows.filter(t => t.category === fCat)
  if (fMo) rows = rows.filter(t => t.date?.startsWith(fMo))

  rows.sort((a, b) => {
    let av, bv
    if (sortBy === 'date') { av = a.date; bv = b.date }
    else { av = parseFloat(a.amount); bv = parseFloat(b.amount) }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const allCats = [...new Set(transactions.map(t => t.category))].sort()
  const total = rows.reduce((s, t) => s + parseFloat(t.amount), 0)
  const bizCount = transactions.filter(t => t.is_business).length

  // Baseline chart
  const baselineAmt = baseline?.[fCat] || 0
  const chartMonths = fMo ? [fMo] : MONTHS
  const chartLabels = fMo ? [ML[MONTHS.indexOf(fMo)]] : ML
  const chartActuals = chartMonths.map(m =>
    transactions
      .filter(t => t.date?.startsWith(m) && t.category === fCat && !t.is_business)
      .reduce((s, t) => s + parseFloat(t.amount), 0)
  )
  const maxBar = Math.max(baselineAmt, ...chartActuals, 1)
  const avgActual = chartActuals.reduce((s, v) => s + v, 0) / chartActuals.length

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity:0.3, fontSize:'10px', marginLeft:'4px' }}>↕</span>
    return <span style={{ fontSize:'10px', marginLeft:'4px', color:'#4f8ef7' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

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
      {/* Filters */}
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
        <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color: showBiz || bizOnly ? '#f5a623' : '#9499b8', cursor:'pointer' }}>
          <input type="checkbox" checked={showBiz} onChange={e=>{ setShowBiz(e.target.checked); if (!e.target.checked) setBizOnly(false) }} />
          Show business ({bizCount})
        </label>
        {showBiz && (
          <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color: bizOnly ? '#f5a623' : '#9499b8', cursor:'pointer' }}>
            <input type="checkbox" checked={bizOnly} onChange={e=>setBizOnly(e.target.checked)} />
            Business only
          </label>
        )}
        <span style={{ marginLeft:'auto', fontSize:'12px', color:'#9499b8' }}>
          {rows.length} transactions · {fmt(total)}
        </span>
      </div>

      {/* Baseline chart — only when a category is selected */}
      {fCat && (
        <div className="card" style={{ marginBottom:'14px', padding:'14px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
            <div>
              <span style={{ fontSize:'13px', fontWeight:'600' }}>{fCat}</span>
              <span style={{ fontSize:'12px', color:'#9499b8', marginLeft:'10px' }}>actual vs baseline</span>
            </div>
            <div style={{ display:'flex', gap:'16px', fontSize:'11.5px' }}>
              <span style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                <span style={{ width:'10px', height:'10px', borderRadius:'2px', background:catColor(fCat), display:'inline-block' }}/>
                Actual
              </span>
              {baselineAmt > 0 && (
                <span style={{ display:'flex', alignItems:'center', gap:'5px', color:'#9499b8' }}>
                  <span style={{ width:'12px', height:'0', border:'1.5px dashed #4f8ef7', display:'inline-block' }}/>
                  Baseline {fmt(baselineAmt)}
                </span>
              )}
            </div>
          </div>

          {/* Bars */}
          <div style={{ display:'flex', gap:'6px', alignItems:'flex-end', height:'90px', position:'relative' }}>
            {chartActuals.map((actual, i) => {
              const pct = Math.round(actual / maxBar * 100)
              const over = baselineAmt > 0 && actual > baselineAmt
              const baselinePct = baselineAmt > 0 ? Math.round(baselineAmt / maxBar * 100) : 0
              return (
                <div key={chartMonths[i]} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', justifyContent:'flex-end', position:'relative' }}>
                  {baselineAmt > 0 && (
                    <div style={{ position:'absolute', bottom:`calc(${baselinePct}% + 14px)`, left:0, right:0, borderTop:'1.5px dashed #4f8ef7', zIndex:2, pointerEvents:'none' }}/>
                  )}
                  <div
                    title={`${chartLabels[i]}: ${fmt(actual)}${baselineAmt > 0 ? ` · baseline: ${fmt(baselineAmt)}` : ''}`}
                    style={{ width:'100%', height:`${Math.max(pct, 2)}%`, background: over ? '#e05c5c' : catColor(fCat), borderRadius:'3px 3px 0 0', transition:'height .3s', position:'relative', zIndex:1, cursor:'default' }}
                  />
                  <div style={{ fontSize:'10px', color:'#9499b8', whiteSpace:'nowrap', marginTop:'4px' }}>{chartLabels[i]}</div>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div style={{ display:'flex', gap:'20px', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid rgba(255,255,255,0.07)', fontSize:'12px', flexWrap:'wrap' }}>
            <span style={{ color:'#9499b8' }}>Total: <span style={{ color:'#fff', fontWeight:'600' }}>{fmt(total)}</span></span>
            {chartActuals.length > 1 && (
              <span style={{ color:'#9499b8' }}>Avg/mo: <span style={{ color:'#fff', fontWeight:'600' }}>{fmt(avgActual)}</span></span>
            )}
            {baselineAmt > 0 && (
              <>
                <span style={{ color:'#9499b8' }}>Baseline: <span style={{ color:'#4f8ef7', fontWeight:'600' }}>{fmt(baselineAmt)}</span></span>
                <span style={{ color: avgActual > baselineAmt ? '#e05c5c' : '#2dd4a0', fontWeight:'600' }}>
                  {avgActual > baselineAmt ? '▲ Over' : '▼ Under'} by {fmt(Math.abs(avgActual - baselineAmt))}/mo avg
                </span>
              </>
            )}
            {!baselineAmt && (
              <span style={{ color:'#9499b8', fontSize:'11.5px' }}>No baseline set · go to Baseline tab to add one</span>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding:0 }}>
        <div style={{ overflowY:'auto', maxHeight:'520px' }}>
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort('date')} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
                  Date <SortIcon col="date" />
                </th>
                <th>Description</th>
                <th style={{ textAlign:'right', cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={() => toggleSort('amount')}>
                  Amount <SortIcon col="amount" />
                </th>
                <th>Account</th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map(t => (
                <tr key={t.id} style={ t.is_business ? { opacity:0.75, background:'rgba(245,166,35,0.04)' } : {} }>
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
                          style={{ background: t.is_business ? 'rgba(245,166,35,0.15)' : 'none', border:`1px solid ${t.is_business ? 'rgba(245,166,35,0.4)' : 'rgba(255,255,255,0.1)'}`, color: t.is_business ? '#f5a623' : '#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px', marginRight:'4px' }}>
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
