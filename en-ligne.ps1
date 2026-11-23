Set-Location $PSScriptRoot

$server = $null
$ngrok = $null

function Stop-All {
  if ($ngrok -and -not $ngrok.HasExited) { taskkill /PID $ngrok.Id /T /F 2>$null | Out-Null }
  if ($server -and -not $server.HasExited) { taskkill /PID $server.Id /T /F 2>$null | Out-Null }
}

function Fin($code) {
  Stop-All
  Write-Host ""
  Read-Host "Appuyez sur Entree pour fermer cette fenetre"
  exit $code
}

function Has($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Has 'cargo')) {
  Write-Host "Rust n'est pas installe. Installez-le depuis https://rustup.rs puis relancez ce fichier."
  Fin 1
}
if (-not (Has 'npm')) {
  Write-Host "Node.js n'est pas installe. Installez-le depuis https://nodejs.org puis relancez ce fichier."
  Fin 1
}

if (-not (Has 'ngrok')) {
  if (Has 'winget') {
    Write-Host "Installation de ngrok..."
    winget install --id ngrok.ngrok -e --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  }
  if (-not (Has 'ngrok')) {
    Write-Host "ngrok n'est pas installe. Telechargez-le sur https://ngrok.com/download puis relancez ce fichier."
    Fin 1
  }
}

$configs = @(
  (Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.yml'),
  (Join-Path $env:USERPROFILE '.ngrok2\ngrok.yml'),
  (Join-Path $env:USERPROFILE '.config\ngrok\ngrok.yml')
)
$hasToken = $false
foreach ($c in $configs) {
  if ((Test-Path $c) -and (Select-String -Path $c -Pattern 'authtoken' -Quiet)) { $hasToken = $true }
}

if (-not $hasToken) {
  Write-Host "Premiere utilisation : ngrok doit etre relie a votre compte (gratuit)."
  Write-Host "  1. Creez un compte sur https://dashboard.ngrok.com/signup"
  Write-Host "  2. Copiez votre authtoken sur la page qui va s'ouvrir"
  Start-Process "https://dashboard.ngrok.com/get-started/your-authtoken"
  Write-Host ""
  $token = (Read-Host "Collez votre authtoken ici puis appuyez sur Entree").Trim()
  if (-not $token) {
    Write-Host "Aucun authtoken saisi."
    Fin 1
  }
  & ngrok config add-authtoken $token
  if ($LASTEXITCODE -ne 0) { Fin 1 }
}

Write-Host "Preparation du site..."
Push-Location client
if (-not (Test-Path node_modules)) {
  & npm install
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fin 1 }
}
& npm run build --silent
if ($LASTEXITCODE -ne 0) { Pop-Location; Fin 1 }
Pop-Location

New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot 'server\data') | Out-Null
$logServer = Join-Path $PSScriptRoot 'server\data\serveur.log'
$logServerErr = Join-Path $PSScriptRoot 'server\data\serveur-erreurs.log'
$logNgrok = Join-Path $PSScriptRoot 'server\data\ngrok.log'

Write-Host "Demarrage du serveur, la premiere fois la compilation prend 1 a 2 minutes..."
$server = Start-Process cargo -ArgumentList 'run', '--release' -WorkingDirectory (Join-Path $PSScriptRoot 'server') -NoNewWindow -PassThru -RedirectStandardOutput $logServer -RedirectStandardError $logServerErr

try {
  while ($true) {
    try {
      $tcp = New-Object Net.Sockets.TcpClient('127.0.0.1', 3000)
      $tcp.Close()
      break
    } catch {
      if ($server.HasExited) {
        Write-Host "Le serveur n'a pas pu demarrer :"
        Get-Content $logServerErr -Tail 20
        Fin 1
      }
      Start-Sleep -Seconds 1
    }
  }

  Write-Host "Ouverture du tunnel ngrok..."
  $ngrok = Start-Process ngrok -ArgumentList 'http', '3000', '--log=stdout' -NoNewWindow -PassThru -RedirectStandardOutput $logNgrok -RedirectStandardError (Join-Path $PSScriptRoot 'server\data\ngrok-erreurs.log')

  $url = $null
  for ($i = 0; $i -lt 30 -and -not $url; $i++) {
    if ($ngrok.HasExited) {
      Write-Host "Le tunnel ngrok n'a pas pu s'ouvrir :"
      Get-Content $logNgrok -Tail 10
      Write-Host ""
      Write-Host "Si le message parle d'une session deja ouverte, fermez l'autre fenetre ngrok et relancez."
      Fin 1
    }
    try {
      $r = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2
      $url = ($r.tunnels | Where-Object { $_.public_url -like 'https*' } | Select-Object -First 1).public_url
    } catch {}
    if (-not $url) { Start-Sleep -Seconds 1 }
  }

  if (-not $url) {
    Write-Host "Impossible de recuperer l'adresse du tunnel :"
    Get-Content $logNgrok -Tail 10
    Fin 1
  }

  Set-Clipboard -Value $url
  Start-Process "http://localhost:3000"

  Clear-Host
  Write-Host ""
  Write-Host "  Aurum Club est en ligne"
  Write-Host ""
  Write-Host "  Adresse pour vos amis : $url"
  Write-Host "  (copiee dans le presse-papiers, elle reste la meme a chaque lancement)"
  Write-Host ""
  Write-Host "  Sur cette machine : http://localhost:3000"
  Write-Host ""
  Write-Host "  Laissez cette fenetre ouverte pendant la partie."
  Write-Host "  Fermez-la ou appuyez sur Ctrl+C pour tout arreter."
  Write-Host ""

  Wait-Process -Id $ngrok.Id
} finally {
  Stop-All
}
