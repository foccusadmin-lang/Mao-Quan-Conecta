import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { flush, salvarRetomada } from './lib/db';

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

// Atualização automática, sem tirar o usuário da tela em que está:
// - a versão nova é baixada e fica guardada; só é aplicada quando o app vai para segundo plano
//   (troca de aba, celular bloqueado, app minimizado) — ninguém vê a troca;
// - antes, grava o pendente e guarda sessão + dados, então a tela volta igual, na mesma página e sem "Conectando…";
// - nunca aplica com campo em edição, janela aberta ou envio em andamento.
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
    if (!pendente || atualizando || document.visibilityState !== 'hidden' || !seguro()) return;
    atualizando = true;
    try {
      await Promise.race([flush(), new Promise((r) => setTimeout(r, 3000))]);
    } catch {}
    salvarRetomada();
    location.reload();
  };

  const verificar = async () => {
    if (!atual || pendente) return;
    try {
      const nova = achar(await (await fetch('./index.html', { cache: 'no-store' })).text());
      if (nova && nova !== atual) {
        pendente = true;
        // Baixa a versão nova já agora, para a troca ser instantânea
        fetch('./' + nova).catch(() => {});
      }
    } catch {}
  };

  setInterval(verificar, 2 * 60 * 1000);
  window.addEventListener('focus', verificar);
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? aplicar() : verificar()));
}
