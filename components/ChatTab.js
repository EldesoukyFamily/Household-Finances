import { useState, useRef, useEffect } from 'react'
import { NON_RECURRING, fmt, toMonthLabel, INCOME } from '../lib/constants'

function buildContext(transactions, baseline) {
  // Derive months dynamically from actual transaction dates
  const months = [...new Set(transactions.map(t => t.date?.slice(0,7)).filter(Boolean))].sort()

  const catTotals = {}
  transactions.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + parseFloat(t.amount) })

  const monthly = months.map(m => {
    const spend = transactions.filter(t=>t.date?.startsWith(m)&&!NON_RECURRING.has(t.category)&&!t.is_business).reduce((s,t)=>s+parseFloat(t.amount),0)
    const inc = INCOME[m]||0
    return `${m}: income=$${Math.round(inc)} spend=$${Math.round(spend)} net=${Math.round(inc-spend)>=0?'+':''}$${Math.round(inc-spend)}`
  }).join(' | ')

  const cats = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])
    .map(([c,v])=>`${c}: ${fmt(v)} total (${fmt(v/Math.max(months.length,1))}/mo)`).join('\n')

  const blStr = Object.entries(baseline).sort((a,b)=>b[1]-a[1])
    .map(([c,v])=>`${c}: ${fmt(v)}`).join(', ')

  const dateRange = months.length ? `${toMonthLabel(months[0])}–${toMonthLabel(months[months.length-1])}` : 'all months'

  return `You are a personal finance assistant for this household. Real data ${dateRange} (V5).

MONTHLY (income/spend/net):
${monthly}

CATEGORY TOTALS (${months.length} months, avg/mo):
${cats}

BASELINE TARGETS: ${blStr}

KEY FACTS:
- Mortgage Truist $7,600/mo (P+I $6,238.70 + escrow). Started Aug 2025.
- Tesla lease $515/mo + FSD $104/mo. Hyundai $799/mo. VW lease closed.
- Auto insurance elevated — au pair under 25 on Progressive plan.
- Cultural Care au pair program $450/mo.
- Savings target $1,700/mo aspirational. 7-mo avg surplus ~$578/mo.
- Standard monthly income ~$18,484 (biweekly). 3-paycheck months 4x/yr = $18,484 windfall.
- SS tax cap hits ~Jul/Aug → extra $495/paycheck from then until Dec.
- February 2026 was best month — shopping $978 vs avg $2,510. Target that as the standard.
- Kids: daycare + au pair + Sunday school (VALS) + soccer (VYS ~$4,500/yr).
- Home purchased July 2025. Still spending on improvements.
- ${transactions.length} transactions analyzed.

Be specific with numbers. Under 200 words. Give actionable advice.`
}

const SUGGESTIONS = [
  'Where are we consistently over baseline?',
  'What made February our best month?',
  'How much did we spend on kids total?',
  'Are we on track for $1,700 savings?',
  'What should we cut first?',
  'When will our SS tax cap hit in 2026?',
]

export default function ChatTab({ transactions, baseline }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! I have your complete spending data — **${transactions.length} transactions** across Aug 2025–Mar 2026.\n\nAsk me anything about your finances.` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  async function send() {
    const msg = input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role:'user', content:msg }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          systemPrompt: buildContext(transactions, baseline),
          messages: [{ role:'user', content:msg }]
        })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role:'assistant', content: data.text || 'Sorry, could not process that.' }])
    } catch(e) {
      setMessages(prev => [...prev, { role:'assistant', content:'Connection error — please try again.' }])
    }
    setLoading(false)
  }

  function renderContent(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div style={{ maxWidth:'720px' }}>
      <div className="card">
        {/* Messages */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', maxHeight:'400px', overflowY:'auto', marginBottom:'14px', paddingRight:'4px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:'flex', gap:'8px', alignItems:'flex-start', flexDirection: m.role==='user'?'row-reverse':'row' }}>
              <div style={{ width:'26px', height:'26px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', flexShrink:0, marginTop:'2px', background: m.role==='assistant'?'#4f8ef7':'var(--s3)', color: m.role==='assistant'?'#fff':'#9499b8' }}>
                {m.role==='assistant'?'AI':'You'}
              </div>
              <div style={{ background: m.role==='user'?'rgba(79,142,247,.14)':'var(--s2)', borderRadius: m.role==='user'?'10px 0 10px 10px':'0 10px 10px 10px', padding:'9px 13px', fontSize:'13px', lineHeight:'1.6', maxWidth:'88%' }}
                dangerouslySetInnerHTML={{ __html: renderContent(m.content) }} />
            </div>
          ))}
          {loading && (
            <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
              <div style={{ width:'26px', height:'26px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', background:'#4f8ef7', color:'#fff', flexShrink:0 }}>AI</div>
              <div style={{ background:'var(--s2)', borderRadius:'0 10px 10px 10px', padding:'9px 13px', fontSize:'13px', color:'#9499b8' }}>Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'10px' }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={()=>{ setInput(s); setTimeout(()=>send(),50) }}
                style={{ padding:'5px 11px', borderRadius:'20px', fontSize:'12px', border:'1px solid rgba(255,255,255,0.15)', background:'none', color:'#9499b8', cursor:'pointer', transition:'.15s' }}
                onMouseOver={e=>{ e.target.style.borderColor='#4f8ef7'; e.target.style.color='#4f8ef7' }}
                onMouseOut={e=>{ e.target.style.borderColor='rgba(255,255,255,0.15)'; e.target.style.color='#9499b8' }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ display:'flex', gap:'8px' }}>
          <input
            type="text" value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') send() }}
            placeholder="Ask about your finances..."
            style={{ flex:1, background:'var(--s2)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'6px', padding:'9px 12px', color:'#eef0f8', fontSize:'13px', outline:'none' }}
            onFocus={e=>e.target.style.borderColor='#4f8ef7'}
            onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}
          />
          <button className="btn-primary" onClick={send} disabled={loading || !input.trim()}>Send</button>
        </div>
      </div>
    </div>
  )
}
