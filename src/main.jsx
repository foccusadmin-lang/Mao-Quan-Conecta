import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { flush } from './lib/db';

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

// Atualização automática: o app costuma ficar aberto (ou instalado) por dias sem recarregar.
// Ao detectar versão nova, grava o que estiver pendente e recarrega na MESMA tela (a rota fica no endereço),
// só em momento seguro: sem campo sendo digitado, sem janela/modal aberta e sem envio em andamento.
if (import.meta.env.PROD) {
  const achar = (txt) => txt.match(/assets\/index-[\w-]+\.js/)?.[0];
  const atual = [...document.scripts].map((s) => achar(s.src || '')).find(Boolean);
  let pendente = false;
  let atualizando = false;

  const seguro = () => {
    const el = document.activeElement;
    const digitando = el && (el.matches?.('input, textarea, select') || el.isContentEditable);
    const modalAberto = !!document.querySelector('.modal-back');
    const enviando = !!document.querySelector('button[disabled]') && /Enviando|Salvando|Ativando/.test(document.body.innerText);
    return !digitando && !modalAberto && !enviando;
  };

  const aplicar = async () => {
    if (!pendente || atualizando || !seguro()) return;
    atualizando = true;
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:10000;background:#141414;color:#fff;padding:10px 16px;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:600 14px Inter,system-ui,sans-serif';
    el.textContent = '✨ Atualizando o app…';
    document.body.appendChild(el);
    try {

      await Promise.race([flush(), new Promise((r) => setTimeout(r, 4000))]);
    } catch {}
    location.reload();
  };

  const verificar = async () => {
    if (!atual || document.visibilityState === 'hidden') return;
    if (pendente) return aplicar();
    try {
      const nova = achar(await (await fetch('./index.html', { cache: 'no-store' })).text());
      if (nova && nova !== atual) {
        pendente = true;
        aplicar();
      }
    } catch {}
  };

  setInterval(verificar, 2 * 60 * 1000);
  setInterval(() => pendente && aplicar(), 15 * 1000); // tenta de novo quando o usuário terminar o que está fazendo
  document.addEventListener('visibilitychange', verificar);
  window.addEventListener('focus', verificar);
  window.addEventListener('hashchange', () => pendente && setTimeout(aplicar, 300)); // troca de tela é um bom momento
}
