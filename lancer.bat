@echo off
chcp 65001 >nul
cd /d "%~dp0"

where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust n'est pas installe. Installez-le depuis https://rustup.rs puis relancez ce fichier.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installez-le depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)

echo Preparation du site...
pushd client
if not exist node_modules (
  call npm install
  if errorlevel 1 goto fail
)
call npm run build --silent
if errorlevel 1 goto fail
popd

start "" powershell -NoProfile -WindowStyle Hidden -Command "for(;;){try{$c=New-Object Net.Sockets.TcpClient('127.0.0.1',3000);$c.Close();break}catch{Start-Sleep 1}};Start-Process 'http://localhost:3000'"

echo Demarrage du serveur, la premiere fois la compilation prend 1 a 2 minutes...
echo Laissez cette fenetre ouverte pendant la partie. Fermez-la pour arreter le serveur.
cd server
cargo run --release
pause
exit /b 0

:fail
echo Une erreur est survenue pendant la preparation du site.
pause
exit /b 1
