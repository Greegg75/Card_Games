#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

pause_and_exit() {
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

echo "♠ Préparation du site…"
cd client || pause_and_exit 1
if [ ! -d node_modules ]; then
  npm install || pause_and_exit 1
fi
npm run build --silent || pause_and_exit 1
cd ../server || pause_and_exit 1

(
  until curl -s -o /dev/null http://localhost:3000; do sleep 1; done
  if command -v open >/dev/null 2>&1; then open http://localhost:3000; else xdg-open http://localhost:3000 >/dev/null 2>&1; fi
) &
OPENER=$!

echo "♠ Démarrage du serveur (la première fois, la compilation prend 1 à 2 minutes)…"
echo "  Laissez cette fenêtre ouverte pendant la partie. Fermez-la pour arrêter le serveur."
cargo run --release
kill "$OPENER" 2>/dev/null
pause_and_exit 0
