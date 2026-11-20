import { useState } from 'react'
import { motion } from 'framer-motion'
import { savedName, send, useStore } from '../net.js'
import Card from '../components/Card.jsx'

export default function Login() {
  const [name, setName] = useState(savedName())
  const status = useStore(s => s.status)
  const submit = e => {
    e.preventDefault()
    if (name.trim().length >= 2) send({ t: 'hello', name: name.trim() })
  }
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
        <label htmlFor="name">Votre pseudo</label>
        <input id="name" autoFocus value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Par exemple : Grégoire" autoComplete="nickname" />
        <button className="btn btn-brass btn-lg" type="submit" disabled={status !== 'online' || name.trim().length < 2}>
          {status === 'online' ? 'Entrer dans le salon' : 'Connexion au serveur…'}
        </button>
        <small>Nouveau pseudo : 20 000 jetons offerts. Pseudo existant : vous retrouvez votre solde.</small>
      </motion.form>
    </div>
  )
}
