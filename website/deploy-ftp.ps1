# Upload website/dist to InfinityFree htdocs via FTP.
# Usage:
#   $env:FTP_PASSWORD = 'your-password'
#   .\deploy-ftp.ps1
#
# Or: .\deploy-ftp.ps1 -Password 'your-password'

param(
  [string]$Password = $env:FTP_PASSWORD,
  [string]$HostName = 'ftpupload.net',
  [string]$UserName = 'if0_41247155',
  [string]$RemoteRoot = '/htdocs'
)

$ErrorActionPreference = 'Stop'
if (-not $Password) {
  throw 'Set FTP password: $env:FTP_PASSWORD = ''...'' or -Password'
}

$dist = Join-Path $PSScriptRoot 'dist'
if (-not (Test-Path $dist)) {
  throw "Missing $dist — run npm run build first"
}

function Ensure-RemoteDir([string]$ftpBase, [string]$credsUser, [string]$credsPass, [string]$remoteDir) {
  $uri = "$ftpBase$remoteDir"
  try {
    $req = [System.Net.FtpWebRequest]::Create($uri)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
    $req.Credentials = New-Object System.Net.NetworkCredential($credsUser, $credsPass)
    $req.UsePassive = $true
    $req.KeepAlive = $false
    $null = $req.GetResponse().Close()
  } catch {
    # Directory may already exist
  }
}

$ftpBase = "ftp://${HostName}"
$files = Get-ChildItem -Path $dist -Recurse -File
Write-Host "Uploading $($files.Count) files to $HostName$RemoteRoot ..."

foreach ($file in $files) {
  $relative = $file.FullName.Substring($dist.Length).Replace('\', '/')
  if (-not $relative.StartsWith('/')) { $relative = "/$relative" }
  $remotePath = "$RemoteRoot$relative"
  $remoteDir = Split-Path $remotePath -Parent
  if ($remoteDir -and $remoteDir -ne '/' -and $remoteDir -ne $RemoteRoot) {
    # create nested dirs one level at a time
    $parts = $remoteDir.Trim('/').Split('/')
    $acc = ''
    foreach ($p in $parts) {
      $acc += "/$p"
      Ensure-RemoteDir $ftpBase $UserName $Password $acc
    }
  }

  $uri = "$ftpBase$remotePath"
  Write-Host "  -> $remotePath ($([math]::Round($file.Length/1MB, 2)) MB)"
  $req = [System.Net.FtpWebRequest]::Create($uri)
  $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
  $req.Credentials = New-Object System.Net.NetworkCredential($UserName, $Password)
  $req.UseBinary = $true
  $req.UsePassive = $true
  $req.KeepAlive = $false
  $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
  $req.ContentLength = $bytes.Length
  $stream = $req.GetRequestStream()
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Close()
  $resp = $req.GetResponse()
  $resp.Close()
}

Write-Host "Done. Open http://lqit0jbd.infinityfree.com/"
