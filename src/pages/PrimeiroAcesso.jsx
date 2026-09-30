import { useState } from 'react';
import { useDB, useAuth, setDB, setSession, novoAluno, flush, recarregar } from '../lib/db';
import { Field, toast, Avatar, FaixaOptions } from '../components/ui';
import { maskCPF, maskRG, maskTelefone } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { temPlanos, validarPlano } from '../lib/planos';
import { EscolhaPlano } from '../components/Planos';
import FiliaisTreino, { limparExtras } from '../components/FiliaisTreino';

/** Conta Google ainda não cadastrada: formulário de solicitação de filiação */
export default function PrimeiroAcesso() {
  const db = useDB();
  const auth = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [f, setF] = useState({ nome: auth.nome || '', telefone: '', nascimento: '', rg: '', cpf: '', filialId: '', responsavel: '', faixaIdx: 0 });
  const [plano, setPlano] = useState({ tipo: 'modalidades', modalidades: [] });
  const filialSel = db.filiais.find((x) => x.id === f.filialId);

  const enviar = async () => {
    if (!f.nome.trim() || !f.telefone.trim() || !f.filialId) return toast('Preencha nome, WhatsApp e filial.');
    const filial = db.filiais.find((x) => x.id === f.filialId);
    const erroPlano = validarPlano(filial, plano);
    if (erroPlano) return toast(erroPlano);
    setEnviando(true);
    try {
      let id;
      const dados = { ...f, nome: f.nome.trim(), email: auth.email, foto: auth.foto || null, filiaisExtras: limparExtras(f.filialId, f.filiaisExtras) };
      if (!dados.filiaisExtras.length) delete dados.filiaisExtras;
      if (f.faixaIdx > 0) dados.faixaInformada = true; // declarada pelo aluno — o professor confere na aprovação
      if (temPlanos(filial)) dados.plano = { ...plano, atualizadoEm: new Date().toISOString() };
      setDB((d) => void (id = novoAluno(d, dados).id));
      await flush();
      if (dados.plano?.tipo === 'familia') await supabase.rpc('mq_aplicar_familia', { p_titular: id });
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
          <Field label="RG"><input value={maskRG(f.rg || '')} onChange={(e) => setF({ ...f, rg: maskRG(e.target.value) })} placeholder="00.000.000-0" inputMode="text" maxLength={12} /></Field>
          <Field label="CPF"><input value={maskCPF(f.cpf || '')} inputMode="numeric" onChange={(e) => setF({ ...f, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} /></Field>
          <Field label="Academia / Filial principal">
            <select value={f.filialId} onChange={(e) => setF({ ...f, filialId: e.target.value, filiaisExtras: (f.filiaisExtras || []).filter((x) => x !== e.target.value) })}>
              <option value="">Selecione…</option>
              {db.filiais.filter((x) => x.ativa).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </Field>
          {f.filialId && (
            <Field label="Também treino em (opcional)">
              <FiliaisTreino principal={f.filialId} value={f.filiaisExtras || []} onChange={(v) => setF({ ...f, filiaisExtras: v })} />
            </Field>
          )}
          <Field label="Graduação atual" hint="Se você ainda não tem faixa, deixe “Neutra”. O professor confere na aprovação.">
            <select value={f.faixaIdx} onChange={(e) => setF({ ...f, faixaIdx: +e.target.value })}>
              <FaixaOptions />
            </select>
          </Field>
          <Field label="Responsável (se menor de idade)"><input value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></Field>
        </div>
        {filialSel && temPlanos(filialSel) && (
          <div className="mt">
            <h3 style={{ margin: '0 0 8px' }}>📋 Escolha seu plano</h3>
            <EscolhaPlano filial={filialSel} value={plano} onChange={setPlano} />
          </div>
        )}
        <div className="row between mt">
          <button className="btn ghost" onClick={() => setSession(null)}>Usar outra conta</button>
          <button className="btn" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar cadastro'}</button>
        </div>
      </div>
    </div>
  );
}
