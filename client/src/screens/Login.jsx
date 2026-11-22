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
    ? 'Connexion au serveur…'
    : pending
      ? 'Un instant…'
      : isRegister ? 'Créer mon compte' : 'Se connecter'
  return (
    <div className="screen login">
      <div className="login-cards" aria-hidden="true">
        <Card code="Ah" w={150} style={{ position: 'absolute', left: -60, top: 0 }} initial={{ rotate: -40, opacity: 0, y: 60 }} animate={{ rotate: -14, opacity: 1, y: 0 }} />
        <Card code="As" w={150} style={{ position: 'absolute', left: 40, top: -14 }} initial={{ rotate: 30, opacity: 0, y: 60 }} animate={{ rotate: 9, opacity: 1, y: 0 }} delay={0.12} />
      </div>
      <motion.form className="login-panel" onSubmit={submit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <img src="/favicon.svg" alt="" width="56" height="56" />
        <h1>Aurum Club</h1>
        <p>Poker et blackjack entre amis, avec des jetons virtuels.</p>
        <div className="segmented login-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!isRegister} className={!isRegister ? 'on' : ''} onClick={() => setMode('login')}>Se connecter</button>
          <button type="button" role="tab" aria-selected={isRegister} className={isRegister ? 'on' : ''} onClick={() => setMode('register')}>Créer un compte</button>
        </div>
        <label htmlFor="name">Pseudo</label>
        <input id="name" autoFocus value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Par exemple : Grégoire" autoComplete="username" />
        <label htmlFor="password">Mot de passe</label>
        <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="4 caractères minimum" autoComplete={isRegister ? 'new-password' : 'current-password'} />
        {isRegister && (
          <>
            <label htmlFor="confirm">Confirmer le mot de passe</label>
            <input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} className={mismatch ? 'input-error' : ''} />
            {mismatch && <span className="field-error">Les deux mots de passe ne correspondent pas.</span>}
          </>
        )}
        <button className="btn btn-brass btn-lg" type="submit" disabled={!ready}>{label}</button>
        <small>
          {isRegister
            ? 'Votre compte reçoit 20 000 jetons et un numéro de joueur à donner aux administrateurs.'
            : 'Vous restez connecté sur cet appareil jusqu’à la déconnexion.'}
        </small>
      </motion.form>
    </div>
  )
}
