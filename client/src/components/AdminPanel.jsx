import { useEffect, useMemo, useState } from 'react'
import { send, useStore } from '../net.js'
import { fmt, hue, initials } from '../format.js'

const QUICK = [1000, 5000, 10000, 50000]

function ago(at) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - at))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(at * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export default function AdminPanel({ onClose }) {
  const data = useStore(s => s.adminData)
  const [number, setNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    send({ t: 'admin_list' })
    const iv = setInterval(() => send({ t: 'admin_list' }), 5000)
    return () => clearInterval(iv)
  }, [])
  const players = data?.players || []
  const target = players.find(p => String(p.id) === number.trim())
  const value = Number(amount)
  const validAmount = Number.isInteger(value) && value > 0
  const canSubmit = !!target && validAmount
  const submit = sign => {
    if (!canSubmit) return
    send({ t: 'admin_give', player_id: target.id, amount: sign * value, reason: reason.trim() || null })
    setAmount('')
    setReason('')
  }
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return players
    return players.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q))
  }, [players, query])
  return (
    <div className="admin">
      <div className="rankings-head">
        <h2>Administration</h2>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>Close</button>
      </div>
      <p className="rankings-sub">Give or remove chips using a player’s number, shown at the top of their lobby. The list of admins is edited in <code>server/admins.txt</code>.</p>

      <form className="admin-give" onSubmit={e => { e.preventDefault(); submit(1) }}>
        <div className="admin-fields">
          <label>
            <span>Player number</span>
            <input inputMode="numeric" maxLength={6} value={number} onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
          </label>
          <label>
            <span>Amount</span>
            <input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="5000" />
          </label>
        </div>
        <div className="admin-target">
          {number.length === 0 && <span className="muted">Enter a number or pick a player from the list.</span>}
          {number.length > 0 && !target && <span className="field-error">No player with this number.</span>}
          {target && (
            <span>
              <b>{target.name}</b> currently has <b>{fmt(target.balance)}</b> chips
              {validAmount && <> and will have <b>{fmt(target.balance + value)}</b> after the gift</>}.
            </span>
          )}
        </div>
        <div className="admin-quick">
          {QUICK.map(q => (
            <button type="button" key={q} onClick={() => setAmount(String(q))}>{fmt(q)}</button>
          ))}
        </div>
        <label className="admin-reason">
          <span>Reason (optional)</span>
          <input value={reason} maxLength={120} onChange={e => setReason(e.target.value)} placeholder="Winner of Friday’s tournament" />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-danger" disabled={!canSubmit} onClick={() => submit(-1)}>Remove</button>
          <button type="submit" className="btn btn-brass" disabled={!canSubmit}>Give {validAmount ? fmt(value) : ''} chips</button>
        </div>
      </form>

      <div className="admin-section-head">
        <h3>Players</h3>
        <input className="admin-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a username or number" />
      </div>
      {!data && <p className="muted">Loading…</p>}
      <ul className="admin-players">
        {filtered.map(p => (
          <li key={p.id} className={String(p.id) === number ? 'is-selected' : ''}>
            <span className="admin-avatar" style={{ background: `hsl(${hue(p.name)} 45% 34%)` }}>{initials(p.name)}</span>
            <span className="admin-name">
              <b>{p.name}</b>
              <small>
                <span className={`dot ${p.online ? 'dot-on' : ''}`} />
                {p.online ? 'Online' : 'Offline'}
                {p.admin && <em className="admin-badge">Admin</em>}
                {!p.claimed && <em className="admin-badge admin-badge-muted">No password</em>}
              </small>
            </span>
            <span className="admin-id">#{p.id}</span>
            <span className="admin-balance">{fmt(p.balance)}</span>
            <span className="admin-actions">
              <button className="btn btn-ghost btn-xs" onClick={() => setNumber(String(p.id))}>Select</button>
            </span>
          </li>
        ))}
      </ul>

      <h3 className="admin-log-title">Recent activity</h3>
      {data && data.log.length === 0 && <p className="muted">No activity yet.</p>}
      <ul className="admin-log">
        {data?.log.map((l, i) => (
          <li key={i}>
            <span className={l.amount >= 0 ? 'plus' : 'minus'}>{l.amount >= 0 ? '+' : '−'}{fmt(Math.abs(l.amount))}</span>
            <span>
              <b>{l.target}</b> (#{l.target_id}) by {l.admin}
              {l.reason && <i>: {l.reason}</i>}
            </span>
            <small>{ago(l.at)}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
