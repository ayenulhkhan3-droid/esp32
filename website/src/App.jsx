import { useMemo } from 'react'
import './App.css'

const APP_VERSION = '1.4.1'
const GITHUB_URL = 'https://github.com/ayenulhkhan3-droid/esp32'
/** Hosted on GitHub Releases (InfinityFree free tier is too small for ~74 MB APK). */
const APK_PATH =
  'https://github.com/ayenulhkhan3-droid/esp32/releases/download/v1.4.1/DriveLink.apk'

const features = [
  {
    title: 'Joystick drive',
    body: 'Hold a direction to move. Release and the car stops. Commands renew while you hold.',
  },
  {
    title: 'Offline voice',
    body: 'Open-source Vosk speech — no Google Speech, no cloud STT. Say aage, ruko, spin, explore.',
  },
  {
    title: 'Firebase live link',
    body: 'Email login and Realtime Database. No PHP backend. ESP32 reads the same car path.',
  },
]

export default function App() {
  const year = useMemo(() => new Date().getFullYear(), [])

  return (
    <div className="page">
      <div className="glow glow-a" aria-hidden="true" />
      <div className="glow glow-b" aria-hidden="true" />

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
          <p className="eyebrow">ESP32 · 4WD · Android</p>
          <h1 className="logo-hero">DriveLink</h1>
          <p className="lead">
            Drive your ESP32 RC car from your phone — joystick or offline voice, linked through Firebase.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href={APK_PATH}>
              Download APK
              <span className="btn-meta">v{APP_VERSION}</span>
            </a>
            <a className="btn btn-ghost" href="#install">
              How to install
            </a>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="phone">
              <div className="phone-screen">
                <div className="pad" />
                <div className="mic" />
                <div className="stop" />
              </div>
            </div>
          </div>
        </section>

        <section className="features" id="features">
          <h2>Built for the car, not a dashboard</h2>
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
          <p className="section-lead">Direct APK — no Play Store required.</p>
          <ol className="steps">
            <li>Tap <strong>Download APK</strong> on this page (Chrome / Files).</li>
            <li>Open the file → allow install from this source if Android asks.</li>
            <li>Open DriveLink → sign in with your Firebase email.</li>
            <li>Allow microphone once if you use Voice mode (offline Vosk).</li>
          </ol>
          <a className="btn btn-primary" href={APK_PATH}>
            Get DriveLink.apk
          </a>
        </section>
      </main>

      <footer className="foot">
        <span>© {year} DriveLink</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  )
}
