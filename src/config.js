// Centralized API base for frontend
// Development default is a root-relative URL so `/api` requests are proxied by Vite
// (works from other LAN machines because proxy runs on the dev host).
//
// Overrides:
// - Dev: set `VITE_DEV_API_BASE` if you really want to bypass proxy.
// - Prod build: set `VITE_API_BASE` if backend is on a different origin.
const DEFAULT_LOCAL_API = import.meta.env.DEV
	? (import.meta.env.VITE_DEV_API_BASE || '')
	: (import.meta.env.VITE_API_BASE || '');
let _apiBase = DEFAULT_LOCAL_API;

export const API_BASE = _apiBase;

// UI settings
export const SPINNER_TEXT = (window && window.__SPINNER_TEXT__) || 'កំពុងរង់ចាំ...';
// Default color equals Tailwind blue-600 (#2563eb)
export const SPINNER_COLOR = (window && window.__SPINNER_COLOR__) || '#2563eb';

// Provide a default export for compatibility with imports using default
// Provide a default export for compatibility with imports using default
export default API_BASE;
