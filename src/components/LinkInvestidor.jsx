import { useEffect, useState } from 'react';
import { copy, waLink, fmtDate } from '../lib/utils';
import { criarConviteInvestidor, meusConvites, desativarConvite, linkInvestidor } from '../lib/investidor';
import { Modal, Field, toast } from './ui';

/** Botão do professor/Central: gera e compartilha o link exclusivo do Painel do Patrocinador */
export function BotaoLinkInvestidor() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="btn gold" onClick={() => setAberto(true)}>💼 Link do patrocinador</button>
      {aberto && <ModalLinkInvestidor onClose={() => setAberto(false)} />}
    </>
  );
}

function ModalLinkInvestidor({ onClose }) {
  const [nome, setNome] = useState('');
  const [link, setLink] = useState('');
  const [gerando, setGerando] = useState(false);
  const [lista, setLista] = useState([]);
  const recarregar = () => meusConvites().then(setLista).catch(() => {});
  useEffect(() => void recarregar(), []);

  const gerar = async () => {
    setGerando(true);
    try {
      const token = await criarConviteInvestidor(nome.trim());
      setLink(linkInvestidor(token));
      recarregar();
    } catch (e) {
      toast('Não foi possível gerar o link: ' + e.message);
    } finally {
      setGerando(false);
    }
  };
  const mensagem = (url) => `Olá${nome.trim() ? `, ${nome.trim()}` : ''}! Conheça os atletas da Associação Mao Quan Kung Fu Wushu. Acesso exclusivo ao Painel do Patrocinador: ${url}`;
  const compartilhar = (url) =>
    navigator.share ? navigator.share({ title: 'Painel do Patrocinador — Mao Quan', text: mensagem(url), url }).catch(() => {}) : copy(url).then(() => toast('Link copiado!'));

  return (
    <Modal open onClose={onClose} title="💼 Painel do Patrocinador">
      <div className="col">
        <p className="small" style={{ margin: 0 }}>
          Gere um <b>link exclusivo</b> para o patrocinador ver a vitrine com <b>todos os atletas</b> (perfis publicados), com filtros por nome, filial, modalidade e faixa. Não precisa de login e o link pode ser desativado a qualquer momento.
        </p>
        <Field label="Nome do patrocinador (opcional)" hint="Ajuda a identificar o link e personaliza a mensagem">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Empresa XYZ / Sr. João" />
        </Field>
        <div><button className="btn" disabled={gerando} onClick={gerar}>{gerando ? 'Gerando…' : '🔗 Gerar link exclusivo'}</button></div>

        {link && (
          <div className="card" style={{ background: '#faf8f6', padding: 12 }}>
            <div className="xs muted">Link gerado:</div>
            <div className="small" style={{ wordBreak: 'break-all', fontWeight: 600 }}>{link}</div>
            <div className="row mt" style={{ flexWrap: 'wrap' }}>
              <a className="btn ok sm" href={waLink('', mensagem(link))} target="_blank" rel="noreferrer">💬 Enviar por WhatsApp</a>
              <button className="btn sm dark" onClick={() => compartilhar(link)}>📤 Compartilhar</button>
              <button className="btn sm ghost" onClick={() => copy(link).then(() => toast('Link copiado!'))}>📋 Copiar</button>
            </div>
          </div>
        )}

        {lista.length > 0 && (
          <>
            <b className="small">Links já gerados</b>
            {lista.map((c) => (
              <div key={c.token} className="list-item small" style={{ flexWrap: 'wrap' }}>
                <div className="grow" style={{ minWidth: 160 }}>
                  <b>{c.nome || 'Sem nome'}</b>
                  <div className="xs muted">
                    {fmtDate(c.criado_em)} · por {c.criado_por} · {c.acessos} acesso(s){c.ultimo_acesso ? ` · último em ${fmtDate(c.ultimo_acesso)}` : ''}
                  </div>
                </div>
                {c.ativo ? (
                  <>
                    <button className="btn sm ghost" onClick={() => copy(linkInvestidor(c.token)).then(() => toast('Link copiado!'))}>📋</button>
                    <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => desativarConvite(c.token).then(() => (toast('Link desativado.'), recarregar())).catch((e) => toast(e.message))}>Desativar</button>
                  </>
                ) : (
                  <span className="badge">Desativado</span>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
