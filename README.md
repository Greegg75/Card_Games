# Aurum Club — Poker & Blackjack multijoueur

Site de cartes en temps réel avec jetons virtuels : plusieurs tables de Texas Hold'em No Limit et de blackjack, jouables à plusieurs depuis n'importe quel navigateur du réseau.

- **Serveur** : Rust (Axum + Tokio, WebSocket). Chaque table tourne dans sa propre tâche asynchrone.
- **Client** : React + Vite + Framer Motion. Tables, cartes et jetons dessinés en SVG.

## Fonctionnalités

**Poker (Texas Hold'em No Limit)**
- 7 tables (6 ou 9 places), des blindes 5/10 (cave 200 à 1 000) jusqu'à 5 000/10 000 (cave à partir de 200 000, sans plafond)
- Bouton, petite et grosse blinde, relance minimum, tapis, pots annexes, partage des pots
- Abattage avec évaluation de la meilleure main sur 7 cartes et mise en valeur des cartes gagnantes
- Minuteur de 25 s par action (parole ou couché automatique), retrait après 3 inactivités
- Cartes privées : chaque joueur ne reçoit que les siennes
- Classement des mains consultable à tout moment, avec votre combinaison actuelle surlignée
- Raccourcis clavier : `F` se coucher, `C` parole/suivre, `R` relancer

**Blackjack**
- 6 tables de 5 places, des mises de 10 à 500 jusqu'à 250 000 sans plafond, sabot de 6 jeux
- Tirer, rester, doubler, séparer (jusqu'à 4 mains)
- Blackjack payé 3 pour 2, la banque reste à 17
- Raccourcis : `H` tirer, `S` rester, `D` doubler, `P` séparer

**Comptes et administration**
- Compte avec pseudo et mot de passe (chiffré avec Argon2), session conservée sur l'appareil
- Chaque joueur reçoit un numéro à 6 chiffres, visible en haut du lobby (clic pour le copier)
- Les administrateurs sont les pseudos listés dans `server/admins.txt` (un par ligne)
- Panneau « Administration » : donner ou retirer des jetons à un joueur via son numéro, avec un motif, liste des joueurs et historique des opérations
- Le joueur concerné est prévenu en direct
- Les comptes sont sauvegardés dans `server/data/accounts.json`

**Commun**
- 20 000 jetons à la création d'un compte
- Recharge possible sous 2 000 jetons
- Spectateurs, discussion et historique par table, reconnexion automatique

## Prérequis

- **Rust** : https://rustup.rs (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Node.js 18 ou plus** : https://nodejs.org (ou `brew install node`)
- Sous Windows, acceptez l'installation des « Visual Studio C++ Build Tools » proposée par rustup, et autorisez le serveur dans le pare-feu pour les réseaux privés au premier lancement.

## Lancement rapide (double-clic)

Une seule personne lance le serveur : l'hôte. Les autres joueurs n'installent rien, ils ouvrent juste le lien envoyé par l'hôte dans leur navigateur.

- **Mac** : double-cliquez sur `lancer.command`
- **Windows** : double-cliquez sur `lancer.bat`

Le script prépare le site, démarre le serveur et ouvre le navigateur automatiquement. La première fois, la compilation prend 1 à 2 minutes. Laissez la fenêtre ouverte pendant la partie et fermez-la pour arrêter le serveur.

Sur Mac, si le double-clic affiche « permission refusée », lancez une seule fois `chmod +x lancer.command` dans un terminal à la racine du projet. Si macOS bloque le fichier, faites clic droit → Ouvrir.

## Lancer le projet à la main (mode partie entre amis)

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

## Jouer à distance avec une adresse fixe (ngrok)

Pour jouer avec des amis qui ne sont pas sur le même Wi-Fi, l'hôte ouvre un tunnel ngrok. L'adresse est gratuite et **ne change jamais** : envoyez-la une fois, vos amis pourront la réutiliser à chaque partie (favori, historique, ancien message).

- **Mac** : double-cliquez sur `en-ligne.command`
- **Windows** : double-cliquez sur `en-ligne.bat`

Le script installe ngrok s'il manque (via Homebrew sur Mac, winget sous Windows), prépare le site, démarre le serveur, ouvre le tunnel puis affiche l'adresse à partager, du type `https://xxxx.ngrok-free.dev`, en la copiant dans le presse-papiers. Fermez la fenêtre pour tout arrêter.

**Première utilisation uniquement** : créez un compte gratuit sur https://dashboard.ngrok.com/signup. Le script ouvre la page de votre authtoken : copiez-le et collez-le dans la fenêtre. Il est enregistré sur l'ordinateur, il ne sera plus demandé.

À savoir :
- L'adresse est liée au compte ngrok de l'hôte : c'est toujours la même personne qui doit lancer le tunnel pour garder la même adresse.
- À la première visite, ngrok affiche une page d'avertissement : il suffit de cliquer sur « Visit Site ».
- Le compte gratuit permet un seul tunnel à la fois et environ 1 Go de trafic par mois, largement suffisant pour des parties entre amis.
- Sur Mac, si le double-clic affiche « permission refusée », lancez une fois `chmod +x en-ligne.command`.

Alternative sans compte, avec une adresse qui change à chaque lancement :

```bash
brew install cloudflared          # Windows : winget install Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```

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
| `DATA_DIR` | `data` | Dossier des données (comptes, soldes, historique admin) |
| `ADMINS_FILE` | `admins.txt` | Fichier listant les pseudos administrateurs |
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
  accounts.rs    comptes, mots de passe, soldes, actions admin + tests
  protocol.rs    messages client/serveur (JSON)

client/src
  net.js                 connexion et état global
  screens/               Login, Lobby, PokerScreen, BlackjackScreen
  components/            Card, Chips, PokerFelt, BlackjackFelt, HandRankings, AdminPanel, Common
```

## Administration : cas particuliers

- **Anciens soldes** : au premier démarrage, les pseudos de l'ancien fichier `data/wallets.json` sont repris avec leur solde. Leur propriétaire récupère son compte en utilisant « Créer un compte » avec le même pseudo.
- **Choisir les administrateurs** : modifiez `server/admins.txt`, un pseudo par ligne, en respectant les accents (`Grégoire` et `Gregoire` sont deux pseudos différents ; majuscules et minuscules sont indifférentes). Les lignes vides et celles qui commencent par `#` sont ignorées. Le changement est pris en compte sans redémarrer le serveur ; la personne concernée doit simplement se déconnecter puis se reconnecter pour voir apparaître ou disparaître le bouton « Administration ».
- **Mot de passe oublié** : supprimez le champ `"hash"` du compte dans `accounts.json` (serveur arrêté). Le joueur pourra redéfinir son mot de passe via « Créer un compte » en gardant son solde et son numéro.

## Tests

```bash
cd server && cargo test
```
