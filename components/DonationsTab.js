import { useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { fmt, ALL_CATEGORIES, toMonthLabel } from '../lib/constants'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const DONATION_KEYWORDS = [
  'IRUSA','ISLAMIC RELIEF','ZAKAT','SADAQA','LAUNCHGOOD','GOFUNDME',
  'MASJID','MOSQUE','ICNA','ISNA','YAQEEN','SEEKER','MERCY MISSION',
  'HUMAN APPEAL','PENNY APPEAL','DIRECT RELIEF','RED CROSS','SALVATION ARMY',
  'UNITED WAY','HABITAT FOR HUMANITY','ISLAMIC CENTER','MUSLIM AID',
  'WWW.IR','CHARITY','DONATE','FOUNDATION'
]

function isDonation(desc) {
  const d = (desc||'').toUpperCase()
  return DONATION_KEYWORDS.some(k => d.includes(k))
}

export default function DonationsTab({ transactions, onUpdateCategory, months = [] }) {
  const ML = months.map(toMonthLabel)
  const [yearFilter, setYearFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [manualIds, setManualIds] = useState(new Set())

  const donations = transactions.filter(t =>
    t.category === 'Charitable Giving' ||
    isDonation(t.description) ||
    manualIds.has(t.id)
  )

  const filtered = yearFilter === 'all' ? donations
    : donations.filter(t => t.date?.startsWith(yearFilter))

  const total = filtered.reduce((s,t) => s + parseFloat(t.amount), 0)
  const ytd2026 = donations.filter(t => t.date?.startsWith('2026')).reduce((s,t) => s+parseFloat(t.amount),0)
  const ytd2025 = donations.filter(t => t.date?.startsWith('2025')).reduce((s,t) => s+parseFloat(t.amount),0)

  const monthlyTotals = months.map(m =>
    Math.round(donations.filter(t => t.date?.startsWith(m)).reduce((s,t) => s+parseFloat(t.amount),0))
  )

  const chartData = {
    labels: ML,
    datasets: [{
      label: 'Donations',
      data: monthlyTotals,
      backgroundColor: 'rgba(157,127,244,.7)',
      borderRadius: 4,
    }]
  }
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color:'#9499b8', font:{size:11} }, grid: { color:'rgba(255,255,255,.04)' } },
      y: { ticks: { color:'#9499b8', font:{size:11}, callback: v => '$'+v }, grid: { color:'rgba(255,255,255,.04)' } }
    }
  }

  const annualIncome = 20024 * 12
  const zakatEstimate = Math.round(annualIncome * 0.025)

  async function markAsDonation(txn) {
    setManualIds(prev => new Set([...prev, txn.id]))
    await onUpdateCategory(txn.id, 'Charitable Giving')
  }

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'18px' }}>
        <div className="card">
          <div className="label">2026 YTD</div>
          <div className="value" style={{ color:'#9d7ff4' }}>{fmt(ytd2026)}</div>
          <div className="sub">this year so far</div>
        </div>
        <div className="card">
          <div className="label">2025 total</div>
          <div className="value" style={{ color:'#9d7ff4' }}>{fmt(ytd2025)}</div>
          <div className="sub">Aug–Dec only</div>
        </div>
        <div className="card">
          <div className="label">Avg per month</div>
          <div className="value" style={{ color:'#9d7ff4' }}>{fmt(total / Math.max(months.length,1))}</div>
          <div className="sub">across all months</div>
        </div>
        <div className="card">
          <div className="label">Zakat estimate</div>
          <div className="value" style={{ color:'#f5a623' }}>{fmt(zakatEstimate)}</div>
          <div className="sub">2.5% of annual income</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'18px' }}>
        <div className="card">
          <div className="label" style={{ marginBottom:'8px' }}>Monthly donations</div>
          <div style={{ height:'200px' }}>
            <Bar data={chartData} options={chartOpts}/>
          </div>
        </div>

        <div className="card">
          <div className="label" style={{ marginBottom:'12px' }}>Zakat tracker</div>
          <div style={{ fontSize:'12.5px', color:'#9499b8', marginBottom:'16px', lineHeight:'1.7' }}>
            Estimated annual Zakat obligation at 2.5% of household income:<br/>
            <strong style={{ color:'#eef0f8', fontSize:'16px' }}>{fmt(zakatEstimate)}/year</strong>
            <span style={{ fontSize:'11.5px', marginLeft:'8px' }}>({fmt(zakatEstimate/12)}/mo)</span>
          </div>

          <div style={{ marginBottom:'8px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#9499b8', marginBottom:'4px' }}>
              <span>2026 donations so far</span>
              <span>{fmt(ytd2026)} of {fmt(zakatEstimate)}</span>
            </div>
            <div style={{ height:'8px', background:'var(--s3)', borderRadius:'8px', overflow:'hidden' }}>
              <div style={{ width:`${Math.min(100, ytd2026/zakatEstimate*100)}%`, height:'100%', borderRadius:'8px', background:'#9d7ff4', transition:'width .7s' }}/>
            </div>
          </div>

          <div className="alert alert-info" style={{ marginTop:'12px', fontSize:'12px' }}>
            Note: Zakat calculation depends on your nisab threshold and full asset picture. This is an income-based estimate only.
          </div>

          <div style={{ marginTop:'14px' }}>
            <div className="label" style={{ marginBottom:'8px' }}>Giving by recipient (top)</div>
            {Object.entries(
              filtered.reduce((acc, t) => {
                const key = t.description.substring(0,30)
                acc[key] = (acc[key]||0) + parseFloat(t.amount)
                return acc
              }, {})
            ).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amt]) => (
              <div key={name} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:'12.5px' }}>
                <span style={{ color:'#9499b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px' }} title={name}>{name}</span>
                <span style={{ fontFamily:'monospace', fontWeight:'600', color:'#9d7ff4' }}>{fmt(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
          <div className="label">Donation transactions</div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} style={{ width:'auto', fontSize:'12.5px' }}>
              <option value="all">All time</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
            <span style={{ fontSize:'12px', color:'#9499b8' }}>{filtered.length} transactions · {fmt(total)}</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding:'30px', textAlign:'center', color:'#9499b8', fontSize:'13px' }}>
            No donation transactions found yet.
          </div>
        ) : (
          <div style={{ overflowY:'auto', maxHeight:'400px' }}>
            <table>
              <thead><tr><th>Date</th><th>Description</th><th style={{ textAlign:'right' }}>Amount</th><th>Account</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.sort((a,b)=>b.date?.localeCompare(a.date)).map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily:'monospace', color:'#9499b8', fontSize:'11.5px' }}>{t.date}</td>
                    <td style={{ maxWidth:'280px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</td>
                    <td style={{ fontFamily:'monospace', textAlign:'right', fontWeight:'600', color:'#9d7ff4' }}>{fmt(parseFloat(t.amount))}</td>
                    <td style={{ fontSize:'11.5px', color:'#9499b8' }}>{t.account}</td>
                    <td>
                      <span className="badge" style={{ background:'rgba(157,127,244,.2)', color:'#9d7ff4' }}>
                        {t.category === 'Charitable Giving' ? '✓ Donation' : 'Auto-detected'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop:'14px', padding:'12px', background:'var(--s2)', borderRadius:'6px' }}>
          <div style={{ fontSize:'12px', color:'#9499b8', marginBottom:'8px', fontWeight:'600' }}>
            Mark a transaction as a donation
          </div>
          <div style={{ fontSize:'12px', color:'#9499b8' }}>
            Go to the <strong style={{ color:'#eef0f8' }}>Transactions</strong> tab, find the transaction, click Edit, and change the category to <strong style={{ color:'#9d7ff4' }}>Charitable Giving</strong> — it will appear here automatically.
          </div>
        </div>
      </div>
    </div>
  )
}
