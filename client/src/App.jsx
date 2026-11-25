import { MotionConfig } from 'framer-motion'
import { useStore } from './net.js'
import Defs from './components/Defs.jsx'
import { ConnectionBanner, Toasts } from './components/Common.jsx'
import Login from './screens/Login.jsx'
import Home from './screens/Home.jsx'
import Lobby from './screens/Lobby.jsx'
import PokerScreen from './screens/PokerScreen.jsx'
import BlackjackScreen from './screens/BlackjackScreen.jsx'

export default function App() {
  const me = useStore(s => s.me)
  const game = useStore(s => s.game)
  const section = useStore(s => s.section)
  let screen = <Login />
  if (me && game === 'poker') screen = <PokerScreen />
  else if (me && game === 'blackjack') screen = <BlackjackScreen />
  else if (me && !section) screen = <Home />
  else if (me) screen = <Lobby />
  return (
    <MotionConfig reducedMotion="user">
      <Defs />
      {screen}
      <Toasts />
      <ConnectionBanner />
    </MotionConfig>
  )
}
