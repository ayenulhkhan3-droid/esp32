# DriveLink download site

React + Vite landing page for the DriveLink Android APK.

## Develop

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

Output: `dist/` (includes `downloads/DriveLink.apk` when present).

Copy a release APK before build:

```powershell
Copy-Item ..\rc-car-app\android\app\build\outputs\apk\release\app-release.apk public\downloads\DriveLink.apk -Force
npm run build
```

## Deploy (InfinityFree)

Host: `ftpupload.net` · User: `if0_41247155` · Remote folder: `/htdocs`  
Site: http://lqit0jbd.infinityfree.com/

```powershell
$env:FTP_PASSWORD = 'YOUR_FTP_PASSWORD'
.\deploy-ftp.ps1
```

Do not commit the FTP password.
