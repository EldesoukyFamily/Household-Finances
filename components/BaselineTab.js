import { useState, useEffect, useRef } from 'react'
import { NON_RECURRING, fmt, fmtS, catColor } from '../lib/constants'

const MONTHS = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03']
const ML =     ['Aug-25','Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26']

const STORED_INCOME = {
  '2025-08': 19369.17,'2025-09': 19474.04,'2025-10': 24619.86,
  '2025-11': 19822.19,'2025-12': 20444.38,'2026-01': 22829.87,
  '2026-02': 18449.52,'2026-03': 9340.22
}

function getCats(txns, ym) {
  const c = {}
  txns.filter(t => t.date?.startsWith(ym)).forEach(t => { c[t.category] = (c[t.category]||0)+parseFloat(t.amount) })
  return c
}

export default function BaselineTab({ transactions, baseline, onUpdateBaseline }) {
  const [selMo, setSelMo] = useState('avg')
  const [editing, setEditing] = useState({})
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  // Compute actual spend for selected month/avg
  function getActual() {
    if (selMo === 'avg') {
      const valid = MONTHS.slice(0,7)
      const c = {}
      valid.forEach(m => {
        Object.entries(getCats(transactions, m)).forEach(([cat, v]) => {
          if (!NON_RECURRING.has(cat)) c[cat] = (c[cat]||0) + v/7
        })
      })
      return c
    } else {
      const c = getCats(transactions, selMo)
      return Object.fromEntries(Object.entries(c).filter(([cat]) => !NON_RECURRING.has(cat)))
    }
  }

  const actual = getActual()
  const allCats = Object.keys(baseline).filter(c => !NON_RECURRING.has(c))
  const totActual = Object.values(actual).reduce((s,v)=>s+v,0)
  const totBase   = Object.values(baseline).reduce((s,v)=>s+v,0)
  const totDelta  = totActual - totBase

  // Chart: actual vs baseline per month
  useEffect(() => {
    if (typeof window === 'undefined') return
    import('chart.js').then(({ Chart, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend }) => {
      Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)
      if (chartInst.current) chartInst.current.destroy()
      if (!chartRef.current) return
      const actVals = MONTHS.map(m => {
        const c = getCats(transactions, m)
        return Math.round(Object.entries(c).filter(([cat]) => !NON_RECURRING.has(cat)).reduce((s,[,v])=>s+v,0))
      })
      const baseVal = Math.round(totBase)
      chartInst.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels: ML,
          datasets: [
            { label: 'Actual spend', data: actVals, backgroundColor: actVals.map(v => v>baseVal?'rgba(240,98,128,.7)':'rgba(45,212,160,.65)'), borderRadius: 4 },
            { label: 'Baseline', data: MONTHS.map(()=>baseVal), type: 'line', borderColor: 'rgba(255,255,255,0.5)', borderDash:[5,5], pointRadius:0, borderWidth:2 }
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ display:false } },
          scales:{
            x:{ticks:{color:'#7a7f9a',font:{size:11}},grid:{color:'rgba(255,255,255,.04)'}},
            y:{ticks:{color:'#7a7f9a',font:{size:11},callback:v=>'$'+Math.round(v/1000)+'k'},grid:{color:'rgba(255,255,255,.04)'}}
          }
        }
      })
    })
    return () => { if (chartInst.current) chartInst.current.destroy() }
  }, [transactions, baseline])

  function startEdit(cat) {
    setEditing(prev => ({ ...prev, [cat]: String(Math.round(baseline[cat]||0)) }))
  }
  function cancelEdit(cat) {
    setEditing(prev => { const n={...prev}; delete n[cat]; return n })
  }
  async function saveEdit(cat) {
    const val = parseFloat(editing[cat])
    if (!isNaN(val) && val >= 0) await onUpdateBaseline(cat, Math.round(val))
    cancelEdit(cat)
  }

  const maxBar = Math.max(...allCats.map(c => Math.max(actual[c]||0, baseline[c]||0)), 1)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
        <div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:'18px', fontWeight:'700' }}>Spending baseline</div>
          <div style={{ fontSize:'12px', color:'#9499b8', marginTop:'3px' }}>Compare actual vs target. Click Edit on any row to set a custom target.</div>
        </div>
        <select value={selMo} onChange={e=>setSelMo(e.target.value)} style={{ width:'auto', minWidth:'160px' }}>
          <option value="avg">7-month average</option>
          {MONTHS.map((m,i) => <option key={m} value={m}>{ML[i]}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'18px' }}>
        <div className="card"><div className="label">Total actual</div><div className="value c-amber">{fmt(totActual)}</div><div className="sub">{selMo==='avg'?'avg/mo':ML[MONTHS.indexOf(selMo)]}</div></div>
        <div className="card"><div className="label">Total baseline</div><div className="value c-blue">{fmt(totBase)}</div><div className="sub">monthly target</div></div>
        <div className="card"><div className="label">vs Baseline</div><div className={`value ${totDelta<=0?'c-green':'c-red'}`}>{fmtS(totDelta)}</div><div className="sub">{totDelta<=0?'under budget':'over budget'}</div></div>
      </div>

      {/* Trend chart */}
      <div className="card" style={{ marginBottom:'18px' }}>
        <div className="label" style={{ marginBottom:'8px' }}>Actual vs baseline — all months <span style={{ float:'right', color:'#9499b8', fontSize:'10px', fontWeight:'400', textTransform:'none', letterSpacing:0 }}><span style={{ color:'rgba(255,255,255,0.5)' }}>— —</span> baseline target</span></div>
        <div style={{ position:'relative', height:'220px' }}><canvas ref={chartRef} /></div>
      </div>

      {/* Category rows */}
      <div className="card">
        <div className="label" style={{ marginBottom:'12px' }}>Category breakdown</div>
        {allCats.length === 0 && <div style={{ color:'#9499b8', fontSize:'13px' }}>No baseline set yet. Upload transactions and baseline will auto-calculate.</div>}
        {allCats.map(cat => {
          const act = actual[cat] || 0
          const base = baseline[cat] || 0
          const delta = act - base
          const over = delta > 0
          const actW = Math.round(act/maxBar*100)
          const baseW = Math.round(base/maxBar*100)
          const isEditing = editing.hasOwnProperty(cat)

          return (
            <div key={cat} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              {/* Label */}
              <div style={{ fontSize:'12.5px', width:'170px', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={cat}>{cat}</div>
              {/* Bar */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'3px' }}>
                <div style={{ height:'12px', background:'var(--s3)', borderRadius:'3px', overflow:'hidden', position:'relative' }}>
                  <div style={{ width:`${actW}%`, height:'100%', borderRadius:'3px', background: over?'rgba(240,98,128,.7)':'rgba(45,212,160,.65)', transition:'width .5s' }} />
                  <div style={{ position:'absolute', top:0, left:`${baseW}%`, width:'2px', height:'100%', background:'rgba(255,255,255,0.5)' }} />
                </div>
              </div>
              {/* Amounts */}
              <div style={{ fontSize:'11.5px', fontFamily:'monospace', width:'130px', textAlign:'right', color:'#9499b8', flexShrink:0 }}>
                {fmt(act)} <span style={{ color:'rgba(255,255,255,0.25)' }}>/ {fmt(base)}</span>
              </div>
              {/* Delta */}
              <div style={{ fontSize:'11.5px', fontWeight:'600', fontFamily:'monospace', width:'68px', textAlign:'right', flexShrink:0, color: over?'#f06280':'#2dd4a0' }}>
                {fmtS(delta)}
              </div>
              {/* Edit */}
              <div style={{ width:'130px', flexShrink:0 }}>
                {isEditing ? (
                  <div style={{ display:'flex', gap:'4px' }}>
                    <input type="number" value={editing[cat]} onChange={e=>setEditing(p=>({...p,[cat]:e.target.value}))}
                      style={{ width:'80px', fontSize:'12px', padding:'3px 6px' }} />
                    <button onClick={()=>saveEdit(cat)} style={{ background:'#4f8ef7', color:'#fff', border:'none', borderRadius:'4px', padding:'3px 7px', cursor:'pointer', fontSize:'11px' }}>✓</button>
                    <button onClick={()=>cancelEdit(cat)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.2)', color:'#9499b8', borderRadius:'4px', padding:'3px 7px', cursor:'pointer', fontSize:'11px' }}>✗</button>
                  </div>
                ) : (
                  <button onClick={()=>startEdit(cat)}
                    style={{ fontSize:'11px', padding:'3px 10px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.15)', background:'none', color:'#9499b8', cursor:'pointer' }}>
                    Edit target
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
