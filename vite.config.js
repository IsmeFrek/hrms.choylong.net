import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readIfExists(p) {
  try {
    if (!p) return null;
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

function readBackendRuntimePort() {
  try {
    const p = path.resolve(__dirname, 'backend', '.runtime-port');
    if (!fs.existsSync(p)) return null;
    const raw = String(fs.readFileSync(p, 'utf8') || '').trim();
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

// If you set VITE_HTTP=1, dev server will use HTTP (useful with ngrok, which provides HTTPS).
const forceHttp = String(process.env.VITE_HTTP || '').trim() === '1';

// If cert/key exist, Vite will use them (best way to remove "Not secure" on phones once the CA is trusted).
const defaultCertPath = path.resolve(__dirname, 'certs', 'dev.crt');
const defaultKeyPath = path.resolve(__dirname, 'certs', 'dev.key');
const certPath = process.env.VITE_SSL_CERT || defaultCertPath;
const keyPath = process.env.VITE_SSL_KEY || defaultKeyPath;
const cert = readIfExists(certPath);
const key = readIfExists(keyPath);
const httpsConfig = forceHttp ? false : (cert && key ? { cert, key } : true);
const useBasicSsl = httpsConfig === true;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ...(useBasicSsl ? [basicSsl()] : [])],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: true,
    https: httpsConfig,
    // Needed if you access dev server via ngrok or other external hostnames.
    allowedHosts: true,
    open: false,
    proxy: {
      '/api': {
        // Allow overriding backend port/url when 5000 is occupied.
        // Examples:
        // - PowerShell: $env:BACKEND_PORT='5001'; npm run dev
        // - Or: $env:BACKEND_URL='http://localhost:5001'; npm run dev
        target: process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || readBackendRuntimePort() || '5000'}`,
        changeOrigin: true,
      },
      // Rewrite legacy frontend requests that include an extra `/api` prefix
      // so they map to backend routes mounted at `/kshf_hospital_app` and `/Uploads`.
      '/api/kshf_hospital_app': {
        target: process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || readBackendRuntimePort() || '5000'}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api/Uploads': {
        target: process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || readBackendRuntimePort() || '5000'}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Proxy legacy backend namespace used by the frontend
      '/kshf_hospital_app': {
        target: process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || readBackendRuntimePort() || '5000'}`,
        changeOrigin: true,
        secure: false,
      },
      // Proxy static uploads so <img src="/Uploads/..."> works in dev
      '/Uploads': {
        target: process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || readBackendRuntimePort() || '5000'}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
})
