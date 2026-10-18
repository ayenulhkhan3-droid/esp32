# Upload website/dist to Hostinger path for esp32.digicopy.online
param(
  [string]$Password = $env:FTP_PASSWORD,
  [string]$HostName = '217.21.84.244',
  [string]$UserName = 'u811482530',
  [int]$Port = 21,
  [string]$RemoteRoot = '/domains/esp32.digicopy.online/public_html'
)

$ErrorActionPreference = 'Stop'
if (-not $Password) {
  throw 'Set FTP password via $env:FTP_PASSWORD or -Password'
}

$dist = Join-Path $PSScriptRoot 'dist'
if (-not (Test-Path $dist)) {
  throw 'Missing dist folder. Run npm run build first.'
}

function Ensure-RemoteDir([string]$user, [string]$pass, [string]$hostName, [string]$remoteDir) {
  $uri = "ftp://${hostName}${remoteDir}"
  try {
    $req = [System.Net.FtpWebRequest]::Create($uri)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
    $req.Credentials = New-Object System.Net.NetworkCredential($user, $pass)
    $req.UsePassive = $true
    $req.KeepAlive = $false
    $null = $req.GetResponse().Close()
  } catch {
    # exists
  }
}

$files = Get-ChildItem -Path $dist -Recurse -File
Write-Host ("Uploading {0} files to {1}{2} as {3}" -f $files.Count, $HostName, $RemoteRoot, $UserName)

foreach ($file in $files) {
  $relative = $file.FullName.Substring($dist.Length).Replace('\', '/')
  if (-not $relative.StartsWith('/')) { $relative = "/$relative" }
  $remotePath = "$RemoteRoot$relative"
  $remoteDir = ($remotePath -replace '\\', '/')
  $remoteDir = Split-Path $remoteDir -Parent
  if ($remoteDir) {
    $parts = $remoteDir.Trim('/').Split('/')
    $acc = ''
    foreach ($p in $parts) {
      $acc += "/$p"
      Ensure-RemoteDir $UserName $Password $HostName $acc
    }
  }

  $uri = "ftp://${HostName}${remotePath}"
  $mb = [math]::Round($file.Length / 1MB, 2)
  Write-Host ("  -> {0} ({1} MB)" -f $remotePath, $mb)

  # Stream upload via curl for reliability on large APK
  & curl.exe -sS --ftp-create-dirs --user "${UserName}:${Password}" -T $file.FullName $uri --connect-timeout 30
  if ($LASTEXITCODE -ne 0) {
    throw "Upload failed for $remotePath (exit $LASTEXITCODE)"
  }
}

Write-Host 'Done. Open https://esp32.digicopy.online/'
