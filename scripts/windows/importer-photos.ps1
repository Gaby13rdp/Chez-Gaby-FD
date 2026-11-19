# =============================================================================
#  IMPORTER LES PHOTOS - version Windows (solution de secours, docs/03)
#  A utiliser seulement si le workflow « Importer les photos » échoue parce
#  que Booking ou Airbnb refusent les serveurs de GitHub.
#  Mode d'emploi : double-cliquez sur « importer-photos.bat » (même dossier),
#  dans votre copie du dépôt (GitHub Desktop), puis envoyez les photos avec
#  GitHub Desktop (Commit to main, puis Push origin).
#  Même liste, mêmes dossiers, mêmes noms que le workflow ; les photos déjà
#  présentes ne sont jamais re-téléchargées.
# =============================================================================
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Drawing

$racine = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$liste = Join-Path $racine 'config\photos-a-importer.yml'
$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
$utf8SansBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $liste)) {
  Write-Host "Liste introuvable : $liste" -ForegroundColor Red
  Write-Host "Lancez ce script depuis le dossier scripts\windows de votre copie du dépôt."
  exit 1
}

# --- Lecture de la liste (adresse > logement > photos) ----------------------
function Lire-Liste([string]$chemin) {
  $photos = New-Object System.Collections.ArrayList
  $adresse = $null; $section = $null; $logement = $null; $courant = $null
  foreach ($l in [System.IO.File]::ReadAllLines($chemin, [System.Text.Encoding]::UTF8)) {
    $t = $l.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    if ($l -match '^([a-z0-9][a-z0-9-]*):\s*(#.*)?$') { $adresse = $Matches[1]; $section = $null; $logement = $null; $courant = $null; continue }
    if ($l -match '^  photos:\s*(#.*)?$') { $section = 'photos'; $logement = $null; $courant = $null; continue }
    if ($l -match '^  logements:\s*(#.*)?$') { $section = 'logements'; $logement = $null; $courant = $null; continue }
    if ($section -eq 'logements' -and $l -match '^    ([a-z0-9][a-z0-9-]*):\s*(#.*)?$') { $logement = $Matches[1]; $courant = $null; continue }
    if ($t -match '^-\s*url:\s*(\S+)') {
      $courant = New-Object PSObject -Property @{ Adresse = $adresse; Logement = $logement; Url = $Matches[1]; Fichier = ''; Legende = '' }
      [void]$photos.Add($courant); continue
    }
    if ($courant -and $t -match '^fichier:\s*(\S+)') { $courant.Fichier = $Matches[1]; continue }
    if ($courant -and $t -match '^legende:\s*"(.*)"\s*$') { $courant.Legende = ($Matches[1] -replace '\\"', '"') -replace '\\\\', '\'; continue }
  }
  return ,$photos   # la virgule garde la liste entière (sinon PowerShell la déroule)
}

function Type-Image([string]$chemin) {
  $o = New-Object byte[] 12
  $f = [System.IO.File]::OpenRead($chemin)
  try { $n = $f.Read($o, 0, 12) } finally { $f.Close() }
  if ($n -lt 12 -or (Get-Item $chemin).Length -lt 500) { return $null }
  if ($o[0] -eq 0xFF -and $o[1] -eq 0xD8 -and $o[2] -eq 0xFF) { return 'jpeg' }
  if ($o[0] -eq 0x89 -and $o[1] -eq 0x50 -and $o[2] -eq 0x4E -and $o[3] -eq 0x47) { return 'png' }
  if ([System.Text.Encoding]::ASCII.GetString($o, 0, 4) -eq 'RIFF' -and [System.Text.Encoding]::ASCII.GetString($o, 8, 4) -eq 'WEBP') { return 'webp' }
  return $null
}

function Dimensions([string]$chemin) {
  try {
    $img = [System.Drawing.Image]::FromFile($chemin)
    $d = @($img.Width, $img.Height)
    $img.Dispose()
    return $d
  } catch { return $null }
}

function Vers-Jpeg([string]$source, [string]$cible) {
  $img = [System.Drawing.Image]::FromFile($source)
  try {
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
    $img.Save($cible, $codec, $params)
  } finally { $img.Dispose() }
}

# Télécharge une adresse dans $dest (3 essais) ; renvoie le type d'image.
function Telecharger([string]$url, [string]$dest) {
  $referer = $null
  if ($url -match 'bstatic\.com') { $referer = 'https://www.booking.com/' }
  elseif ($url -match 'muscache\.com') { $referer = 'https://www.airbnb.fr/' }
  $derniere = ''
  foreach ($attente in @(0, 3, 10)) {
    if ($attente -gt 0) { Start-Sleep -Seconds $attente }
    try {
      $req = [System.Net.HttpWebRequest]::Create($url)
      $req.UserAgent = $UA
      $req.Accept = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      if ($referer) { $req.Referer = $referer }
      $req.Headers.Add('Accept-Language', 'fr-FR,fr;q=0.9')
      $req.Timeout = 60000
      $rep = $req.GetResponse()
      try {
        $flux = $rep.GetResponseStream()
        $fichier = [System.IO.File]::Create($dest)
        try { $flux.CopyTo($fichier) } finally { $fichier.Close(); $flux.Close() }
      } finally { $rep.Close() }
      $type = Type-Image $dest
      if (-not $type) { throw "la réponse n'est pas une image (site qui bloque ?)" }
      return $type
    } catch {
      $derniere = $_.Exception.Message
      if ($_.Exception.InnerException) { $derniere = $_.Exception.InnerException.Message }
      if (Test-Path $dest) { Remove-Item $dest -Force }
      if ($derniere -match '\(404\)|\(410\)') { break }
    }
  }
  throw $derniere
}

# Plus grande version disponible : Airbnb = originale (secours 1200 px) ;
# Booking = tailles plus grandes essayées, gardées seulement si c'est la même photo en plus grand.
function Meilleure-Version([string]$url, [string]$tmp) {
  $sansParam = $url.Split('?')[0]
  if ($url -match 'muscache\.com') {
    try { $t = Telecharger $sansParam $tmp; return @($t, 'originale') }
    catch { $t = Telecharger ($sansParam + '?im_w=1200') $tmp; return @($t, '1200 px (secours)') }
  }
  $t = Telecharger $url $tmp
  if ($url -match '^(https://[^/]*bstatic\.com/xdata/images/hotel/)([^/]+)(/.*)$') {
    $debut = $Matches[1]; $taille = $Matches[2]; $fin = $Matches[3]
    $ref = Dimensions $tmp
    foreach ($candidat in @('max3000', 'max1920x1080', 'max1280x900')) {
      if ($candidat -eq $taille) { break }
      $essai = "$tmp.essai"
      try {
        $te = Telecharger ($debut + $candidat + $fin) $essai
        $d = Dimensions $essai
        if ($ref -and $d -and $d[0] -gt $ref[0] -and [Math]::Abs($d[0] / $d[1] - $ref[0] / $ref[1]) -lt 0.02) {
          Move-Item $essai $tmp -Force
          return @($te, $candidat)
        }
      } catch { }
      if (Test-Path $essai) { Remove-Item $essai -Force }
    }
    return @($t, $taille)
  }
  return @($t, 'telle quelle')
}

# --- Import --------------------------------------------------------------
$photos = Lire-Liste $liste
Write-Host "Liste : $($photos.Count) photo(s) à vérifier." -ForegroundColor Cyan
$nouvelles = 0; $deja = 0; $echecs = 0; $groupe = ''
$logements = @{}
foreach ($p in $photos) {
  if ($p.Logement) {
    $dossier = Join-Path $racine ('content\logements\' + $p.Logement); $titre = "Logement « $($p.Logement) »"; $logements[$p.Logement] = $dossier
  } else {
    $dossier = Join-Path $racine ('content\etablissements\' + $p.Adresse); $titre = "Adresse « $($p.Adresse) »"
  }
  if ($titre -ne $groupe) { Write-Host ''; Write-Host $titre -ForegroundColor Cyan; $groupe = $titre }
  if (-not (Test-Path (Join-Path $dossier 'index.md'))) { Write-Host "  ECHEC $($p.Fichier) : fiche introuvable ($dossier\index.md), créez-la d'abord" -ForegroundColor Red; $echecs++; continue }
  if ($p.Fichier -notmatch '^[a-z0-9][a-z0-9-]*\.(jpe?g|png|webp)$') { Write-Host "  ECHEC « $($p.Fichier) » : nom de fichier invalide" -ForegroundColor Red; $echecs++; continue }
  $dossierPhotos = Join-Path $dossier 'photos'
  $cible = Join-Path $dossierPhotos $p.Fichier
  if (Test-Path $cible) { $deja++; continue }
  New-Item -ItemType Directory -Force -Path $dossierPhotos | Out-Null
  $tmp = Join-Path $env:TEMP ('photo-' + [guid]::NewGuid().ToString() + '.tmp')
  try {
    $r = Meilleure-Version $p.Url $tmp
    $d = Dimensions $tmp
    if ($d -and ($d[0] -lt 200 -or $d[1] -lt 150)) { throw "image minuscule ($($d[0]) x $($d[1]) px) : sans doute une image d'erreur du site" }
    if ($p.Fichier -match '\.jpe?g$' -and $r[0] -ne 'jpeg') { Vers-Jpeg $tmp $cible } else { Move-Item $tmp $cible -Force }
    $taille = ''
    if ($d) { $taille = " - $($d[0]) x $($d[1]) px" }
    Write-Host "  OK    $($p.Fichier)$taille ($($r[1]))" -ForegroundColor Green
    $nouvelles++
    if ($p.Legende) {
      $fichierLeg = Join-Path $dossierPhotos 'photos.yml'
      $existant = ''
      if (Test-Path $fichierLeg) { $existant = [System.IO.File]::ReadAllText($fichierLeg, [System.Text.Encoding]::UTF8) }
      if ($existant -notmatch ('(?m)^' + [regex]::Escape($p.Fichier) + '\s*:')) {
        $ajout = ''
        if ($existant -and -not $existant.EndsWith("`n")) { $ajout = "`n" }
        $leg = $p.Legende.Replace('\', '\\').Replace('"', '\"')
        $ajout += $p.Fichier + ': "' + $leg + '"' + "`n"
        [System.IO.File]::AppendAllText($fichierLeg, $ajout, $utf8SansBom)
      }
    }
  } catch {
    Write-Host "  ECHEC $($p.Fichier) : $($_.Exception.Message)" -ForegroundColor Red
    $echecs++
  } finally {
    if (Test-Path $tmp) { Remove-Item $tmp -Force }
  }
}

Write-Host ''
foreach ($l in $logements.Keys) {
  $dp = Join-Path $logements[$l] 'photos'
  $couverture = $false
  if (Test-Path $dp) { $couverture = [bool](Get-ChildItem $dp | Where-Object { $_.Name -match '^01[-_.]' }) }
  if (-not $couverture) { Write-Host "Attention : « $l » n'a pas encore de photo de couverture 01-… (il reste masqué)." -ForegroundColor Yellow }
}
Write-Host ''
Write-Host "Bilan : $nouvelles photo(s) ajoutée(s), $deja déjà présente(s), $echecs en échec." -ForegroundColor Cyan
if ($nouvelles -gt 0) {
  Write-Host ''
  Write-Host 'Étape suivante : ouvrez GitHub Desktop. Les photos apparaissent dans « Changes ».'
  Write-Host 'Écrivez « Photos importées » dans « Summary », cliquez « Commit to main », puis « Push origin ».'
  Write-Host 'Le site se met à jour tout seul en quelques minutes.'
}
