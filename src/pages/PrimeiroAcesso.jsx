import { useState } from 'react';
import { useDB, useAuth, setDB, setSession, novoAluno, flush, recarregar } from '../lib/db';
import { Field, toast, Avatar } from '../components/ui';
import { maskCPF, maskRG, maskTelefone } from '../lib/utils';

/** Conta Google ainda não cadastrada: formulário de solicitação de filiação */
export default function PrimeiroAcesso() {
  const db = useDB();
  const auth = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [f, setF] = useState({ nome: auth.nome || '', telefone: '', nascimento: '', rg: '', cpf: '', filialId: '', responsavel: '' });

  const enviar = async () => {
    if (!f.nome.trim() || !f.telefone.trim() || !f.filialId) return toast('Preencha nome, WhatsApp e filial.');
    setEnviando(true);
    try {
      setDB((d) => void novoAluno(d, { ...f, nome: f.nome.trim(), email: auth.email, foto: auth.foto || null }));
      await flush();
      await recarregar();
    } catch (e) {
      toast('Não foi possível enviar: ' + e.message);
    }
    setEnviando(false);
  };

  return (
    <div style={{ minHeight: '100%', background: 'var(--ink)', padding: '24px 14px', paddingTop: 'calc(24px + env(safe-area-inset-top))' }}>
      <div className="card pad-lg" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="row mb">
          <img src="./logo.webp" alt="" style={{ width: 56 }} />
          <div className="brush" style={{ fontSize: 22 }}>MAO QUAN <span style={{ color: 'var(--red)' }}>CONECTA</span></div>
        </div>
        <h2 className="brush" style={{ fontWeight: 400 }}>Primeiro acesso</h2>
        <div className="row mb">
          <Avatar src={auth.foto} name={f.nome || auth.email} />
          <div className="small">
            Conta Google: <b>{auth.email}</b>
            <div className="xs muted">Preencha seus dados para solicitar a filiação. O professor da filial ou a Central libera o seu acesso.</div>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Nome completo"><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
          <Field label="WhatsApp"><input type="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: maskTelefone(e.target.value) })} placeholder="(11) 90000-0000" /></Field>
          <Field label="Data de nascimento"><input type="date" value={f.nascimento} onChange={(e) => setF({ ...f, nascimento: e.target.value })} /></Field>
          <Field label="RG"><input value={f.rg} onChange={(e) => setF({ ...f, rg: maskRG(e.target.value) })} placeholder="00.000.000-0" inputMode="text" maxLength={12} /></Field>
          <Field label="CPF"><input value={f.cpf} inputMode="numeric" onChange={(e) => setF({ ...f, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} /></Field>
          <Field label="Academia / Filial">
            <select value={f.filialId} onChange={(e) => setF({ ...f, filialId: e.target.value })}>
              <option value="">Selecione…</option>
              {db.filiais.filter((x) => x.ativa).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </Field>
          <Field label="Responsável (se menor de idade)" style={{ gridColumn: '1/-1' }}><input value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></Field>
        </div>
        <div className="row between mt">
          <button className="btn ghost" onClick={() => setSession(null)}>Usar outra conta</button>
          <button className="btn" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar cadastro'}</button>
        </div>
      </div>
    </div>
  );
}
