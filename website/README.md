# DriveLink download site

React + Vite landing page for the DriveLink Android APK.

**Live:** https://esp32.digicopy.online/

## Develop

```powershell
npm install
npm run dev
```

## Build

```powershell
Copy-Item ..\rc-car-app\android\app\build\outputs\apk\release\app-release.apk public\downloads\DriveLink.apk -Force
npm run build
```

## Deploy (Hostinger / digicopy)

```powershell
$env:FTP_PASSWORD = 'YOUR_FTP_PASSWORD'
.\deploy-ftp.ps1
```

Defaults:
- Host: `217.21.84.244`
- User: `u811482530`
- Remote: `/domains/esp32.digicopy.online/public_html`

Do not commit the FTP password.
