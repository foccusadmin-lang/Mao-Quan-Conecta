import { useEffect, useState, useSyncExternalStore } from 'react';
import { initials, readImage } from '../lib/utils';
import { useDB, nivelsModalidade } from '../lib/db';

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

/** Foto de perfil: câmera ou galeria, com recorte e reposicionamento antes de salvar */
export function PhotoInput({ value, onChange, name }) {
  const [original, setOriginal] = useState(null); // imagem escolhida, aguardando recorte
  const [camera, setCamera] = useState(false);
  const toque = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const podeWebcam = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const escolher = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setOriginal(await readImage(f, 1600, 0.92));
    } catch {
      toast('Não foi possível abrir essa imagem. Tente outra (JPG ou PNG).');
    }
  };

  return (
    <div className="row">
      <Avatar src={value} name={name} size="lg" />
      <div className="col" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 6 }}>
          {toque || !podeWebcam ? (
            <label className="btn ghost sm">
              📸 Câmera
              <input type="file" accept="image/*" capture="user" hidden onChange={escolher} />
            </label>
          ) : (
            <button type="button" className="btn ghost sm" onClick={() => setCamera(true)}>📸 Câmera</button>
          )}
          <label className="btn ghost sm">
            🖼️ Galeria
            <input type="file" accept="image/*" hidden onChange={escolher} />
          </label>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {value && <button type="button" className="btn link sm" onClick={() => setOriginal(value)}>✂️ Ajustar</button>}
          {value && <button type="button" className="btn link sm" onClick={() => onChange(null)}>Remover</button>}
        </div>
      </div>
      {camera && <CameraFoto onFoto={(src) => (setCamera(false), setOriginal(src))} onClose={() => setCamera(false)} />}
      {original && <RecorteFoto src={original} onPronto={(src) => (onChange(src), setOriginal(null))} onClose={() => setOriginal(null)} />}
    </div>
  );
}

/** Webcam no computador (no celular a câmera nativa abre pelo próprio seletor) */
function CameraFoto({ onFoto, onClose }) {
  const [erro, setErro] = useState('');
  const [video, setVideo] = useState(null);
  useEffect(() => {
    if (!video) return;
    let stream;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        stream = s;
        video.srcObject = s;
        video.play().catch(() => {});
      })
      .catch(() => setErro('Não foi possível acessar a câmera. Verifique a permissão do navegador ou use a Galeria.'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [video]);

  const capturar = () => {
    if (!video?.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext('2d');
    ctx.translate(c.width, 0); // espelhado, como o usuário se vê
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    onFoto(c.toDataURL('image/jpeg', 0.92));
  };

  return (
    <Modal open onClose={onClose} title="📸 Tirar foto" footer={<button className="btn" disabled={!!erro} onClick={capturar}>Capturar</button>}>
      {erro ? (
        <div className="alert red small">{erro}</div>
      ) : (
        <video ref={setVideo} playsInline muted style={{ width: '100%', borderRadius: 12, background: '#000', transform: 'scaleX(-1)' }} />
      )}
    </Modal>
  );
}

const V = 280; // tamanho da área de recorte na tela
const SAIDA = 500; // tamanho da foto salva

/** Recorte quadrado (exibido em círculo): arrastar para reposicionar, zoom por barra, pinça ou roda do mouse */
function RecorteFoto({ src, onPronto, onClose }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const toques = useState(() => new Map())[0];
  const gesto = useState(() => ({}))[0];

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  const base = img ? V / Math.min(img.width, img.height) : 1;
  const escala = base * zoom;
  const limitar = (p, z = zoom) => {
    if (!img) return p;
    const s = base * z;
    const mx = Math.max(0, (img.width * s - V) / 2);
    const my = Math.max(0, (img.height * s - V) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };
  const mudarZoom = (z) => {
    const nz = Math.min(4, Math.max(1, z));
    setZoom(nz);
    setPos((p) => limitar(p, nz));
  };

  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2) {
      const [a, b] = [...toques.values()];
      gesto.dist = Math.hypot(a.x - b.x, a.y - b.y);
      gesto.zoom = zoom;
    }
  };
  const move = (e) => {
    const antes = toques.get(e.pointerId);
    if (!antes) return;
    const agora = { x: e.clientX, y: e.clientY };
    toques.set(e.pointerId, agora);
    if (toques.size === 2 && gesto.dist) {
      const [a, b] = [...toques.values()];
      mudarZoom((gesto.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / gesto.dist);
    } else if (toques.size === 1) {
      setPos((p) => limitar({ x: p.x + agora.x - antes.x, y: p.y + agora.y - antes.y }));
    }
  };
  const up = (e) => {
    toques.delete(e.pointerId);
    if (toques.size < 2) gesto.dist = 0;
  };

  const salvar = () => {
    if (!img) return;
    const c = document.createElement('canvas');
    c.width = c.height = SAIDA;
    const ctx = c.getContext('2d');
    const k = SAIDA / V;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SAIDA, SAIDA);
    const w = img.width * escala * k;
    const h = img.height * escala * k;
    ctx.drawImage(img, SAIDA / 2 + pos.x * k - w / 2, SAIDA / 2 + pos.y * k - h / 2, w, h);
    onPronto(c.toDataURL('image/jpeg', 0.88));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="✂️ Ajustar foto"
      footer={
        <>
          <button className="btn ghost" onClick={() => (setZoom(1), setPos({ x: 0, y: 0 }))}>Centralizar</button>
          <button className="btn" onClick={salvar} disabled={!img}>Usar esta foto</button>
        </>
      }
    >
      <p className="xs muted center" style={{ marginTop: 0 }}>Arraste para reposicionar. Use a barra (ou dois dedos / roda do mouse) para aproximar.</p>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => mudarZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92))}
        style={{ width: V, height: V, margin: '0 auto', position: 'relative', overflow: 'hidden', borderRadius: 16, background: '#111', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
      >
        {img && (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ position: 'absolute', left: '50%', top: '50%', width: img.width * escala, height: img.height * escala, maxWidth: 'none', transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`, pointerEvents: 'none' }}
          />
        )}
        {/* máscara: mostra o círculo que aparece no perfil */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '0 0 0 999px rgba(0,0,0,.55)', border: '2px solid rgba(255,255,255,.9)', pointerEvents: 'none' }} />
      </div>
      <div className="row mt" style={{ justifyContent: 'center', gap: 10 }}>
        <span>➖</span>
        <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => mudarZoom(+e.target.value)} style={{ width: 200 }} aria-label="Zoom" />
        <span>➕</span>
      </div>
    </Modal>
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

/** Níveis nas modalidades (ex.: ☯️ TCQ Intermediário · 🥊 Sanda Iniciante) */
export function NiveisModalidade({ aluno, escuro }) {
  const db = useDB();
  const lista = nivelsModalidade(db, aluno);
  if (!lista.length) return null;
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex', flexWrap: 'wrap' }}>
      {lista.map((n) => (
        <span key={n.modalidade} className="badge" style={escuro ? { background: '#fff' } : { background: 'var(--gold-soft, #fbf3dc)' }} title={n.modalidade}>
          {n.icone} {n.nome}
        </span>
      ))}
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
