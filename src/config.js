const STORAGE_KEY = 'vertex-ws-url';

const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const onHttps = location.protocol === 'https:';

const DEFAULT_URL = import.meta.env.VITE_WS_URL
  || (local ? 'ws://localhost:8765' : 'wss://vertex-fps-server.onrender.com');

export function getWsUrl() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
}

export function setWsUrl(url) {
  const trimmed = url.trim();
  if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
  else localStorage.removeItem(STORAGE_KEY);
}

export function validateWsUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return 'Server URL is required';
  if (!trimmed.startsWith('ws://') && !trimmed.startsWith('wss://')) {
    return 'URL must start with ws:// or wss://';
  }
  if (onHttps && trimmed.startsWith('ws://')) {
    return 'HTTPS pages require wss:// (secure WebSocket). Deploy the server or use wss://.';
  }
  return null;
}

export function defaultWsUrl() {
  return DEFAULT_URL;
}

export { onHttps, local };
