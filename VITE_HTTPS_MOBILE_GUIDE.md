# Vite HTTPS on Mobile (Camera Fix)

If your phone shows **“Not secure”** (like the screenshot) and the camera won’t work, it’s usually because the HTTPS certificate is **self‑signed / not trusted**.

> Important: You cannot remove “Not secure” by Vite config alone.
> You must use a **trusted certificate** (or use a public HTTPS URL like ngrok).

## Option A (Recommended): Use ngrok (always shows Secure)
This is the easiest way to make the phone happy because ngrok gives you a real public HTTPS URL.

1) Run Vite in HTTP mode locally (ngrok will provide HTTPS)
- PowerShell:
  - `$env:VITE_HTTP='1'`
  - `npm run dev`
  - Or: `npm run dev:http`

2) Start ngrok for the Vite port (5173):
- `ngrok http 5173`
  - Or: `npm run tunnel:vite`
  - Or: run `start-mobile-ngrok.bat`

3) Open the **https://…ngrok…** URL on the phone.

Notes:
- [vite.config.js](vite.config.js) already sets `server.allowedHosts: true` so ngrok hostnames are allowed.
- Camera will work because the page origin is HTTPS.

## Option B: Use a trusted local certificate (shows Secure on LAN)
This gives you a green/normal secure indicator on the LAN URL like `https://192.168.x.x:5173`.

### 1) Generate a cert (mkcert)
On Windows, install mkcert, then generate a cert for your PC name + LAN IP.

Example (run in repo root):
- `mkcert -install`
- `mkdir certs`
- `mkcert -key-file certs/dev.key -cert-file certs/dev.crt localhost 127.0.0.1 192.168.8.108`

### 2) Trust the CA on the phone
You must install & trust the mkcert root CA on the phone.
- The root CA is typically in: `%LOCALAPPDATA%\mkcert\rootCA.pem`
- Copy it to the phone and install it as a **CA certificate**.

### 3) Start Vite (HTTPS)
- `npm run dev`

Vite will automatically use:
- `certs/dev.crt`
- `certs/dev.key`

because [vite.config.js](vite.config.js) reads them if present.

## Quick check
On the phone open:
- `https://<YOUR_LAN_IP>:5173/mobileApp`

If it still shows “Not secure”, it means the certificate is still not trusted on that phone (or hostname/IP doesn’t match the certificate).

## Option C: Force HTTP (avoid red HTTPS warning)
If your phone shows a **red** warning because of an untrusted/self-signed HTTPS cert, you can run Vite on plain HTTP:
- `npm run dev:http`

This avoids the HTTPS certificate warning because it no longer uses HTTPS.

Important camera note:
- Most mobile browsers require a **secure context** for camera (`getUserMedia`).
- `http://192.168.x.x` may NOT allow camera on iPhone/Safari and many Android browsers.
- If camera is blocked on HTTP, use **Option A (ngrok HTTPS)** or **Option B (mkcert trusted HTTPS)**.

## Face verification note (Tracking Prevention)
If you saw console logs like:
- `Tracking Prevention blocked access to storage for https://unpkg.com/face-api.js...`

This repo now loads face-api assets through same-origin proxy endpoints:
- `/api/vendor/face-api.min.js`
- `/api/vendor/face-models/<file>`

So it works even when the browser blocks third-party storage.

If your backend is not on port 5000 (e.g. it auto-switches to 5001), set:
- `BACKEND_PORT=5001` (PowerShell: `$env:BACKEND_PORT='5001'`) before starting Vite.
