import { useState, useEffect, useCallback, useRef } from 'react';

export function usePokerWebSocket(url) {
  const [isConnected, setIsConnected] = useState(false);
  const [myPseudo, setMyPseudo] = useState(""); // Notre identité !
  const [gameState, setGameState] = useState({
    phase: 'WaitingForPlayers',
    pot: 0,
    community_cards: [],
    players: [],
    hole_cards: {}
  });
  const [logs, setLogs] = useState([]);
  
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setIsConnected(true);
    ws.current.onclose = () => setIsConnected(false);

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("Reçu du serveur:", message);

      if (message.type === "GameStateUpdate") {
        setGameState(message.data);
      } else if (message.type === "Welcome") {
        setMyPseudo(message.data.pseudo);
      } else if (message.type === "PlayerJoined") {
        setLogs(prev => [...prev, `${message.data.pseudo} a rejoint la table.`]);
      }
    };

    return () => ws.current?.close();
  }, [url]);

  // Fonction pour envoyer une action au serveur Rust
  const sendAction = useCallback((action, payload = null) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      // Si on n'a pas de payload (ex: Fold, Check), on envoie juste l'action
      const message = payload ? { action, payload } : { action };
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  // L'export crucial de myPseudo est bien ici
  return { isConnected, gameState, logs, sendAction, myPseudo };
}