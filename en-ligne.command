#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

SERVER=""
NGROK=""

cleanup() {
  [ -n "$NGROK" ] && kill "$NGROK" 2>/dev/null
  [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null
}
trap cleanup EXIT
trap 'exit 0' INT TERM HUP

pause_and_exit() {
  cleanup
  echo
  read -r -p "Appuyez sur Entrée pour fermer cette fenêtre…"
  exit "$1"
}

if ! command -v cargo >/dev/null 2>&1; then
  echo "Rust n'est pas installé. Installez-le depuis https://rustup.rs puis relancez ce fichier."
  pause_and_exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Installez-le depuis https://nodejs.org puis relancez ce fichier."
  pause_and_exit 1
fi

if ! command -v ngrok >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "♠ Installation de ngrok…"
    brew install --cask ngrok || pause_and_exit 1
  else
    echo "ngrok n'est pas installé. Téléchargez-le sur https://ngrok.com/download puis relancez ce fichier."
    pause_and_exit 1
  fi
fi

has_token() {
  grep -qs authtoken "$HOME/Library/Application Support/ngrok/ngrok.yml" \
    || grep -qs authtoken "$HOME/.config/ngrok/ngrok.yml" \
    || grep -qs authtoken "$HOME/.ngrok2/ngrok.yml"
}

if ! has_token; then
  echo "♠ Première utilisation : ngrok doit être relié à votre compte (gratuit)."
  echo "  1. Créez un compte sur https://dashboard.ngrok.com/signup"
  echo "  2. Copiez votre authtoken sur la page qui va s'ouvrir"
  open "https://dashboard.ngrok.com/get-started/your-authtoken" 2>/dev/null
  echo
  read -r -p "Collez votre authtoken ici puis appuyez sur Entrée : " TOKEN
  TOKEN="$(echo "$TOKEN" | tr -d '[:space:]')"
  if [ -z "$TOKEN" ]; then
    echo "Aucun authtoken saisi."
    pause_and_exit 1
  fi
  ngrok config add-authtoken "$TOKEN" || pause_and_exit 1
fi

echo "♠ Préparation du site…"
cd client || pause_and_exit 1
if [ ! -d node_modules ]; then
  npm install || pause_and_exit 1
fi
npm run build --silent || pause_and_exit 1
cd ..

mkdir -p server/data
LOG_SERVER="$PWD/server/data/serveur.log"
LOG_NGROK="$PWD/server/data/ngrok.log"

echo "♠ Démarrage du serveur (la première fois, la compilation prend 1 à 2 minutes)…"
cd server || pause_and_exit 1
cargo run --release >"$LOG_SERVER" 2>&1 &
SERVER=$!
cd ..

until curl -s -o /dev/null http://localhost:3000; do
  if ! kill -0 "$SERVER" 2>/dev/null; then
    SERVER=""
    echo "Le serveur n'a pas pu démarrer :"
    tail -n 20 "$LOG_SERVER"
    pause_and_exit 1
  fi
  sleep 1
done

echo "♠ Ouverture du tunnel ngrok…"
ngrok http 3000 --log=stdout >"$LOG_NGROK" 2>&1 &
NGROK=$!

URL=""
for _ in $(seq 1 30); do
  if ! kill -0 "$NGROK" 2>/dev/null; then
    NGROK=""
    echo "Le tunnel ngrok n'a pas pu s'ouvrir :"
    tail -n 10 "$LOG_NGROK"
    echo
    echo "Si le message parle d'une session déjà ouverte, fermez l'autre fenêtre ngrok et relancez."
    pause_and_exit 1
  fi
  URL="$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -n 1 | cut -d'"' -f4)"
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Impossible de récupérer l'adresse du tunnel :"
  tail -n 10 "$LOG_NGROK"
  pause_and_exit 1
fi

echo "$URL" | pbcopy 2>/dev/null
open http://localhost:3000 2>/dev/null

clear
echo
echo "  ♠ Aurum Club est en ligne"
echo
echo "  Adresse pour vos amis : $URL"
echo "  (copiée dans le presse-papiers, elle reste la même à chaque lancement)"
echo
echo "  Sur cette machine : http://localhost:3000"
echo
echo "  Laissez cette fenêtre ouverte pendant la partie."
echo "  Fermez-la ou appuyez sur Ctrl+C pour tout arrêter."
echo

wait "$NGROK"
