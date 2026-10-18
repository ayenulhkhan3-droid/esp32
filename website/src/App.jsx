import { useMemo } from 'react'
import './App.css'

const APP_VERSION = '1.4.2'
const GITHUB_URL = 'https://github.com/ayenulhkhan3-droid/esp32'
/** get-apk.php reads File Manager folder: /apk/DriveLink.apk */
const APK_PATH = 'https://esp32.digicopy.online/get-apk.php'
const APK_DIRECT = 'https://esp32.digicopy.online/apk/DriveLink.apk'

const features = [
  {
    title: 'Joystick drive',
    body: 'Hold a direction to move. Release and the car stops. Commands renew while you hold.',
  },
  {
    title: 'Offline voice',
    body: 'Open-source Vosk speech — no Google cloud. Say aage, ruko, spin, explore.',
  },
  {
    title: 'Firebase live link',
    body: 'Email login and Realtime Database. ESP32 reads the same car path instantly.',
  },
]

export default function App() {
  const year = useMemo(() => new Date().getFullYear(), [])

  return (
    <div className="page">
      <header className="top">
        <a className="brand" href="#top" id="top">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-text">DriveLink</span>
        </a>
        <nav className="nav">
          <a href="#features">Features</a>
          <a href="#install">Install</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-bg" aria-hidden="true">
            <img src="./car-hero.svg" alt="" className="hero-img" />
            <div className="hero-shade" />
          </div>

          <div className="hero-copy">
            <p className="eyebrow">ESP32 · 4WD · Android</p>
            <h1 className="logo-hero">DriveLink</h1>
            <p className="lead">
              Drive your ESP32 RC car from your phone — joystick or offline voice, linked through Firebase.
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" href={APK_PATH} download="DriveLink.apk">
                Download APK
                <span className="btn-meta">v{APP_VERSION} · ~74 MB</span>
              </a>
              <a className="btn btn-ghost" href="#install">
                How to install
              </a>
            </div>
            <p className="alt-dl">
              If download fails, use{' '}
              <a href={APK_DIRECT} download="DriveLink.apk">
                direct APK link
              </a>
              .
            </p>
          </div>
        </section>

        <section className="features" id="features">
          <h2>Built for the car</h2>
          <p className="section-lead">One job: get commands to the car safely and fast.</p>
          <ul className="feature-list">
            {features.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="install" id="install">
          <h2>Install on Android</h2>
          <p className="section-lead">Direct APK from esp32.digicopy.online — no Play Store.</p>
          <ol className="steps">
            <li>Tap <strong>Download APK</strong> (Chrome or Files).</li>
            <li>Open the file → allow install from this source if Android asks.</li>
            <li>Open DriveLink → sign in with your Firebase email.</li>
            <li>Allow microphone once for Voice mode (offline Vosk).</li>
          </ol>
          <div className="cta-row">
            <a className="btn btn-primary" href={APK_PATH} download="DriveLink.apk">
              Get DriveLink.apk
            </a>
            <a className="btn btn-ghost" href={APK_DIRECT} download="DriveLink.apk">
              Direct file
            </a>
          </div>
        </section>
      </main>

      <footer className="foot">
        <span>© {year} DriveLink · digicopy.online</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  )
}
