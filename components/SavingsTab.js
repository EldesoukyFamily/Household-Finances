import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js'
import { NON_RECURRING, fmt, fmtS } from '../lib/constants'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

const MONTHS = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03']
const ML =     ['Aug-25','Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26']
const INCOME = {'2025-08':19369,'2025-09':19474,'2025-10':24620,'2025-11':19822,'2025-12':20444,'2026-01':22830,'2026-02':18450,'2026-03':18402}

function regSpend(txns, ym) {
function regSpend(txns, ym) {
  return txns.filter(t=>t.date?.startsWith(ym)&&!NON_RECURRING.has(t.category)&&!t.is_business).reduce((s,t)=>s+parseFloat(t.amount),0)
}

export default function SavingsTab({ transactions }) {
  const valid = MONTHS.slice(0,7)
  const avgInc   = valid.reduce((s,m)=>s+(INCOME[m]||0),0)/7
  const avgSpend = valid.reduce((s,m)=>s+regSpend(transactions,m),0)/7
  const avgNet   = avgInc - avgSpend
  const gap      = Math.max(0, 1700 - avgNet)

  const nets = MONTHS.map(m=>Math.round((INCOME[m]||0)-regSpend(transactions,m)))
  const chartData = {
    labels: ML,
    datasets: [
      {label:'Net surplus', data:nets, backgroundColor:nets.map(v=>v>=1700?'rgba(45,212,160,.7)':v>=0?'rgba(79,142,247,.7)':'rgba(240,98,128,.7)'), borderRadius:4},
      {label:'$1,700 target', data:MONTHS.map(()=>1700), type:'line', borderColor:'rgba(245,166,35,.8)', borderDash:[5,5], pointRadius:0, borderWidth:2},
    ]
  }
  const chartOpts = {
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#9499b8',font:{size:11},boxWidth:10}}},
    scales:{x:{ticks:{color:'#9499b8',font:{size:11}},grid:{color:'rgba(255,255,255,.04)'}},
            y:{ticks:{color:'#9499b8',font:{size:11},callback:v=>'$'+Math.round(v/1000)+'k'},grid:{color:'rgba(255,255,255,.04)'}}}
  }

  const levers = [
    {label:'Cancel Rocket Money',saving:63,easy:true,note:'Do this week'},
    {label:'Close Barclays card',saving:120,easy:true,note:'Stops interest + annual fee'},
    {label:'Wife 3-paycheck months ×2/yr',saving:4416,easy:false,note:'50% travel / 50% savings'},
    {label:'Husband 3-paycheck months ×2/yr',saving:4826,easy:false,note:'50% travel / 50% savings'},
    {label:'Au pair ends (future)',saving:1571,easy:false,note:'Childcare drops automatically'},
    {label:'Au pair off insurance',saving:150,easy:false,note:'When au pair turns 25'},
  ]

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'18px'}}>
        <div className="card"><div className="label">Avg surplus (7-mo)</div><div className={`value ${avgNet>=0?'c-green':'c-red'}`}>{fmtS(avgNet)}</div><div className="sub">excl. Mar partial</div></div>
        <div className="card"><div className="label">Savings target</div><div className="value c-blue">$1,700</div><div className="sub">aspirational/mo</div></div>
        <div className="card"><div className="label">Gap to target</div><div className={`value ${gap<=0?'c-green':'c-red'}`}>{gap<=0?'On track!':'-'+fmt(gap)}</div><div className="sub">{gap<=0?'Above target':'needed /month'}</div></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
        <div className="card">
          <div className="label" style={{marginBottom:'8px'}}>Monthly surplus vs $1,700 target</div>
          <div style={{height:'220px'}}><Bar data={chartData} options={chartOpts}/></div>
        </div>
        <div className="card">
          <div className="label" style={{marginBottom:'12px'}}>3-paycheck strategy & natural reductions</div>
          <div style={{display:'flex',flexDirection:'column'}}>
            {levers.map((l,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <span style={{width:'8px',height:'8px',borderRadius:'50%',background:l.easy?'#2dd4a0':'#f5a623',flexShrink:0}}/>
                <span style={{flex:1,fontSize:'12.5px'}}>{l.label}</span>
                <span style={{fontFamily:'monospace',fontWeight:'600',color:'#2dd4a0',fontSize:'12.5px'}}>+{fmt(l.saving)}</span>
                <span style={{fontSize:'11px',color:'#9499b8',width:'140px',textAlign:'right'}}>{l.note}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:'14px',padding:'12px',background:'rgba(45,212,160,0.06)',borderRadius:'6px'}}>
            <div style={{fontSize:'12px',color:'#9499b8',lineHeight:'1.7'}}>
              <strong style={{color:'#eef0f8'}}>Annual 3-paycheck windfall: $18,484</strong><br/>
              → $9,242 travel fund + $9,242 savings<br/><br/>
              <strong style={{color:'#eef0f8'}}>SS tax cap relief (Jul–Dec)</strong><br/>
              → +$495/paycheck once cap hit (~$7,423/yr)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
