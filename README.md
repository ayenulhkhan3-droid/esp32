# DriveLink — ESP32 4WD RC Car Controller

Android app (**React Native / Expo 57 / TypeScript**) that drives car `car001` through
**Firebase Auth + Realtime Database**. Login is email/password only (no Google Sign-In).
Control modes: **Joystick** and **Voice** (offline open-source **Vosk** — no Google Speech).

| Piece | Path |
|---|---|
| Android app | `rc-car-app/` |
| Download website (React + Vite) | `website/` |
| Firebase rules / setup notes | `FIREBASE_SETUP.txt` |

**Live download site:** [http://lqit0jbd.infinityfree.com](http://lqit0jbd.infinityfree.com)  
**APK (v1.4.1):** [GitHub Release download](https://github.com/ayenulhkhan3-droid/esp32/releases/download/v1.4.1/DriveLink.apk)  
**Source:** [github.com/ayenulhkhan3-droid/esp32](https://github.com/ayenulhkhan3-droid/esp32)

```
Phone (DriveLink) ──Firebase Auth──► Realtime Database cars/car001
ESP32 firmware    ──poll / listen──► same path (command + expires_at_ms)
```

The old PHP API (`api.digicopy.online/esp32.php`) is **not** used anymore.
ESP32 must read Firebase (or the REST API for that database), or the car will not move.

---

## App features

- **Email login** — Firebase Auth; intended account `ayenulhkhan3@gmail.com` (RTDB rules lock writes to that email).
- **Joystick** — hold to move; release / background / logout / offline → Stop.
- **Voice** — on-device Vosk model `model-en-in` (English + Hinglish phrases: aage, peeche, ruko, spin, explore…).
- **Spin / Explore** — spin in place; explore is written for firmware obstacle avoidance.
- **Safety** — single-flight writes, Stop preempts movement, renew while held, long TTL so status UI does not flicker on fast RTDB.

Package id: `online.digicopy.drivelink` · App version **1.4.1** (versionCode 7).

---

## Project layout

```
rc-car-app/
  App.tsx
  src/config/firebase.ts      Firebase web config + car path
  src/config/api.ts           Timing (renew / heartbeat)
  src/services/auth.ts        Email/password Auth
  src/services/api.ts         RTDB set / get / voice match write
  src/services/speech.ts      Offline Vosk (react-native-vosk)
  src/services/commandController.ts
  src/screens/LoginScreen.tsx, ControlScreen.tsx
  assets/model-en-in/         Vosk speech model (bundled)
website/
  src/App.jsx                 Landing + APK download
  public/downloads/DriveLink.apk
FIREBASE_SETUP.txt            Console steps + RTDB rules
```

---

## Firebase setup

See **`FIREBASE_SETUP.txt`**. Short version:

1. Enable **Email/Password** in Authentication (Google Sign-In is not required).
2. Create **Realtime Database**, publish rules that allow only your email on `cars/car001`.
3. Put config values in `rc-car-app/src/config/firebase.ts`.
4. Point ESP32 firmware at the same database path / REST URL.

Example rules (publish in Console → Realtime Database → Rules):

```json
{
  "rules": {
    "cars": {
      "car001": {
        ".read": "auth != null && auth.token.email == 'ayenulhkhan3@gmail.com'",
        ".write": "auth != null && auth.token.email == 'ayenulhkhan3@gmail.com'"
      }
    }
  }
}
```

ESP32 typically needs a broader `.read` (device key / open read on that node only) if it cannot use end-user Auth — adjust carefully for your firmware.

### RTDB payload (`cars/car001`)

| Field | Meaning |
|---|---|
| `command` | `stop` \| `forward` \| `backward` \| `left` \| `right` \| `spin` \| `explore` |
| `mode` | `joystick` \| `voice` |
| `command_id` | unique id per write |
| `command_expires_at` | UTC string |
| `expires_at_ms` | unix ms — treat expired as stop |
| `source` | `app` \| `voice` |
| `updated_by` / `updated_at` | uid + timestamp |

---

## Build the Android APK

Prerequisites: Node 20+, JDK 17, Android SDK (`ANDROID_HOME`), short Gradle home if Windows paths are long:

```powershell
cd rc-car-app
npm install
$env:GRADLE_USER_HOME = "C:\g"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleRelease
```

APK output (typical):

`rc-car-app/android/app/build/outputs/apk/release/app-release.apk`

Copy it to the website before deploying:

```powershell
Copy-Item .\android\app\build\outputs\apk\release\app-release.apk ..\website\public\downloads\DriveLink.apk -Force
```

Wireless install example:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r path\to\DriveLink.apk
```

---

## Download website

React (Vite) landing page that hosts the APK.

```powershell
cd website
npm install
npm run build
```

Static files land in `website/dist/`. Upload the **contents** of `dist/` (including `downloads/DriveLink.apk`) to InfinityFree **`htdocs/`** via FTP (`ftpupload.net`).

Local preview: `npm run dev` inside `website/`.

---

## Safety behaviour

- Joystick release, mode switch, background, logout, unmount, lost internet, and failed movement all request **Stop**.
- Held movement renews every **2.5 s**; TTL is several renews ahead so mid-drive RTDB reads do not look like stop.
- Only one write in flight; Stop is sent immediately and re-sent if a late movement reply arrives after it.
- Voice `none` never moves the car.
- Firmware should also stop on expiry, poll gap, or Wi-Fi loss.

---

## Voice (Vosk)

- Model path configured as `assets/model-en-in` (plugin `react-native-vosk`).
- No Google Speech / cloud STT / paid API.
- Grammar includes English + common Hinglish command words.

---

## License / notes

Private project for Digicopy / personal ESP32 car use. Do not commit keystore passwords or FTP passwords.
