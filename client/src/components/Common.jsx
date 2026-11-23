import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { fmt, hue, initials } from '../format.js'
import { getState, send, useStore } from '../net.js'
import { Chip } from './Chips.jsx'

export function Stage({ width = 1600, height = 960, children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    const update = () => {
      const r = el.getBoundingClientRect()
      setScale(Math.min(r.width / width, r.height / height))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height])
  return (
    <div className="stage-wrap" ref={ref}>
      <div className="stage" style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

export function useCountdown(timerMs) {
  const receivedAt = useStore(s => s.receivedAt)
  const [now, setNow] = useState(performance.now())
  useEffect(() => {
    if (timerMs == null) return
    let raf
    const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [timerMs, receivedAt])
  if (timerMs == null) return null
  return Math.max(0, timerMs - (now - receivedAt))
}

export function Avatar({ name, size = 84, progress = null, active = false, dim = false, winner = false }) {
  const h = hue(name)
  const r = 46
  const circ = 2 * Math.PI * r
  const danger = progress != null && progress < 0.25
  return (
    <div className={`avatar ${active ? 'avatar-active' : ''} ${dim ? 'avatar-dim' : ''} ${winner ? 'avatar-winner' : ''}`} style={{ width: size, height: size }}>
      <div
        className="avatar-face"
        style={{ background: `radial-gradient(circle at 35% 30%, hsl(${h} 45% 52%), hsl(${h} 50% 26%) 70%, hsl(${h} 55% 14%))` }}
      >
        <span>{initials(name)}</span>
      </div>
      <svg className="avatar-ring" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#brass)" strokeWidth="3.5" />
        {progress != null && (
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={danger ? '#e2513f' : '#8fe3b0'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
            transform="rotate(-90 50 50)"
          />
        )}
      </svg>
    </div>
  )
}

export function Modal({ open, onClose, children, className = '' }) {
  useEffect(() => {
    if (!open) return
    const k = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            className={`modal ${className}`}
            role="dialog"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onMouseDown={e => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Balance() {
  const balance = useStore(s => s.balance)
  return (
    <div className="balance" title="Your chip balance">
      <Chip value={1000} size={26} label={false} />
      <span>{fmt(balance)}</span>
      {balance < 2000 && (
        <button className="btn btn-ghost btn-xs" onClick={() => send({ t: 'refill' })}>Refill</button>
      )}
    </div>
  )
}

export function Toasts() {
  const toasts = useStore(s => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} className={`toast toast-${t.kind}`} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function ConnectionBanner() {
  const status = useStore(s => s.status)
  if (status === 'online') return null
  return <div className="conn-banner">{status === 'connecting' ? 'Connecting to server…' : 'Connection lost, retrying…'}</div>
}

export function SidePanel({ log }) {
  const chat = useStore(s => s.chat)
  const [tab, setTab] = useState('log')
  const [open, setOpen] = useState(true)
  const [text, setText] = useState('')
  const [seen, setSeen] = useState(0)
  const listRef = useRef(null)
  useEffect(() => {
    if (tab === 'chat') setSeen(chat.length)
  }, [tab, chat.length])
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log, chat, tab, open])
  const unread = tab !== 'chat' ? chat.length - seen : 0
  const submit = e => {
    e.preventDefault()
    if (!text.trim()) return
    send({ t: 'chat', text })
    setText('')
  }
  return (
    <div className={`side-panel ${open ? '' : 'side-panel-closed'}`}>
      <div className="side-tabs">
        <button className={tab === 'log' ? 'on' : ''} onClick={() => { setTab('log'); setOpen(true) }}>History</button>
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => { setTab('chat'); setOpen(true) }}>
          Chat {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        <button className="side-toggle" onClick={() => setOpen(o => !o)} aria-label={open ? 'Collapse' : 'Expand'}>{open ? '–' : '+'}</button>
      </div>
      {open && (
        <>
          <div className="side-list" ref={listRef}>
            {tab === 'log' && (log.length ? log.map((l, i) => <div key={i} className={l.startsWith('—') ? 'log-sep' : 'log-line'}>{l}</div>) : <div className="log-empty">Nothing yet.</div>)}
            {tab === 'chat' && (chat.length ? chat.map(m => (
              <div key={m.id} className="chat-line"><b style={{ color: `hsl(${hue(m.from)} 60% 70%)` }}>{m.from}</b> {m.text}</div>
            )) : <div className="log-empty">Say hi to the table.</div>)}
          </div>
          {tab === 'chat' && (
            <form className="chat-form" onSubmit={submit}>
              <input value={text} onChange={e => setText(e.target.value)} maxLength={200} placeholder="Write a message" />
              <button className="btn btn-brass btn-xs" type="submit">Send</button>
            </form>
          )}
        </>
      )}
    </div>
  )
}

export function leaveTable() {
  if (getState().table) send({ t: 'leave' })
}
