import { useState } from 'react'
import { NON_RECURRING, fmt, catColor, ALL_CATEGORIES, toMonthLabel } from '../lib/constants'

export default function TransactionsTab({ transactions, baseline, onUpdateCategory, onDelete, onToggleBusiness, months = [] }) {
  const ML = months.map(toMonthLabel)
  const [view, setView]         = useState('expenses') // 'expenses' | 'income' | 'credits'
  const [q, setQ]               = useState('')
  const [fCat, setFCat]         = useState('')
  const [fMo, setFMo]           = useState('')
  const [showNR, setShowNR]     = useState(false)
  const [showBiz, setShowBiz]   = useState(false)
  const [bizOnly, setBizOnly]   = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [sortBy, setSortBy]     = useState('date')
  const [sortDir, setSortDir]   = useState('desc')

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  // Partition transactions by type
  const expenseRows = transactions.filter(t => parseFloat(t.amount) > 0 && t.category !== 'Income')
  const incomeRows  = transactions.filter(t => t.category === 'Income')
  const creditRows  = transactions.filter(t => parseFloat(t.amount) < 0)

  // Apply filters to whichever view is active
  let rows = view === 'income' ? incomeRows : view === 'credits' ? creditRows : expenseRows

  if (view === 'expenses') {
    if (bizOnly) rows = rows.filter(t => t.is_business)
    else if (!showBiz) rows = rows.filter(t => !t.is_business)
    if (!showNR) rows = rows.filter(t => !NON_RECURRING.has(t.category))
    if (fCat) rows = rows.filter(t => t.category === fCat)
  }
  if (q) rows = rows.filter(t =>
    t.description?.toLowerCase().includes(q.toLowerCase()) ||
    t.category?.toLowerCase().includes(q.toLowerCase())
  )
  if (fMo) rows = rows.filter(t => t.date?.startsWith(fMo))

  rows = [...rows].sort((a, b) => {
    let av = sortBy === 'date' ? a.date : parseFloat(a.amount)
    let bv = sortBy === 'date' ? b.date : parseFloat(b.amount)
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const allCats  = [...new Set(expenseRows.map(t => t.category))].sort()
  const bizCount = transactions.filter(t => t.is_business).length

  // Expense totals for baseline chart
  const baselineAmt  = baseline?.[fCat] || 0
  const chartMonths  = fMo ? [fMo] : months
  const chartLabels  = fMo ? [ML[months.indexOf(fMo)]] : ML
  const chartActuals = chartMonths.map(m =>
    expenseRows
      .filter(t => t.date?.startsWith(m) && t.category === fCat && !t.is_business)
      .reduce((s, t) => s + parseFloat(t.amount), 0)
  )
  const maxBar    = Math.max(baselineAmt, ...chartActuals, 1)
  const avgActual = chartActuals.reduce((s, v) => s + v, 0) / Math.max(chartActuals.length, 1)

  // Credits summary — total per category
  const creditsByCategory = creditRows
    .filter(t => fMo ? t.date?.startsWith(fMo) : true)
    .reduce((acc, t) => {
      const cat = t.category || 'Other'
      acc[cat] = (acc[cat] || 0) + parseFloat(t.amount)
      return acc
    }, {})
  const totalCredits = creditRows
    .filter(t => fMo ? t.date?.startsWith(fMo) : true)
    .reduce((s, t) => s + parseFloat(t.amount), 0)

  // Income summary — per month
  const incomeByMonth = months.map(m => ({
    month: m,
    label: ML[months.indexOf(m)],
    total: incomeRows.filter(t => t.date?.startsWith(m)).reduce((s, t) => s + parseFloat(t.amount), 0),
    count: incomeRows.filter(t => t.date?.startsWith(m)).length,
  })).filter(m => m.total > 0)
  const totalIncome = incomeRows.reduce((s, t) => s + parseFloat(t.amount), 0)

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

  // Shared tab button style
  const tabBtn = (id, label, count, color) => (
    <button key={id} onClick={() => { setView(id); setEditingId(null) }}
      style={{
        padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
        cursor: 'pointer', border: 'none', transition: '.15s',
        background: view === id ? (color || '#4f8ef7') : 'var(--s2)',
        color: view === id ? '#fff' : '#9499b8',
      }}>
      {label}
      <span style={{
        marginLeft: '7px', fontSize: '11px', fontWeight: '500',
        background: view === id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
        padding: '1px 7px', borderRadius: '10px',
      }}>{count}</span>
    </button>
  )

  return (
    <div>

      {/* View toggle */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
        {tabBtn('expenses', 'Expenses',        expenseRows.length, '#4f8ef7')}
        {tabBtn('income',   'Income',           incomeRows.length,  '#2dd4a0')}
        {tabBtn('credits',  'Credits & Returns', creditRows.length,  '#9d7ff4')}
      </div>

      {/* ── INCOME VIEW ─────────────────────────────── */}
      {view === 'income' && (
        <div>
          {/* Month filter + search */}
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px', alignItems:'center' }}>
            <input type="text" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." style={{ maxWidth:'200px' }} />
            <select value={fMo} onChange={e=>setFMo(e.target.value)} style={{ maxWidth:'140px' }}>
              <option value="">All months</option>
              {months.map((m,i) => <option key={m} value={m}>{ML[i]}</option>)}
            </select>
            <span style={{ marginLeft:'auto', fontSize:'12px', color:'#9499b8' }}>
              {rows.length} deposits · <span style={{ color:'#2dd4a0', fontWeight:'600' }}>{fmt(totalIncome)}</span> total
            </span>
          </div>

          {/* Monthly income summary cards */}
          {!fMo && incomeByMonth.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:'8px', marginBottom:'16px' }}>
              {incomeByMonth.map(m => (
                <div key={m.month} className="card" style={{ padding:'12px', textAlign:'center', cursor:'pointer' }}
                  onClick={() => setFMo(m.month)}>
                  <div style={{ fontSize:'11px', color:'#9499b8', marginBottom:'4px' }}>{m.label}</div>
                  <div style={{ fontSize:'15px', fontWeight:'700', color:'#2dd4a0' }}>{fmt(m.total)}</div>
                  <div style={{ fontSize:'11px', color:'#9499b8', marginTop:'2px' }}>{m.count} deposit{m.count !== 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize:'12px', color:'#9499b8', marginBottom:'10px', padding:'8px 12px', background:'rgba(45,212,160,0.06)', borderRadius:'6px', border:'1px solid rgba(45,212,160,0.15)' }}>
            💡 Income transactions are shown here for reference only — they don't affect spending totals or baseline comparisons.
          </div>

          <div className="card" style={{ padding:0 }}>
            <div style={{ overflowY:'auto', maxHeight:'480px' }}>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('date')} style={{ cursor:'pointer', userSelect:'none' }}>Date <SortIcon col="date" /></th>
                    <th>Description</th>
                    <th style={{ textAlign:'right', cursor:'pointer', userSelect:'none' }} onClick={() => toggleSort('amount')}>Amount <SortIcon col="amount" /></th>
                    <th>Account</th>
                    <th>Category</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontFamily:'monospace', color:'#9499b8', fontSize:'11.5px' }}>{t.date}</td>
                      <td style={{ maxWidth:'280px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.description}>{t.description}</td>
                      <td style={{ fontFamily:'monospace', textAlign:'right', fontWeight:'600', color:'#2dd4a0' }}>+{fmt(parseFloat(t.amount))}</td>
                      <td style={{ color:'#9499b8', fontSize:'11.5px' }}>{t.account}</td>
                      <td>
                        {editingId === t.id ? (
                          <select defaultValue={t.category} onChange={e=>handleCatChange(t.id, e.target.value)}
                            style={{ fontSize:'11.5px', padding:'3px 6px', width:'auto', minWidth:'150px' }}>
                            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <span className="badge" style={{ background:'rgba(45,212,160,0.15)', color:'#2dd4a0', cursor:'pointer' }}
                            onClick={() => setEditingId(t.id)}>{t.category}</span>
                        )}
                      </td>
                      <td>
                        {editingId === t.id
                          ? <button onClick={() => setEditingId(null)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.2)', color:'#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
                          : <><button onClick={() => setEditingId(t.id)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.15)', color:'#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px', marginRight:'4px' }}>Edit</button>
                             <button onClick={() => handleDelete(t.id, t.description)} style={{ background:'none', border:'none', color:'#9499b8', cursor:'pointer', fontSize:'15px' }}>×</button></>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <div style={{ padding:'40px', textAlign:'center', color:'#9499b8', fontSize:'13px' }}>No income transactions found</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── CREDITS & RETURNS VIEW ───────────────────── */}
      {view === 'credits' && (
        <div>
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px', alignItems:'center' }}>
            <input type="text" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." style={{ maxWidth:'200px' }} />
            <select value={fMo} onChange={e=>setFMo(e.target.value)} style={{ maxWidth:'140px' }}>
              <option value="">All months</option>
              {months.map((m,i) => <option key={m} value={m}>{ML[i]}</option>)}
            </select>
            <span style={{ marginLeft:'auto', fontSize:'12px', color:'#9499b8' }}>
              {rows.length} credits · <span style={{ color:'#9d7ff4', fontWeight:'600' }}>{fmt(Math.abs(totalCredits))}</span> returned
            </span>
          </div>

          {/* Credits by category summary */}
          {Object.keys(creditsByCategory).length > 0 && (
            <div className="card" style={{ marginBottom:'14px' }}>
              <div className="label" style={{ marginBottom:'10px' }}>Impact by category — these amounts reduce your spending totals</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {Object.entries(creditsByCategory).sort((a,b) => a[1]-b[1]).map(([cat, amt]) => (
                  <div key={cat} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'13px' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:catColor(cat), flexShrink:0 }}/>
                      {cat}
                    </span>
                    <span style={{ fontFamily:'monospace', fontWeight:'600', color:'#9d7ff4' }}>−{fmt(Math.abs(amt))}</span>
                  </div>
                ))}
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', marginTop:'4px', paddingTop:'8px', display:'flex', justifyContent:'space-between', fontSize:'13px', fontWeight:'600' }}>
                  <span>Total returned</span>
                  <span style={{ color:'#9d7ff4' }}>−{fmt(Math.abs(totalCredits))}</span>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding:0 }}>
            <div style={{ overflowY:'auto', maxHeight:'440px' }}>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('date')} style={{ cursor:'pointer', userSelect:'none' }}>Date <SortIcon col="date" /></th>
                    <th>Description</th>
                    <th style={{ textAlign:'right', cursor:'pointer', userSelect:'none' }} onClick={() => toggleSort('amount')}>Amount <SortIcon col="amount" /></th>
                    <th>Account</th>
                    <th>Category</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontFamily:'monospace', color:'#9499b8', fontSize:'11.5px' }}>{t.date}</td>
                      <td style={{ maxWidth:'280px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.description}>{t.description}</td>
                      <td style={{ fontFamily:'monospace', textAlign:'right', fontWeight:'600', color:'#9d7ff4' }}>−{fmt(Math.abs(parseFloat(t.amount)))}</td>
                      <td style={{ color:'#9499b8', fontSize:'11.5px' }}>{t.account}</td>
                      <td>
                        {editingId === t.id ? (
                          <select defaultValue={t.category} onChange={e=>handleCatChange(t.id, e.target.value)}
                            style={{ fontSize:'11.5px', padding:'3px 6px', width:'auto', minWidth:'150px' }}>
                            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <span className="badge" style={{ background:`${catColor(t.category)}22`, color:catColor(t.category), cursor:'pointer' }}
                            onClick={() => setEditingId(t.id)}>{t.category}</span>
                        )}
                      </td>
                      <td>
                        {editingId === t.id
                          ? <button onClick={() => setEditingId(null)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.2)', color:'#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
                          : <><button onClick={() => setEditingId(t.id)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.15)', color:'#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px', marginRight:'4px' }}>Edit</button>
                             <button onClick={() => handleDelete(t.id, t.description)} style={{ background:'none', border:'none', color:'#9499b8', cursor:'pointer', fontSize:'15px' }}>×</button></>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <div style={{ padding:'40px', textAlign:'center', color:'#9499b8', fontSize:'13px' }}>No credits or returns found</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── EXPENSES VIEW ───────────────────────────── */}
      {view === 'expenses' && (
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
              {months.map((m,i) => <option key={m} value={m}>{ML[i]}</option>)}
            </select>
            <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#9499b8', cursor:'pointer', marginLeft:'4px' }}>
              <input type="checkbox" checked={showNR} onChange={e=>setShowNR(e.target.checked)} />
              Non-recurring
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color: showBiz||bizOnly ? '#f5a623' : '#9499b8', cursor:'pointer' }}>
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
              {rows.length} transactions · {fmt(rows.reduce((s,t) => s + parseFloat(t.amount), 0))}
            </span>
          </div>

          {/* Baseline chart — only when category is selected */}
          {fCat && (
            <div className="card" style={{ marginBottom:'14px', padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <div>
                  <span style={{ fontSize:'13px', fontWeight:'600' }}>{fCat}</span>
                  <span style={{ fontSize:'12px', color:'#9499b8', marginLeft:'10px' }}>actual vs baseline</span>
                </div>
                <div style={{ display:'flex', gap:'16px', fontSize:'11.5px' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <span style={{ width:'10px', height:'10px', borderRadius:'2px', background:catColor(fCat), display:'inline-block' }}/>Actual
                  </span>
                  {baselineAmt > 0 && (
                    <span style={{ display:'flex', alignItems:'center', gap:'5px', color:'#9499b8' }}>
                      <span style={{ width:'12px', height:'0', border:'1.5px dashed #4f8ef7', display:'inline-block' }}/>
                      Baseline {fmt(baselineAmt)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', alignItems:'flex-end', height:'90px', position:'relative' }}>
                {chartActuals.map((actual, i) => {
                  const pct = Math.round(actual / maxBar * 100)
                  const over = baselineAmt > 0 && actual > baselineAmt
                  const baselinePct = baselineAmt > 0 ? Math.round(baselineAmt / maxBar * 100) : 0
                  return (
                    <div key={chartMonths[i]} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', justifyContent:'flex-end', position:'relative' }}>
                      {baselineAmt > 0 && (
                        <div style={{ position:'absolute', bottom:`calc(${baselinePct}% + 14px)`, left:0, right:0, borderTop:'1.5px dashed #4f8ef7', zIndex:2 }}/>
                      )}
                      <div title={`${chartLabels[i]}: ${fmt(actual)}${baselineAmt > 0 ? ` · baseline: ${fmt(baselineAmt)}` : ''}`}
                        style={{ width:'100%', height:`${Math.max(pct,2)}%`, background: over ? '#e05c5c' : catColor(fCat), borderRadius:'3px 3px 0 0', transition:'height .3s', position:'relative', zIndex:1 }}
                      />
                      <div style={{ fontSize:'10px', color:'#9499b8', whiteSpace:'nowrap', marginTop:'4px' }}>{chartLabels[i]}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:'20px', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid rgba(255,255,255,0.07)', fontSize:'12px', flexWrap:'wrap' }}>
                <span style={{ color:'#9499b8' }}>Total: <span style={{ color:'#fff', fontWeight:'600' }}>{fmt(rows.reduce((s,t)=>s+parseFloat(t.amount),0))}</span></span>
                {chartActuals.length > 1 && <span style={{ color:'#9499b8' }}>Avg/mo: <span style={{ color:'#fff', fontWeight:'600' }}>{fmt(avgActual)}</span></span>}
                {baselineAmt > 0 && (
                  <>
                    <span style={{ color:'#9499b8' }}>Baseline: <span style={{ color:'#4f8ef7', fontWeight:'600' }}>{fmt(baselineAmt)}</span></span>
                    <span style={{ color: avgActual > baselineAmt ? '#e05c5c' : '#2dd4a0', fontWeight:'600' }}>
                      {avgActual > baselineAmt ? '▲ Over' : '▼ Under'} by {fmt(Math.abs(avgActual - baselineAmt))}/mo avg
                    </span>
                  </>
                )}
                {!baselineAmt && <span style={{ color:'#9499b8', fontSize:'11.5px' }}>No baseline set · go to Baseline tab to add one</span>}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card" style={{ padding:0 }}>
            <div style={{ overflowY:'auto', maxHeight:'520px' }}>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('date')} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>Date <SortIcon col="date" /></th>
                    <th>Description</th>
                    <th style={{ textAlign:'right', cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={() => toggleSort('amount')}>Amount <SortIcon col="amount" /></th>
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
                          <span style={{ fontSize:'10px', fontWeight:'600', color:'#f5a623', background:'rgba(245,166,35,0.15)', border:'1px solid rgba(245,166,35,0.3)', borderRadius:'4px', padding:'1px 5px', marginRight:'6px' }}>LLC</span>
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
                          <button onClick={() => setEditingId(null)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.2)', color:'#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
                        ) : (
                          <>
                            <button onClick={() => handleToggleBusiness(t)} disabled={togglingId === t.id}
                              title={t.is_business ? 'Mark as household' : 'Mark as business/LLC'}
                              style={{ background: t.is_business ? 'rgba(245,166,35,0.15)' : 'none', border:`1px solid ${t.is_business ? 'rgba(245,166,35,0.4)' : 'rgba(255,255,255,0.1)'}`, color: t.is_business ? '#f5a623' : '#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px', marginRight:'4px' }}>
                              {togglingId === t.id ? '...' : t.is_business ? 'LLC ✓' : 'Biz'}
                            </button>
                            <button onClick={() => setEditingId(t.id)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.15)', color:'#9499b8', borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'11px', marginRight:'4px' }}>Edit</button>
                            <button onClick={() => handleDelete(t.id, t.description)} style={{ background:'none', border:'none', color:'#9499b8', cursor:'pointer', fontSize:'15px', lineHeight:1 }}>×</button>
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
      )}
    </div>
  )
}
