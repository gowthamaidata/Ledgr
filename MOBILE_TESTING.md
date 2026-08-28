# Ledgr — Local Dev + PWA Installation + Claude Mobile Testing Guide

## Quick Start (TL;DR)

```bash
# 1. Find your laptop's LAN IP
#    macOS/Linux:
ip route | grep default | awk '{print $9}' 2>/dev/null || ipconfig getifaddr en0
#    Windows: ipconfig | find "IPv4"

# 2. Start dev server (binds to all interfaces)
npm run dev

# 3. On your phone browser: http://<YOUR-LAN-IP>:5173
# 4. Install PWA from browser menu
```

---

## Part 1 — Run Ledgr Locally

### Requirements
- Node.js 18+
- npm 9+
- A `.env` file with Supabase credentials

### Setup

```bash
git clone <your-repo> ledgr
cd ledgr

# Create .env
cp .env.example .env
# Edit .env — add your Supabase URL and anon key

npm install
npm run dev
```

The server will print something like:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.42:5173/
```

The **Network** URL is what your phone needs.

---

## Part 2 — Access from Mobile on Same Wi-Fi

### On your phone:

1. Connect to the **same Wi-Fi network** as your laptop.
2. Open Chrome/Safari and go to `http://192.168.1.42:5173` (replace with your laptop's IP).
3. You should see Ledgr load normally.

### Firewall (if it doesn't load):

**macOS:**
```
System Settings → Network → Firewall → Options → Allow incoming connections for "node"
```

**Windows:**
```
Windows Defender Firewall → Allow app → find Node.js → check both Private and Public
```

**Linux:**
```bash
sudo ufw allow 5173/tcp
```

---

## Part 3 — Install as PWA on Mobile

### Android (Chrome)

1. Open `http://<laptop-ip>:5173` in Chrome.
2. After 3–4 seconds, a banner appears at the bottom: **"Install Ledgr"**.
3. Tap **Install App** — or use Chrome menu (⋮) → **Add to Home Screen**.
4. The app icon appears on your home screen.
5. Tap it — the app opens in standalone mode (no browser chrome).

### iOS (Safari) — required, Chrome won't prompt on iOS

1. Open `http://<laptop-ip>:5173` in **Safari** (not Chrome).
2. Tap the **Share** icon (square with arrow up) at the bottom.
3. Scroll down and tap **Add to Home Screen**.
4. Confirm by tapping **Add** in the top right.
5. App appears on home screen with the Ledgr gold L icon.

### Verify installation

After installing:
- Open the installed app — it should have no browser address bar.
- Check `Settings → Display mode` — should show "standalone".
- Close and reopen — your login session should persist.

---

## Part 4 — Claude Mobile Testing Architecture

### What Claude *can* do directly

| Capability | Available | Notes |
|---|---|---|
| Read + edit source code | ✅ | Full access to repo |
| Run dev server | ✅ | Via bash tool |
| Run Playwright tests against localhost | ✅ | Desktop browser automation |
| Inspect network requests | ✅ | Via dev tools in Playwright |
| Test mobile viewport emulation | ✅ | Playwright device emulation |
| Directly control a physical phone | ❌ | No hardware connection |
| Read phone screen | ❌ | No physical access |
| Touch/tap on physical phone | ❌ | No physical access |

### What requires external tooling

| Tool | Purpose | Setup effort |
|---|---|---|
| **Playwright** (recommended) | Browser automation on laptop with mobile emulation | Low — `npm i playwright` |
| **Chrome Remote Debugging** | Debug phone's Chrome from laptop DevTools | Medium |
| **Android Debug Bridge (ADB)** | Mirror phone screen, run shell commands | Medium (USB or Wi-Fi) |
| **Maestro** | Mobile UI testing, real device | High |
| **Appium** | Cross-platform mobile automation | High |

### Recommended architecture for this project

```
Claude Code (laptop)
  │
  ├── Runs Playwright tests
  │     └── Chromium with mobile emulation (Pixel 5, iPhone 12)
  │         └── Connects to http://localhost:5173
  │
  └── Optional: Chrome Remote Debug
        └── Phone Chrome → chrome://inspect on laptop
            → Claude can see the phone's DevTools
```

**The most practical approach:** Use Playwright with device emulation for the majority of testing (covers 90% of mobile bugs), plus manual verification on the physical device for touch-specific interactions.

---

## Part 5 — Chrome Remote Debugging (Physical Phone)

This lets you see and interact with the phone's browser from your laptop.

### Setup

**On the phone:**
1. Settings → About Phone → tap Build Number 7× → Developer Options enabled.
2. Developer Options → USB Debugging → ON.
3. Connect phone to laptop via USB cable.
4. Accept the "Allow USB debugging?" prompt on the phone.

**On the laptop:**
```bash
# Check ADB sees the device
adb devices
# Should list: emulator-5554   device (or similar)

# Forward port (optional — lets you use localhost on laptop = phone's app)
adb reverse tcp:5173 tcp:5173
```

**In Chrome on laptop:**
- Open `chrome://inspect/#devices`
- Your phone's Chrome tabs appear
- Click **inspect** to open DevTools for the phone's browser
- You can run JS in the Console, see network requests, inspect elements

### With ADB — remote control the phone screen

```bash
# Install scrcpy for phone screen mirror (macOS)
brew install scrcpy
scrcpy  # phone screen appears on laptop — you can click/tap with mouse

# Or use Android Studio's device manager
```

Once scrcpy is running, you can see the phone screen and click with your mouse — Claude can guide you through the test steps and you perform the actual taps.

---

## Part 6 — Playwright Test Suite

Install and run automated tests with mobile emulation:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Tests are in `tests/` — run with:

```bash
# All tests (mobile emulation)
npx playwright test

# With visible browser
npx playwright test --headed

# Specific test
npx playwright test tests/transactions.spec.js
```

---

## Part 7 — Environment Variables

Create `.env` in the project root:

```env
# Supabase (public keys only — safe for frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Never put service_role key in .env — server-side only
```

The `VITE_` prefix makes variables available in the browser bundle.

**Security:** The anon key is designed to be public. RLS policies on the database enforce all authorization. The service_role key is never in frontend code.

---

## Troubleshooting

**Phone can't reach the server:**
- Confirm both devices on same Wi-Fi.
- Try `ping <laptop-ip>` from a terminal app on Android.
- Check laptop firewall (see Part 2).
- Try `npm run dev` — look for the Network: URL in output.

**PWA install prompt doesn't appear:**
- Android: must be served from HTTPS in production (Vercel/Netlify auto-provides this). On local dev HTTP, the banner may be suppressed in some Chrome versions. Use `chrome://flags/#bypass-app-banner-engagement-checks` to force it during testing.
- iOS: install prompt never appears — always use Share → Add to Home Screen.

**Session not persisting after closing app:**
- Supabase persists auth tokens in localStorage, which survives app close.
- If it logs out, check that the Supabase URL and anon key are correct in `.env`.

**Service worker not updating after code changes:**
- In Chrome DevTools → Application → Service Workers → click "Update" or "Unregister".
- Or: `chrome://serviceworker-internals/` to manage all SWs.
