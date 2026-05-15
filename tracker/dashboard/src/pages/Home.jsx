import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()
  const playbackCanvasRef = useRef(null)
  const geoCanvasRef = useRef(null)
  const playbackMapRef = useRef(null)
  const geoMapRef = useRef(null)
  const geoAlertRef = useRef(null)

  useEffect(() => {
    setupPlayback()
    setupGeoFence()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setupPlayback() {
    const canvas = playbackCanvasRef.current
    const container = playbackMapRef.current
    if (!canvas || !container) return
    canvas.width = container.offsetWidth
    canvas.height = container.offsetHeight
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height

    const route = [
      [.12,.75],[.22,.60],[.35,.52],[.48,.58],[.58,.44],
      [.68,.50],[.75,.38],[.82,.44],[.88,.32]
    ]
    const toX = nx => nx * W
    const toY = ny => ny * H

    function drawMap() {
      ctx.fillStyle = '#e8efe8'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#d4e4d4'
      ctx.lineWidth = 0.5
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }
    }

    let progress = 0, dir = 1
    let rafId

    function draw() {
      drawMap()
      const total = route.length - 1
      const idx   = Math.floor(progress)
      const frac  = progress - idx

      ctx.strokeStyle = '#1D9E75'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(toX(route[0][0]), toY(route[0][1]))
      for (let i = 1; i <= idx; i++) ctx.lineTo(toX(route[i][0]), toY(route[i][1]))
      if (idx < total) {
        const x = toX(route[idx][0] + (route[idx+1][0]-route[idx][0])*frac)
        const y = toY(route[idx][1] + (route[idx+1][1]-route[idx][1])*frac)
        ctx.lineTo(x, y)
      }
      ctx.stroke()

      for (let i = 0; i <= Math.min(idx, total); i++) {
        const px = toX(route[i][0]), py = toY(route[i][1])
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI*2)
        ctx.fillStyle = '#fff'; ctx.fill()
        ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 1.5; ctx.stroke()
      }

      let cx2, cy2
      if (idx < total) {
        cx2 = toX(route[idx][0] + (route[idx+1][0]-route[idx][0])*frac)
        cy2 = toY(route[idx][1] + (route[idx+1][1]-route[idx][1])*frac)
      } else { cx2 = toX(route[total][0]); cy2 = toY(route[total][1]) }

      ctx.beginPath(); ctx.arc(cx2, cy2, 6, 0, Math.PI*2)
      ctx.fillStyle = '#1D9E75'; ctx.fill()
      ctx.beginPath(); ctx.arc(cx2, cy2, 3, 0, Math.PI*2)
      ctx.fillStyle = '#fff'; ctx.fill()
    }

    function tick() {
      progress += dir * 0.025
      if (progress >= route.length - 1) { progress = route.length - 1; dir = -1 }
      if (progress <= 0) { progress = 0; dir = 1 }
      draw()
      rafId = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(rafId)
  }

  function setupGeoFence() {
    const canvas = geoCanvasRef.current
    const container = geoMapRef.current
    const toast = geoAlertRef.current
    if (!canvas || !container || !toast) return
    canvas.width = container.offsetWidth
    canvas.height = container.offsetHeight
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height

    const cx = W * 0.42, cy = H * 0.52
    const r  = Math.min(W, H) * 0.3

    const path = []
    for (let t = 0; t <= 1; t += 0.005) {
      const angle = -0.3 + t * 1.6
      const dist  = r * 0.3 + t * r * 1.1
      path.push([cx + Math.cos(angle)*dist, cy + Math.sin(angle)*dist])
    }

    let pidx = 0, alertShown = false, dashOffset = 0
    let rafId2

    function drawMap() {
      ctx.fillStyle = '#e8efe8'; ctx.fillRect(0,0,W,H)
      ctx.strokeStyle = '#d4e4d4'; ctx.lineWidth = 0.5
      for (let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
      for (let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    }

    function draw() {
      drawMap()
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2)
      ctx.fillStyle = 'rgba(29,158,117,0.12)'; ctx.fill()

      ctx.save()
      ctx.setLineDash([8,5])
      ctx.lineDashOffset = -dashOffset
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2)
      ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()

      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.roundRect(cx-30, cy-r-18, 60, 16, 4); ctx.fill()
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.roundRect(cx-30, cy-r-18, 60, 16, 4); ctx.stroke()
      ctx.fillStyle = '#555'; ctx.font = '10px system-ui'
      ctx.textAlign = 'center'; ctx.fillText('Safe zone', cx, cy-r-6)
      ctx.textAlign = 'left'

      if (pidx > 1) {
        ctx.beginPath()
        ctx.moveTo(path[0][0], path[0][1])
        for (let i=1;i<=pidx;i++) ctx.lineTo(path[i][0], path[i][1])
        const outside = Math.hypot(path[pidx][0]-cx, path[pidx][1]-cy) > r
        ctx.strokeStyle = outside ? '#dc2626' : '#1D9E75'
        ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke()
      }

      const [dx,dy] = path[pidx]
      const outside = Math.hypot(dx-cx, dy-cy) > r
      ctx.beginPath(); ctx.arc(dx, dy, 6, 0, Math.PI*2)
      ctx.fillStyle = outside ? '#dc2626' : '#1D9E75'; ctx.fill()
      ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI*2)
      ctx.fillStyle = '#fff'; ctx.fill()

      if (outside && !alertShown) {
        alertShown = true
        toast.classList.add('show')
        setTimeout(() => { toast.classList.remove('show') }, 2000)
      }
    }

    function tick() {
      pidx++
      dashOffset += 0.3
      if (pidx >= path.length) { pidx = 0; alertShown = false }
      draw()
      rafId2 = requestAnimationFrame(() => setTimeout(tick, 16))
    }
    tick()
    return () => cancelAnimationFrame(rafId2)
  }

  function handleContactSubmit(e) {
    e.preventDefault()
    const btn = e.target.querySelector('.form-submit')
    btn.textContent = 'Sent ✓'; btn.style.background = '#178a63'; btn.disabled = true
    setTimeout(() => { btn.textContent = 'Send message'; btn.disabled = false; btn.style.background = '' }, 3000)
  }

  return (
    <>
      <style>{`
        .home-wrap *, .home-wrap *::before, .home-wrap *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .home-wrap { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f0ef; color: #111; -webkit-font-smoothing: antialiased; }
        .home-nav { background: #fff; border-bottom: 1px solid #ddd; padding: 0 28px; height: 56px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
        .home-logo { font-weight: 700; font-size: 17px; color: #111; display: flex; align-items: center; gap: 6px; }
        .home-logo-dot { width: 8px; height: 8px; background: #1D9E75; border-radius: 50%; }
        .home-nav a { color: #555; font-size: 14px; text-decoration: none; }
        .home-nav a:hover { color: #1D9E75; }
        .home-nav-links { display: flex; gap: 28px; }
        .home-btn { background: #1D9E75; color: #fff; border: none; border-radius: 8px; padding: 8px 18px; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; font-family: inherit; }
        .home-btn:hover { background: #178a63; }
        .home-btn-ghost { background: none; border: 1px solid #ddd; color: #333; border-radius: 8px; padding: 7px 16px; font-size: 14px; cursor: pointer; font-family: inherit; text-decoration: none; }
        .home-btn-ghost:hover { border-color: #1D9E75; color: #1D9E75; }
        .home-hero { max-width: 960px; margin: 0 auto; padding: 72px 24px 56px; text-align: center; }
        .home-hero-tag { display: inline-flex; align-items: center; gap: 7px; background: #e8f5f0; border: 1px solid #b2ddd0; color: #1D9E75; font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 20px; margin-bottom: 24px; }
        .home-hero-tag-dot { width: 6px; height: 6px; background: #1D9E75; border-radius: 50%; animation: home-pulse 2s infinite; }
        @keyframes home-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        .home-h1 { font-size: clamp(32px, 5vw, 52px); font-weight: 700; line-height: 1.1; letter-spacing: -1px; color: #111; margin-bottom: 20px; }
        .home-h1 span { color: #1D9E75; }
        .home-hero-sub { font-size: 17px; color: #555; max-width: 560px; margin: 0 auto 36px; line-height: 1.7; }
        .home-hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .home-features { max-width: 960px; margin: 0 auto; padding: 0 24px 72px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .home-feature-card { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 28px 24px; transition: box-shadow 0.2s; }
        .home-feature-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
        .home-feature-icon { font-size: 26px; margin-bottom: 14px; display: block; }
        .home-feature-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #111; }
        .home-feature-card p { font-size: 14px; color: #666; line-height: 1.65; }
        .home-demo-section { background: #fff; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 64px 24px; }
        .home-demo-inner { max-width: 960px; margin: 0 auto; }
        .home-demo-inner h2 { font-size: 26px; font-weight: 700; margin-bottom: 8px; color: #111; }
        .home-demo-inner > p { font-size: 15px; color: #666; margin-bottom: 36px; line-height: 1.6; }
        .home-demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .home-map-mock { border: 1px solid #ddd; border-radius: 12px; overflow: hidden; background: #e8efe8; position: relative; height: 260px; }
        .home-map-mock canvas { display: block; width: 100%; height: 100%; }
        .home-demo-label { position: absolute; top: 12px; left: 12px; background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 5px 10px; font-size: 12px; color: #555; }
        .home-requirements { max-width: 960px; margin: 0 auto; padding: 64px 24px; }
        .home-requirements h2 { font-size: 26px; font-weight: 700; margin-bottom: 8px; color: #111; }
        .home-requirements > p { font-size: 15px; color: #666; margin-bottom: 32px; }
        .home-req-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .home-req-card { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 24px; border-top: 3px solid #1D9E75; }
        .home-req-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 10px; color: #111; }
        .home-req-card p { font-size: 14px; color: #555; line-height: 1.65; }
        .home-req-card strong { color: #111; }
        .home-bios-note { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 10px; padding: 14px 20px; font-size: 13.5px; color: #555; line-height: 1.6; }
        .home-bios-note strong { color: #dc2626; }
        .home-contact-section { background: #fff; border-top: 1px solid #ddd; padding: 64px 24px; }
        .home-contact-inner { max-width: 520px; margin: 0 auto; text-align: center; }
        .home-contact-inner h2 { font-size: 26px; font-weight: 700; margin-bottom: 10px; }
        .home-contact-inner p { font-size: 15px; color: #666; margin-bottom: 32px; line-height: 1.6; }
        .home-form { text-align: left; display: flex; flex-direction: column; gap: 14px; }
        .home-form label { font-size: 13px; font-weight: 500; color: #333; display: block; margin-bottom: 4px; }
        .home-form input, .home-form textarea, .home-form select { width: 100%; padding: 9px 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; font-family: inherit; color: #111; background: #fff; outline: none; transition: border-color 0.15s; }
        .home-form input:focus, .home-form textarea:focus, .home-form select:focus { border-color: #1D9E75; }
        .home-form textarea { min-height: 100px; resize: vertical; }
        .home-form .form-submit { background: #1D9E75; color: #fff; border: none; border-radius: 8px; padding: 11px; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background 0.15s; width: 100%; }
        .home-form .form-submit:hover { background: #178a63; }
        .home-footer { border-top: 1px solid #ddd; padding: 20px 28px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #888; }
        .home-footer-logo { font-weight: 700; color: #111; font-size: 14px; }
        .home-alert-toast { position: absolute; bottom: 12px; right: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #dc2626; font-weight: 500; opacity: 0; transform: translateY(8px); transition: opacity 0.4s, transform 0.4s; }
        .home-alert-toast.show { opacity: 1; transform: translateY(0); }
        @media (max-width: 720px) {
          .home-features { grid-template-columns: 1fr; }
          .home-demo-grid { grid-template-columns: 1fr; }
          .home-req-grid { grid-template-columns: 1fr; }
          .home-nav-links { display: none; }
        }
      `}</style>

      <div className="home-wrap">
        {/* Nav */}
        <nav className="home-nav">
          <div className="home-logo"><div className="home-logo-dot"></div> Recoversoft</div>
          <div className="home-nav-links">
            <a href="#features">Features</a>
            <a href="#requirements">Requirements</a>
            <a href="#contact">Contact</a>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a href="recoversoft-brochure.pdf" download className="home-btn-ghost">Brochure</a>
            <button className="home-btn-ghost" onClick={() => navigate('/login')}>Log in</button>
            <a href="#contact" className="home-btn">Get Started</a>
          </div>
        </nav>

        {/* Hero */}
        <section className="home-hero">
          <div className="home-hero-tag"><div className="home-hero-tag-dot"></div> Silent background agent</div>
          <h1 className="home-h1">Tracks your laptops<br /><span>even when they're "off".</span></h1>
          <p className="home-hero-sub">
            Recoversoft runs in the background using cellular data — continuously sending location, even when the lid is closed and the user thinks the device is shut down.
          </p>
          <div className="home-hero-actions">
            <a href="#contact" className="home-btn">Get Started</a>
            <button className="home-btn-ghost" onClick={() => navigate('/login')}>Log in to Dashboard</button>
          </div>
        </section>

        {/* Features */}
        <div className="home-features" id="features">
          <div className="home-feature-card">
            <span className="home-feature-icon">📍</span>
            <h3>Location Playback</h3>
            <p>Replay the exact route a device took — every stop, every movement — plotted on a map with timestamps.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">🔔</span>
            <h3>Geo-fencing</h3>
            <p>Draw a safe zone on the map. Get an instant alert the moment a device crosses the boundary.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">🔋</span>
            <h3>Battery Management</h3>
            <p>When battery is critically low, an overlay discourages shutdown — keeping the device trackable for longer.</p>
          </div>
        </div>

        {/* Demo */}
        <section className="home-demo-section">
          <div className="home-demo-inner">
            <h2>See it in action</h2>
            <p>Location playback and geo-fencing — visualised live.</p>
            <div className="home-demo-grid">
              <div className="home-map-mock" ref={playbackMapRef}>
                <canvas ref={playbackCanvasRef}></canvas>
                <div className="home-demo-label">▶ Location playback</div>
              </div>
              <div className="home-map-mock" ref={geoMapRef}>
                <canvas ref={geoCanvasRef}></canvas>
                <div className="home-demo-label">🔔 Geo-fencing</div>
                <div className="home-alert-toast" ref={geoAlertRef}>⚠ Device left safe zone</div>
              </div>
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="home-requirements" id="requirements">
          <h2>Device Requirements</h2>
          <p>Two things your laptops must have for Recoversoft to work.</p>
          <div className="home-req-grid">
            <div className="home-req-card">
              <h3>📡 Cellular Connection</h3>
              <p>The laptop must have a <strong>built-in cellular modem (LTE/4G/5G)</strong> with an <strong>active SIM card and mobile data plan</strong>. This is what keeps tracking alive when the device is off WiFi or taken off-premises.</p>
            </div>
            <div className="home-req-card">
              <h3>💻 Power on Lid Open</h3>
              <p>The BIOS must be configured to <strong>power on automatically when the lid is opened</strong>. Without this, the device stays off after being closed and tracking stops. Enable it under BIOS → Power Management.</p>
            </div>
          </div>
          <div className="home-bios-note">
            <strong>⚠ BIOS setting:</strong> Go to BIOS → Power Management → "Power on by Open Lid" → <strong>Enabled</strong>. This is the most important setting and must be done on every device before deployment.
          </div>
        </section>

        {/* Contact */}
        <section className="home-contact-section" id="contact">
          <div className="home-contact-inner">
            <h2>Get in touch</h2>
            <p>Ready to protect your devices? We'll walk you through setup — whether you have 5 laptops or 500.</p>
            <form className="home-form" onSubmit={handleContactSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label>First name</label><input type="text" required placeholder="John" /></div>
                <div><label>Last name</label><input type="text" required placeholder="Smith" /></div>
              </div>
              <div><label>Email</label><input type="email" required placeholder="john@company.com" /></div>
              <div><label>Company</label><input type="text" placeholder="Acme Corp" /></div>
              <div>
                <label>Number of devices</label>
                <select>
                  <option>1 – 10</option><option>11 – 50</option>
                  <option>51 – 200</option><option>200+</option>
                </select>
              </div>
              <div><label>Message</label><textarea placeholder="Tell us about your setup…"></textarea></div>
              <button type="submit" className="form-submit">Send message</button>
            </form>
          </div>
        </section>

        {/* Footer */}
        <footer className="home-footer">
          <div className="home-footer-logo">Recoversoft</div>
          <span>© 2026 Recoversoft</span>
        </footer>
      </div>
    </>
  )
}
