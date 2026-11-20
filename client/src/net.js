import { useSyncExternalStore } from 'react'

const listeners = new Set()
let state = {
  status: 'connecting',
  me: null,
  balance: 0,
  lobby: [],
  table: null,
  game: null,
  poker: null,
  bj: null,
  receivedAt: 0,
  chat: [],
  toasts: []
}
let ws = null
let wantedName = null
let wantedTable = null
let toastId = 0

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

export function toast(msg, kind = 'error') {
  const id = ++toastId
  set({ toasts: [...state.toasts, { id, msg, kind }] })
  setTimeout(() => set({ toasts: state.toasts.filter(t => t.id !== id) }), 3800)
}

function url() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

function connect() {
  ws = new WebSocket(url())
  ws.onopen = () => {
    set({ status: 'online' })
    if (wantedName) raw({ t: 'hello', name: wantedName })
  }
  ws.onclose = () => {
    set({ status: 'offline', table: null, game: null, poker: null, bj: null })
    setTimeout(connect, 1500)
  }
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data)
    switch (m.t) {
      case 'welcome':
        set({ me: m.name, balance: m.balance })
        try { localStorage.setItem('aurum-name', m.name) } catch {}
        if (wantedTable) raw({ t: 'join', table: wantedTable })
        break
      case 'error':
        if (!state.me) wantedName = null
        toast(m.msg)
        break
      case 'balance':
        set({ balance: m.balance })
        break
      case 'lobby':
        set({ lobby: m.tables })
        break
      case 'joined':
        wantedTable = m.table
        set({ table: m.table, game: m.game, poker: null, bj: null, chat: [] })
        break
      case 'left':
        wantedTable = null
        set({ table: null, game: null, poker: null, bj: null, chat: [] })
        raw({ t: 'lobby' })
        break
      case 'poker':
        set({ poker: m.state, receivedAt: performance.now() })
        break
      case 'blackjack':
        set({ bj: m.state, receivedAt: performance.now() })
        break
      case 'chat':
        set({ chat: [...state.chat.slice(-60), { from: m.from, text: m.text, id: ++toastId }] })
        break
    }
  }
}

function raw(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

export function send(msg) {
  if (msg.t === 'hello') wantedName = msg.name
  if (msg.t === 'join') wantedTable = msg.table
  if (msg.t === 'leave') wantedTable = null
  raw(msg)
}

export function savedName() {
  try { return localStorage.getItem('aurum-name') || '' } catch { return '' }
}

export function useStore(selector = s => s) {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => selector(state)
  )
}

export function getState() {
  return state
}

connect()
