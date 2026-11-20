# Aurum Club — Poker & Blackjack multijoueur

Site de cartes en temps réel avec jetons virtuels : plusieurs tables de Texas Hold'em No Limit et de blackjack, jouables à plusieurs depuis n'importe quel navigateur du réseau.

- **Serveur** : Rust (Axum + Tokio, WebSocket). Chaque table tourne dans sa propre tâche asynchrone.
- **Client** : React + Vite + Framer Motion. Tables, cartes et jetons dessinés en SVG.

## Fonctionnalités

**Poker (Texas Hold'em No Limit)**
- 5 tables (6 ou 9 places), blindes de 5/10 à 200/400
- Bouton, petite et grosse blinde, relance minimum, tapis, pots annexes, partage des pots
- Abattage avec évaluation de la meilleure main sur 7 cartes et mise en valeur des cartes gagnantes
- Minuteur de 25 s par action (parole ou couché automatique), retrait après 3 inactivités
- Cartes privées : chaque joueur ne reçoit que les siennes
- Classement des mains consultable à tout moment, avec votre combinaison actuelle surlignée
- Raccourcis clavier : `F` se coucher, `C` parole/suivre, `R` relancer

**Blackjack**
- 3 tables de 5 places, sabot de 6 jeux
- Tirer, rester, doubler, séparer (jusqu'à 4 mains)
- Blackjack payé 3 pour 2, la banque reste à 17
- Raccourcis : `H` tirer, `S` rester, `D` doubler, `P` séparer

**Commun**
- 20 000 jetons à la création d'un pseudo, solde sauvegardé dans `server/data/wallets.json`
- Recharge possible sous 2 000 jetons
- Spectateurs, discussion et historique par table, reconnexion automatique

## Prérequis

- **Rust** : https://rustup.rs (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Node.js 18 ou plus** : https://nodejs.org (ou `brew install node`)

## Lancer le projet (mode partie entre amis)

```bash
cd client
npm install
npm run build

cd ../server
cargo run --release
```

Le serveur affiche deux adresses :

```
  Sur cette machine : http://localhost:3000
  Sur le réseau     : http://192.168.1.42:3000
```

- Ouvrez la première dans votre navigateur.
- Vos amis connectés au **même Wi-Fi** ouvrent la seconde.
- Sur macOS, acceptez la fenêtre « Autoriser les connexions entrantes ». Sous Windows, autorisez le pare-feu pour les réseaux privés.

Pour tester seul à plusieurs joueurs : ouvrez une fenêtre normale et une fenêtre de navigation privée avec deux pseudos différents.

## Jouer à distance (hors du même réseau)

Avec un tunnel Cloudflare, sans configurer votre box :

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

Partagez l'adresse `https://….trycloudflare.com` affichée. Le client passe automatiquement en `wss://`.

## Mode développement (rechargement à chaud)

Deux terminaux :

```bash
cd server && cargo run
```

```bash
cd client && npm run dev
```

Ouvrez http://localhost:5173. Vite redirige `/ws` vers le serveur Rust sur le port 3000.

## Variables d'environnement du serveur

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `3000` | Port d'écoute |
| `STATIC_DIR` | `../client/dist` | Dossier du frontend compilé |
| `DATA_FILE` | `data/wallets.json` | Fichier des soldes |
| `TIMING_SCALE` | `1` | Multiplie les délais de jeu (ex. `0.2` pour des tests rapides) |

## Structure

```
server/src
  main.rs        démarrage, routes, fichiers statiques
  conn.rs        connexion WebSocket d'un joueur
  hub.rs         registre des tables, soldes, lobby
  poker.rs       moteur Texas Hold'em (une tâche par table)
  blackjack.rs   moteur blackjack (une tâche par table)
  eval.rs        évaluateur de mains + tests
  cards.rs       cartes et paquets
  wallet.rs      soldes persistants
  protocol.rs    messages client/serveur (JSON)

client/src
  net.js                 connexion et état global
  screens/               Login, Lobby, PokerScreen, BlackjackScreen
  components/            Card, Chips, PokerFelt, BlackjackFelt, HandRankings, Common
```

## Tests

```bash
cd server && cargo test
```
