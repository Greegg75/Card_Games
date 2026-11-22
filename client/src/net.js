import { useSyncExternalStore } from 'react'

const TOKEN_KEY = 'aurum-token'
const listeners = new Set()
let state = {
  status: 'connecting',
  me: null,
  playerId: null,
  admin: false,
  authPending: false,
  balance: 0,
  lobby: [],
  table: null,
  game: null,
  poker: null,
  bj: null,
  receivedAt: 0,
  chat: [],
  toasts: [],
  adminData: null
}
let ws = null
let wantedTable = null
let resumeAllowed = true
let toastId = 0

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

function writeToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch {}
}

export function toast(msg, kind = 'error') {
  const id = ++toastId
  set({ toasts: [...state.toasts, { id, msg, kind }] })
  setTimeout(() => set({ toasts: state.toasts.filter(t => t.id !== id) }), kind === 'info' ? 5000 : 3800)
}

function url() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

const signedOut = { me: null, playerId: null, admin: false, table: null, game: null, poker: null, bj: null, chat: [], adminData: null }

function connect() {
  ws = new WebSocket(url())
  ws.onopen = () => {
    const token = readToken()
    if (token && resumeAllowed) {
      set({ status: 'online', authPending: true })
      raw({ t: 'resume', token })
    } else {
      set({ status: 'online' })
    }
  }
  ws.onclose = () => {
    set({ status: 'offline', table: null, game: null, poker: null, bj: null, authPending: false })
    setTimeout(connect, 1500)
  }
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data)
    switch (m.t) {
      case 'welcome':
        resumeAllowed = true
        writeToken(m.token)
        try { localStorage.setItem('aurum-name', m.name) } catch {}
        set({ me: m.name, balance: m.balance, playerId: m.player_id, admin: m.admin, authPending: false })
        if (wantedTable) raw({ t: 'join', table: wantedTable })
        break
      case 'auth_error':
        if (m.fatal) writeToken(null)
        set({ authPending: false })
        toast(m.msg)
        break
      case 'logged_out':
        resumeAllowed = false
        wantedTable = null
        set({ ...signedOut, authPending: false })
        break
      case 'role':
        set({ admin: m.admin, adminData: m.admin ? state.adminData : null })
        break
      case 'notice':
        toast(m.msg, 'info')
        break
      case 'admin_players':
        set({ adminData: { players: m.players, log: m.log } })
        break
      case 'error':
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
  if (msg.t === 'join') wantedTable = msg.table
  if (msg.t === 'leave') wantedTable = null
  raw(msg)
}

export function login(name, password) {
  set({ authPending: true })
  raw({ t: 'login', name, password })
}

export function register(name, password) {
  set({ authPending: true })
  raw({ t: 'register', name, password })
}

export function logout() {
  writeToken(null)
  raw({ t: 'logout' })
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
