import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Aviso de nova versão: o app costuma ficar aberto (ou instalado) por dias sem recarregar
if (import.meta.env.PROD) {
  const achar = (txt) => txt.match(/assets\/index-[\w-]+\.js/)?.[0];
  const atual = [...document.scripts].map((s) => achar(s.src || '')).find(Boolean);
  let avisado = false;
  const mostrarAviso = () => {
    avisado = true;
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:10000;background:#141414;color:#fff;padding:10px 12px 10px 16px;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.3);display:flex;gap:12px;align-items:center;font:600 14px Inter,system-ui,sans-serif;max-width:calc(100% - 32px)';
    el.innerHTML = '<span>✨ Nova versão do app disponível</span>';
    const b = document.createElement('button');
    b.textContent = 'Atualizar';
    b.style.cssText = 'background:#d0121b;color:#fff;border:0;border-radius:10px;padding:8px 14px;font:700 14px Inter,system-ui,sans-serif;cursor:pointer';
    b.onclick = () => location.reload();
    el.appendChild(b);
    document.body.appendChild(el);
  };
  const verificar = async () => {
    if (avisado || !atual || document.visibilityState === 'hidden') return;
    try {
      const nova = achar(await (await fetch('./index.html', { cache: 'no-store' })).text());
      if (nova && nova !== atual) mostrarAviso();
    } catch {}
  };
  setInterval(verificar, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', verificar);
  window.addEventListener('focus', verificar);
}
