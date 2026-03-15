import { useState, useEffect, useRef } from 'react'
import { NON_RECURRING, fmt, fmtS, catColor } from '../lib/constants'

const MONTHS = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03']
const ML =     ['Aug-25','Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26']

function getCats(transactions, ym) {
  const c = {}
  transactions.filter(t => t.date?.startsWith(ym)).forEach(t => {
    c[t.category] = (c[t.category] || 0) + parseFloat(t.amount)
  })
  return c
}

function regSpend(transactions, ym) {
  return Object.entries(getCats(transactions, ym))
    .filter(([c]) => !NON_RECURRING.has(c))
    .reduce((s, [, v]) => s + v, 0)
}

function getIncome(transactions, ym) {
  // Income from transactions marked as income, or use stored monthly figures
  // We use approximate biweekly standard month = 18483.76
  // Better: sum all credits tagged _INCOME if available, else use approximation
  const INCOME = {
    '2025-08': 19369.17, '2025-09': 19474.04, '2025-10': 24619.86,
    '2025-11': 19822.19, '2025-12': 20444.38, '2026-01': 22829.87,
    '2026-02': 18449.52, '2026-03': 9340.22
  }
  return INCOME[ym] || 18483.76
}

export default function DashboardTab({ transactions }) {
  const [selMo, setSelMo] = useState('all')
  const trendRef = useRef(null)
  const catRef = useRef(null)
  const trendChart = useRef(null)
  const catChart = useRef(null)

  const months = selMo === 'all' ? MONTHS : [selMo]
  const totInc   = months.reduce((s, m) => s + getIncome(transactions, m), 0)
  const totSpend = months.reduce((s, m) => s + regSpend(transactions, m), 0)
  const net = totInc - totSpend
  const n = months.length

  // Aggregate categories
  const cats = {}
  months.forEach(m => {
    Object.entries(getCats(transactions, m)).forEach(([c, v]) => {
      if (!NON_RECURRING.has(c)) cats[c] = (cats[c] || 0) + v
    })
  })
  const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 12)
  const maxCat = sortedCats[0]?.[1] || 1

  useEffect(() => {
    if (typeof window === 'undefined') return
    import('chart.js').then(({ Chart, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend }) => {
      Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

      // Trend chart
      if (trendChart.current) trendChart.current.destroy()
      if (trendRef.current) {
        trendChart.current = new Chart(trendRef.current, {
          type: 'bar',
          data: {
            labels: ML,
            datasets: [
              { label: 'Income', data: MONTHS.map(m => Math.round(getIncome(transactions, m))), backgroundColor: 'rgba(45,212,160,.65)', borderRadius: 4 },
              { label: 'Spend',  data: MONTHS.map(m => Math.round(regSpend(transactions, m))), backgroundColor: 'rgba(245,166,35,.65)', borderRadius: 4 },
              { label: 'Net',    data: MONTHS.map(m => Math.round(getIncome(transactions, m) - regSpend(transactions, m))), type: 'line', borderColor: '#4f8ef7', backgroundColor: 'transparent', pointRadius: 4, tension: .3, borderWidth: 2 },
            ]
          },
          options: chartOpts()
        })
      }

      // Top 6 cat trend
      if (catChart.current) catChart.current.destroy()
      if (catRef.current) {
        const top6 = ['Mortgage & Housing','Shopping','Car Payments','Groceries & Household','Dining & Food','Childcare & Education']
        catChart.current = new Chart(catRef.current, {
          type: 'line',
          data: {
            labels: ML,
            datasets: top6.map(c => ({
              label: c.split(' (')[0],
              data: MONTHS.map(m => Math.round(getCats(transactions, m)[c] || 0)),
              borderColor: catColor(c), backgroundColor: 'transparent',
              pointRadius: 3, tension: .3, borderWidth: 2
            }))
          },
          options: chartOpts()
        })
      }
    })
    return () => {
      if (trendChart.current) trendChart.current.destroy()
      if (catChart.current) catChart.current.destroy()
    }
  }, [transactions, selMo])

  return (
    <div>
      {/* Month pills */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {['all', ...MONTHS].map((m, i) => (
          <button key={m} onClick={() => setSelMo(m)}
            style={{ padding: '4px 11px', borderRadius: '20px', border: `1px solid ${selMo===m?'#4f8ef7':'rgba(255,255,255,0.1)'}`,
              background: selMo===m?'#4f8ef7':'none', color: selMo===m?'#fff':'#9499b8',
              fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
            {m === 'all' ? 'All months' : ML[i-1]}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '18px' }}>
        {[
          { label: 'Income', value: fmt(totInc/n), sub: '/mo avg', cls: 'c-green' },
          { label: 'Regular spend', value: fmt(totSpend/n), sub: '/mo avg', cls: 'c-amber' },
          { label: 'Net surplus', value: fmtS(net/n), sub: '/mo avg', cls: net>=0?'c-green':'c-red' },
          { label: 'Savings rate', value: `${totInc>0?Math.round(net/totInc*100):0}%`, sub: 'of income', cls: 'c-blue' },
        ].map(k => (
          <div key={k.label} className="card">
            <div className="label">{k.label}</div>
            <div className={`value ${k.cls}`}>{k.value}</div>
            <div className="sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
        {/* Cat bars */}
        <div className="card">
          <div className="label">Spending by category</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '8px' }}>
            {sortedCats.map(([c, v]) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '11.5px', color: '#9499b8', width: '150px', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</div>
                <div style={{ flex: 1, background: 'var(--s3)', borderRadius: '3px', height: '16px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(v/maxCat*100)}%`, height: '100%', borderRadius: '3px', background: catColor(c), transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: '11.5px', fontWeight: '600', width: '68px', fontFamily: 'monospace', color: catColor(c) }}>{fmt(v/n)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend chart */}
        <div className="card">
          <div className="label">Income vs regular spending</div>
          <div style={{ position: 'relative', height: '240px', marginTop: '8px' }}>
            <canvas ref={trendRef} />
          </div>
        </div>
      </div>

      {/* Category trend */}
      <div className="card">
        <div className="label">Top 6 category trends</div>
        <div style={{ position: 'relative', height: '210px', marginTop: '8px' }}>
          <canvas ref={catRef} />
        </div>
      </div>
    </div>
  )
}

function chartOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#7a7f9a', font: { size: 11 }, boxWidth: 10 } } },
    scales: {
      x: { ticks: { color: '#7a7f9a', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' } },
      y: { ticks: { color: '#7a7f9a', font: { size: 11 }, callback: v => '$'+Math.round(Math.abs(v)/1000)+'k' }, grid: { color: 'rgba(255,255,255,.04)' } }
    }
  }
}
