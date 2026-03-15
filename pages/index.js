import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // login | signup | join
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [householdName, setHouseholdName] = useState('Our Household')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true); setError('')
    // 1. Create auth user
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    const userId = data.user?.id
    if (!userId) { setError('Signup failed'); setLoading(false); return }

    if (mode === 'signup') {
      // Create new household
      const code = Math.random().toString(36).substring(2,8).toUpperCase()
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .insert({ name: householdName, join_code: code })
        .select().single()
      if (hhErr) { setError(hhErr.message); setLoading(false); return }
      // Link profile to household
      await supabase.from('profiles').update({ household_id: hh.id, display_name: name }).eq('id', userId)
      setMessage(`Account created! Your household join code is: ${code}\nShare this with your spouse so they can join.`)
      setTimeout(() => router.push('/dashboard'), 3000)
    } else {
      // Join existing household
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .select('id')
        .eq('join_code', joinCode.toUpperCase())
        .single()
      if (hhErr || !hh) { setError('Invalid join code. Check with your spouse.'); setLoading(false); return }
      await supabase.from('profiles').update({ household_id: hh.id, display_name: name }).eq('id', userId)
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
            home<span style={{ color: '#2dd4a0' }}>finance</span>
          </div>
          <div style={{ fontSize: '13px', color: '#9499b8' }}>Your household financial dashboard</div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--s2)', padding: '4px', borderRadius: '8px' }}>
          {[['login','Sign in'], ['signup','Create account'], ['join','Join household']].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(''); setMessage('') }}
              style={{ flex: 1, padding: '7px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: '500',
                background: mode === m ? '#4f8ef7' : 'transparent', color: mode === m ? '#fff' : '#9499b8', transition: 'all .15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="card">
          {error && <div className="alert alert-warn" style={{ marginBottom: '16px' }}>{error}</div>}
          {message && <div className="alert alert-ok" style={{ marginBottom: '16px', whiteSpace: 'pre-line' }}>{message}</div>}

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mode !== 'login' && (
                <div>
                  <div className="label">Your name</div>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ahmed" required />
                </div>
              )}
              <div>
                <div className="label">Email</div>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div>
                <div className="label">Password</div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              {mode === 'signup' && (
                <div>
                  <div className="label">Household name (optional)</div>
                  <input type="text" value={householdName} onChange={e => setHouseholdName(e.target.value)} placeholder="Our Household" />
                </div>
              )}
              {mode === 'join' && (
                <div>
                  <div className="label">Household join code</div>
                  <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="ABC123" required style={{ textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '600', fontSize: '16px' }} />
                  <div style={{ fontSize: '11.5px', color: '#9499b8', marginTop: '4px' }}>Ask your spouse for the 6-character code shown when they created the account.</div>
                </div>
              )}
              <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '4px', padding: '10px' }}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Join household'}
              </button>
            </div>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#5a5f7a' }}>
          V5 · Data encrypted · Private to your household
        </div>
      </div>
    </div>
  )
}
