import { useEffect, useState, useSyncExternalStore } from 'react';
import { initials, readImage } from '../lib/utils';
import { useDB } from '../lib/db';

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '', ...rest }) {
  return (
    <div className={'card ' + className} {...rest}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, icon, tone = 'red', hint }) {
  return (
    <div className={`card stat ${tone}`}>
      <div className="i">{icon}</div>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {hint && <div className="xs muted" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide, glass }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''} ${glass ? 'glass' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-h">
          <h3>{title}</h3>
          <button className={`btn icon ${glass ? 'dark' : 'ghost'}`} onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, style }) {
  return (
    <label className="field" style={style}>
      {label}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

/** Input controlado ligado a um objeto: <Inp obj={f} set={setF} k="nome" /> */
export function Inp({ obj, set, k, type = 'text', mask, ...rest }) {
  const v = k.split('.').reduce((o, p) => o?.[p], obj);
  const onChange = (e) => {
    let val = type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : type === 'checkbox' ? e.target.checked : e.target.value;
    if (mask) val = mask(val);
    set((prev) => {
      const next = structuredClone(prev);
      const parts = k.split('.');
      let o = next;
      parts.slice(0, -1).forEach((p) => (o = o[p] ||= {}));
      o[parts.at(-1)] = val;
      return next;
    });
  };
  if (type === 'textarea') return <textarea value={v ?? ''} onChange={onChange} {...rest} />;
  if (type === 'checkbox') return <input type="checkbox" checked={!!v} onChange={onChange} {...rest} />;
  return <input type={type} value={v ?? ''} onChange={onChange} {...rest} />;
}

export function Avatar({ src, name, size = '' }) {
  if (src) return <img className={`avatar ${size}`} src={src} alt={name} />;
  return <span className={`avatar ${size}`}>{initials(name)}</span>;
}

export function PhotoInput({ value, onChange, name }) {
  return (
    <div className="row">
      <Avatar src={value} name={name} size="lg" />
      <div className="col" style={{ gap: 6 }}>
        <label className="btn ghost sm">
          📷 Enviar foto
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) onChange(await readImage(f, 500));
              e.target.value = '';
            }}
          />
        </label>
        {value && <button type="button" className="btn link sm" onClick={() => onChange(null)}>Remover</button>}
      </div>
    </div>
  );
}

/** Desenho da faixa: cor principal, ponta colorida e bordado (hanzi) nas faixas pretas */
export const faixaFundo = (f) => {
  if (f.hanzi) return `linear-gradient(90deg, ${f.cor} 38%, ${f.hanzi} 38% 62%, ${f.cor} 62%)`;
  if (f.ponta) return `linear-gradient(90deg, ${f.cor} 72%, ${f.ponta} 72%)`;
  return f.cor;
};

export function Faixa({ idx, nivel }) {
  const db = useDB();
  const f = db.config.faixas[idx];
  if (!f) return <span className="muted">—</span>;
  return (
    <span className="faixa" title={`${f.nivel ? f.nivel + ' · ' : ''}${f.nome}`}>
      <i style={{ background: faixaFundo(f) }} />
      {f.nome}
      {nivel && f.nivel && <em className="xs muted" style={{ fontStyle: 'normal', fontWeight: 500 }}>· {f.nivel}</em>}
    </span>
  );
}

/** <option>s das graduações agrupadas por nível */
export function FaixaOptions() {
  const db = useDB();
  const grupos = [];
  db.config.faixas.forEach((f, i) => {
    const g = f.nivel || 'Outras';
    let gr = grupos.find((x) => x.nome === g);
    if (!gr) grupos.push((gr = { nome: g, itens: [] }));
    gr.itens.push([i, f]);
  });
  return grupos.map((g) => (
    <optgroup key={g.nome} label={g.nome.toUpperCase()}>
      {g.itens.map(([i, f]) => <option key={i} value={i}>{f.nome}</option>)}
    </optgroup>
  ));
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)} role="tab" aria-selected={value === k}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon = '🥋', children }) {
  return (
    <div className="empty">
      <div className="e">{icon}</div>
      {children}
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    pago: ['ok', 'Pago'],
    pendente: ['warn', 'Pendente'],
    vencido: ['red', 'Vencido'],
    aprovado: ['ok', 'Aprovado'],
    inativo: ['', 'Inativo'],
    recusado: ['red', 'Recusado'],
    apto: ['ok', 'Apto'],
    reforco: ['warn', 'Necessita reforço'],
  };
  const [tone, label] = map[status] || ['', status];
  return <span className={`badge ${tone}`}>{label}</span>;
}

// ---------- Toast global ----------
let toastMsg = null;
const tl = new Set();
export function toast(msg) {
  toastMsg = msg;
  tl.forEach((l) => l());
  clearTimeout(toast.t);
  toast.t = setTimeout(() => {
    toastMsg = null;
    tl.forEach((l) => l());
  }, 2600);
}
export function Toaster() {
  const m = useSyncExternalStore((l) => (tl.add(l), () => tl.delete(l)), () => toastMsg);
  return m ? <div className="toast">{m}</div> : null;
}

export function useConfirm() {
  const [st, setSt] = useState(null);
  const ask = (msg, onYes, yesLabel = 'Confirmar') => setSt({ msg, onYes, yesLabel });
  const el = (
    <Modal
      open={!!st}
      onClose={() => setSt(null)}
      title="Confirmação"
      footer={
        <>
          <button className="btn ghost" onClick={() => setSt(null)}>Cancelar</button>
          <button className="btn" onClick={() => (st.onYes(), setSt(null))}>{st?.yesLabel}</button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{st?.msg}</p>
    </Modal>
  );
  return [ask, el];
}

export function Search({ value, onChange, placeholder = 'Buscar…' }) {
  return <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ maxWidth: 320 }} />;
}

export const WAIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
  </svg>
);
