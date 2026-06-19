<#
.SYNOPSIS
  Configure un worktree Plume fraîchement créé : relie le .env.local au store
  central de secrets puis installe les dépendances.

.DESCRIPTION
  Les secrets ne sont JAMAIS committés (.env* gitignored), donc chaque nouveau
  worktree git arrive sans .env.local. Plutôt que de le recréer à la main, ce
  script pointe le worktree vers une source unique : ~/.config/plume/.env.local.

  Édite tes secrets UNE fois dans ce fichier central ; tous les worktrees liés
  par symlink en héritent. (Fallback copie si symlinks indisponibles.)

.EXAMPLE
  pwsh plume/scripts/setup-worktree.ps1
#>
[CmdletBinding()]
param(
  # Recopie au lieu de lier (utile si Developer Mode OFF et pas d'admin).
  [switch]$Copy,
  # Saute pnpm install (utile si déjà fait).
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'

# Racine de l'app = parent du dossier scripts/.
$plumeDir = Split-Path -Parent $PSScriptRoot
$target   = Join-Path $plumeDir '.env.local'
$central  = Join-Path $HOME '.config/plume/.env.local'

if (-not (Test-Path $central)) {
  Write-Host "✗ Store central absent : $central" -ForegroundColor Red
  Write-Host "  Crée-le depuis plume/.env.example puis renseigne tes secrets :"
  Write-Host "    New-Item -ItemType Directory -Force (Split-Path $central) | Out-Null"
  Write-Host "    Copy-Item plume/.env.example $central"
  exit 1
}

# Idempotent : on retire un éventuel .env.local existant avant de (re)lier.
if (Test-Path $target) { Remove-Item $target -Force }

$linked = $false
if (-not $Copy) {
  # 1) Symlink (idéal : suit le central même après atomic-save). Requiert Developer Mode ou admin.
  try {
    New-Item -ItemType SymbolicLink -Path $target -Target $central -ErrorAction Stop | Out-Null
    $linked = $true
    Write-Host "✓ Symlink .env.local -> $central" -ForegroundColor Green
  } catch {
    # 2) Hardlink (sans admin/Dev Mode, même volume). Limite : un éditeur en atomic-save casse le lien.
    try {
      New-Item -ItemType HardLink -Path $target -Target $central -ErrorAction Stop | Out-Null
      $linked = $true
      Write-Host "✓ Hardlink .env.local <-> $central (active Developer Mode pour un vrai symlink)" -ForegroundColor Green
    } catch {
      Write-Host "⚠ Symlink + hardlink refusés. Copie à la place." -ForegroundColor Yellow
    }
  }
}
if (-not $linked) {
  Copy-Item $central $target -Force
  Write-Host "✓ .env.local copié depuis $central (édite le central + relance ce script pour resync)" -ForegroundColor Green
}

if (-not $NoInstall) {
  Write-Host "→ corepack pnpm install ..." -ForegroundColor Cyan
  Push-Location $plumeDir
  try { corepack pnpm install } finally { Pop-Location }
}

Write-Host "`nPrêt. Lance : corepack pnpm dev" -ForegroundColor Green
