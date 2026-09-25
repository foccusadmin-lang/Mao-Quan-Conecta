import { useState } from 'react';
import { useDB, setDB, replaceDB, carregarDemo, limparDemo, resetDB } from '../../lib/db';
import { uid } from '../../lib/utils';
import { PageHead, Card, Field, Inp, toast, useConfirm, faixaFundo } from '../../components/ui';
import { FAIXAS_PADRAO, NIVEIS } from '../../lib/seed';
import { PixBox } from '../../components/shared';

export default function Config() {
  const db = useDB();
  const [c, setC] = useState(db.config);
  const [ask, confirmEl] = useConfirm();
  const salvar = () => {
    setDB((d) => (d.config = { ...d.config, ...c }));
    toast('Configurações salvas.');
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mao-quan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importar = (file) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.filiais || !data.config) throw new Error();
        ask('Substituir todos os dados atuais pelo backup?', () => (replaceDB(data), setC(data.config), toast('Backup restaurado.')), 'Restaurar');
      } catch {
        toast('Arquivo de backup inválido.');
      }
    };
    r.readAsText(file);
  };

  return (
    <>
      <PageHead title="Configurações" sub="Investimento, PIX, cobrança automática, acessos e faixas">
        <button className="btn" onClick={salvar}>Salvar configurações</button>
      </PageHead>

      <div className="grid g2">
        <Card title="💰 Investimento & Ações rápidas">
          <label className="check mb">
            <Inp obj={c} set={setC} k="investimentoAtivo" type="checkbox" /> Botão de investimento ativo em todos os painéis
          </label>
          <div className="col">
            <Field label="Link oficial"><Inp obj={c} set={setC} k="investimentoLink" type="url" /></Field>
            <Field label="Código de indicação"><Inp obj={c} set={setC} k="codigoRef" /></Field>
          </div>
        </Card>

        <Card title="🔁 Cobrança recorrente automática">
          <div className="form-grid">
            <Field label="Dia de vencimento"><Inp obj={c} set={setC} k="diaVencimento" type="number" min="1" max="28" /></Field>
            <Field label="Lembrete (dias antes)"><Inp obj={c} set={setC} k="lembreteDiasAntes" type="number" min="0" /></Field>
            <Field label="Tolerância até bloqueio (dias)" hint="Após isso: bloqueio de material e de exames"><Inp obj={c} set={setC} k="diasTolerancia" type="number" min="0" /></Field>
            <Field label="Taxa de exame (R$)"><Inp obj={c} set={setC} k="taxaExame" type="number" min="0" /></Field>
            <Field label="Renovação da filiação (dias antes)" hint="Novo ciclo anual gerado automaticamente"><Inp obj={c} set={setC} k="renovacaoDiasAntes" type="number" min="0" /></Field>
          </div>
          <div className="xs muted" style={{ fontWeight: 700, margin: '14px 0 6px' }}>FILIAÇÃO ANUAL DO PROFESSOR</div>
          <div className="col" style={{ gap: 6 }}>
            {c.planosFiliacao.map((pl, i) => {
              const set = (patch) => setC({ ...c, planosFiliacao: c.planosFiliacao.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={pl.id} className="row" style={{ gap: 6 }}>
                  <input value={pl.nome} onChange={(e) => set({ nome: e.target.value })} style={{ flex: '1 1 150px' }} />
                  <label className="xs row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <input type="number" min="1" max="12" value={pl.parcelas} onChange={(e) => set({ parcelas: Math.max(1, Math.min(12, +e.target.value || 1)) })} style={{ width: 64 }} />x
                  </label>
                  <label className="xs row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    R$ <input type="number" min="0" step="0.01" value={pl.valorParcela} onChange={(e) => set({ valorParcela: +e.target.value })} style={{ width: 100 }} />
                  </label>
                  <span className="xs muted">= {(pl.parcelas * pl.valorParcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/ano</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="🏦 PIX & meios de pagamento">
          <div className="form-grid">
            <Field label="Chave PIX"><Inp obj={c} set={setC} k="pixChave" /></Field>
            <Field label="Nome do recebedor"><Inp obj={c} set={setC} k="pixNome" /></Field>
            <Field label="Cidade"><Inp obj={c} set={setC} k="pixCidade" /></Field>
            <Field label="Link InfinitePay (cartão)"><Inp obj={c} set={setC} k="infinitePay" type="url" placeholder="https://…" /></Field>
            <Field label="Link da Loja Oficial" style={{ gridColumn: '1/-1' }}><Inp obj={c} set={setC} k="lojaOficial" type="url" placeholder="https://…" /></Field>
          </div>
          <div className="mt"><PixBox descricao="Teste" /></div>
        </Card>

        <Card title="🔐 Acesso & Suporte">
          <div className="form-grid">
            <Field label="Conta Google do Administrador" hint="Única conta com acesso à Central Mao"><Inp obj={c} set={setC} k="adminEmail" type="email" /></Field>
            <Field label="WhatsApp suporte (com DDI)"><Inp obj={c} set={setC} k="whatsapp" /></Field>
            <Field label="Nome do suporte"><Inp obj={c} set={setC} k="suporteNome" /></Field>
          </div>
        </Card>

        <Card title="🎖️ Graduações (faixas)">
          <p className="xs muted" style={{ marginTop: 0 }}>A ordem define a progressão (de cima para baixo). Ponta e hanzi são opcionais.</p>
          {c.faixas.map((f, i) => {
            const set = (patch) => setC({ ...c, faixas: c.faixas.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            const novoNivel = i === 0 || c.faixas[i - 1].nivel !== f.nivel;
            return (
              <div key={i}>
                {novoNivel && <div className="xs" style={{ fontWeight: 800, color: 'var(--red)', letterSpacing: 1, margin: '10px 0 6px' }}>{(f.nivel || 'Sem nível').toUpperCase()}</div>}
                <div className="row mb" style={{ gap: 6 }}>
                  <span className="faixa"><i style={{ background: faixaFundo(f), width: 34, height: 12 }} /></span>
                  <input value={f.nome} onChange={(e) => set({ nome: e.target.value })} style={{ flex: '1 1 180px' }} />
                  <select value={f.nivel || ''} onChange={(e) => set({ nivel: e.target.value })} style={{ width: 140 }}>
                    {NIVEIS.map((n) => <option key={n}>{n}</option>)}
                  </select>
                  <label className="xs" title="Cor da faixa">Faixa <input type="color" value={f.cor} style={{ width: 40 }} onChange={(e) => set({ cor: e.target.value })} /></label>
                  <label className="xs" title="Cor da ponta">
                    <input type="checkbox" checked={!!f.ponta} onChange={(e) => set({ ponta: e.target.checked ? '#d0121b' : null })} /> Ponta
                    {f.ponta && <input type="color" value={f.ponta} style={{ width: 40 }} onChange={(e) => set({ ponta: e.target.value })} />}
                  </label>
                  <label className="xs" title="Cor do bordado hanzi">
                    <input type="checkbox" checked={!!f.hanzi} onChange={(e) => set({ hanzi: e.target.checked ? '#d0121b' : null })} /> Hanzi
                    {f.hanzi && <input type="color" value={f.hanzi} style={{ width: 40 }} onChange={(e) => set({ hanzi: e.target.value })} />}
                  </label>
                  <button className="btn sm ghost icon" onClick={() => setC({ ...c, faixas: c.faixas.filter((_, j) => j !== i) })} aria-label="Remover">✕</button>
                </div>
              </div>
            );
          })}
          <div className="row">
            <button className="btn sm ghost" onClick={() => setC({ ...c, faixas: [...c.faixas, { nivel: 'Professor', nome: 'Nova graduação', cor: '#999999', ponta: null, hanzi: null }] })}>+ Graduação</button>
            <button className="btn sm ghost" onClick={() => ask('Restaurar a tabela oficial de graduações?', () => setC({ ...c, faixas: FAIXAS_PADRAO }), 'Restaurar')}>↺ Tabela oficial</button>
          </div>
          <Field label="Polos de atleta (um por linha)" style={{ marginTop: 14 }}>
            <textarea rows={3} value={c.polos.join('\n')} onChange={(e) => setC({ ...c, polos: e.target.value.split('\n') })} />
          </Field>
        </Card>

        <Card title="🗂️ Tabela de valores e pacotes">
          {db.precos.map((p) => (
            <div key={p.id} className="row mb" style={{ flexWrap: 'nowrap' }}>
              <input value={p.nome} onChange={(e) => setDB((d) => (d.precos.find((x) => x.id === p.id).nome = e.target.value))} />
              <input type="number" style={{ width: 110 }} value={p.valor} onChange={(e) => setDB((d) => (d.precos.find((x) => x.id === p.id).valor = +e.target.value))} />
              <button className="btn sm ghost icon" onClick={() => setDB((d) => { d.precos = d.precos.filter((x) => x.id !== p.id); })} aria-label="Remover">✕</button>
            </div>
          ))}
          <button className="btn sm ghost" onClick={() => setDB((d) => d.precos.push({ id: uid('p'), nome: 'Novo pacote', valor: 0, descricao: '' }))}>+ Pacote</button>
        </Card>

        <Card title="💾 Dados">
          <div className="row">
            <button className="btn dark" onClick={exportar}>⬇ Exportar backup</button>
            <label className="btn ghost">
              ⬆ Restaurar backup
              <input type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && importar(e.target.files[0])} />
            </label>
          </div>
          <div className="row mt">
            <button className="btn ghost sm" onClick={() => (carregarDemo(), toast('Dados de demonstração carregados.'))}>Carregar demonstração</button>
            <button className="btn ghost sm" onClick={() => (limparDemo(), toast('Demonstração removida.'))}>Remover demonstração</button>
            <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => ask('Apagar TODOS os dados e voltar ao estado inicial? Faça um backup antes.', () => (resetDB(), location.reload()), 'Apagar tudo')}>Zerar sistema</button>
          </div>
        </Card>
      </div>
      {confirmEl}
    </>
  );
}
