import { useState } from 'react'
import { motion } from 'framer-motion'
import { login, register, savedName, useStore } from '../net.js'
import Card from '../components/Card.jsx'

export default function Login() {
  const [mode, setMode] = useState(savedName() ? 'login' : 'register')
  const [name, setName] = useState(savedName())
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const status = useStore(s => s.status)
  const pending = useStore(s => s.authPending)
  const isRegister = mode === 'register'
  const mismatch = isRegister && confirm.length > 0 && confirm !== password
  const ready = status === 'online' && !pending && name.trim().length >= 2 && password.length >= 4 && (!isRegister || confirm === password)
  const submit = e => {
    e.preventDefault()
    if (!ready) return
    if (isRegister) register(name.trim(), password)
    else login(name.trim(), password)
  }
  const label = status !== 'online'
    ? 'Connecting to server…'
    : pending
      ? 'One moment…'
      : isRegister ? 'Create my account' : 'Sign in'
  return (
    <div className="screen login">
      <div className="login-cards" aria-hidden="true">
        <Card code="Ah" w={150} style={{ position: 'absolute', left: -60, top: 0 }} initial={{ rotate: -40, opacity: 0, y: 60 }} animate={{ rotate: -14, opacity: 1, y: 0 }} />
        <Card code="As" w={150} style={{ position: 'absolute', left: 40, top: -14 }} initial={{ rotate: 30, opacity: 0, y: 60 }} animate={{ rotate: 9, opacity: 1, y: 0 }} delay={0.12} />
      </div>
      <motion.form className="login-panel" onSubmit={submit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <img src="/favicon.svg" alt="" width="56" height="56" />
        <h1>Aurum Club</h1>
        <p>Poker and blackjack with friends, played with virtual chips.</p>
        <div className="segmented login-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!isRegister} className={!isRegister ? 'on' : ''} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" role="tab" aria-selected={isRegister} className={isRegister ? 'on' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>
        <label htmlFor="name">Username</label>
        <input id="name" autoFocus value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="For example: Grégoire" autoComplete="username" />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 4 characters" autoComplete={isRegister ? 'new-password' : 'current-password'} />
        {isRegister && (
          <>
            <label htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} className={mismatch ? 'input-error' : ''} />
            {mismatch && <span className="field-error">The two passwords don’t match.</span>}
          </>
        )}
        <button className="btn btn-brass btn-lg" type="submit" disabled={!ready}>{label}</button>
        <small>
          {isRegister
            ? 'Your account gets 20,000 chips and a player number to share with the admins.'
            : 'You stay signed in on this device until you sign out.'}
        </small>
      </motion.form>
    </div>
  )
}
