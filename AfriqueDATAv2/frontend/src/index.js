import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './theme/bootstrap-custom.scss';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import reportWebVitals from './reportWebVitals';

// Après un déploiement, un onglet peut référencer d’anciens chunks : un seul rechargement rapide (évite boucle).
const CHUNK_RELOAD_TS = 'smartgestion_chunk_reload_ts';
function isChunkLoadFailure(msg) {
  if (!msg || typeof msg !== 'string') return false;
  return /Loading chunk [\w.-]+ failed/i.test(msg) || /ChunkLoadError/i.test(msg);
}
function reloadOnceForStaleChunks() {
  const now = Date.now();
  const prev = parseInt(sessionStorage.getItem(CHUNK_RELOAD_TS) || '0', 10);
  if (now - prev < 8000) return;
  sessionStorage.setItem(CHUNK_RELOAD_TS, String(now));
  window.location.reload();
}
window.addEventListener('error', (e) => {
  if (isChunkLoadFailure(e.message)) reloadOnceForStaleChunks();
});
window.addEventListener('unhandledrejection', (e) => {
  const m = e.reason?.message || String(e.reason || '');
  if (isChunkLoadFailure(m)) {
    e.preventDefault();
    reloadOnceForStaleChunks();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

reportWebVitals();
