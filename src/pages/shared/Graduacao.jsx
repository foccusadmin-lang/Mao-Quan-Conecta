import { useState } from 'react';
import { useDB, setDB, notify, professorVeAluno, situacaoAluno, frequencia, filialNome, taxaExameFaixa } from '../../lib/db';
import { uid, todayISO, addDays, fmtDate, brl } from '../../lib/utils';
import { PageHead, Card, Avatar, Faixa, Tabs, useConfirm, toast, Empty, Search } from '../../components/ui';

export default function Graduacao({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState('avaliar');
  const [q, setQ] = useState('');
  const [ask, confirmEl] = useConfirm();
  const [filial, setFilial] = useState(''); // ADM: filtrar por filial
  const [faixaLote, setFaixaLote] = useState(''); // '' = todas as graduações
  const proximoExame = db.eventos.filter((e) => e.tipo === 'exame' && e.data >= todayISO()).sort((a, b) => a.data.localeCompare(b.data))[0];
  const [vencimento, setVencimento] = useState(() => (proximoExame ? [addDays(proximoExame.data, -2), todayISO()].sort()[1] : addDays(todayISO(), 7)));

  if (!isAdmin && !user.filialId) return <Empty icon="🏯">Você ainda não foi vinculado a uma filial.</Empty>;

  const alunos = db.alunos.filter((a) => a.status === 'aprovado' && (isAdmin ? !filial || a.filialId === filial : a.filialId === user.filialId && professorVeAluno(db, user, a)) && (a.nome + ' ' + (a.matricula || '')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.nome.localeCompare(b.nome));

  // Pré-avaliação: apto / necessita reforço / não apto. status null = remove a avaliação
  const AVISO = {
    apto: ['Pré-avaliação: APTO ✅', 'Você foi considerado apto para o próximo exame de graduação.'],
    reforco: ['Pré-avaliação: necessita reforço', 'Continue treinando! Seu professor indicou pontos de reforço antes do exame.'],
    nao_apto: ['Pré-avaliação: ainda não apto', 'Você ainda não está apto para este exame. Converse com seu professor sobre os próximos passos.'],
  };
  const avaliar = (a, status) => {
    setDB((d) => {
      const x = d.alunos.find((y) => y.id === a.id);
      if (!status) {
        x.preExame = null;
        return;
      }
      x.preExame = { status, por: user.nome, data: new Date().toISOString() };
      notify(d, a.id, ...AVISO[status]);
    });
    toast(status ? `${a.nome.split(' ')[0]}: ${AVISO[status][0].replace('Pré-avaliação: ', '')}` : 'Avaliação removida.');
  };
  // Apto com trava (frequência / inadimplência): o professor vê o motivo; a Central pode liberar mesmo assim
  const marcarApto = (a, bloqueios) => {
    if (!bloqueios.length) return avaliar(a, 'apto');
    if (!isAdmin) return toast(`Não dá para marcar Apto: ${bloqueios.join(' e ')}.`);
    ask(`${a.nome} está com trava (${bloqueios.join(' e ')}). Marcar como APTO mesmo assim?`, () => avaliar(a, 'apto'), 'Marcar apto');
  };

  // Taxa de exame: liberada pelo professor ou pela Central a qualquer momento (independe de estar apto)
  const proxima = (a) => db.config.faixas[a.faixaIdx + 1];
  const taxaDe = (a) => db.pagamentos.find((p) => p.pessoaId === a.id && p.tipo === 'exame' && p.status !== 'cancelado' && (p.descricao || '').includes(proxima(a)?.nome || '—'));
  const podeLiberar = (a) => !!proxima(a) && !taxaDe(a);
  const liberarTaxas = (lista) => {
    const alvo = lista.filter(podeLiberar);
    if (!alvo.length) return toast('Todos já estão com a taxa liberada.');
    const agora = new Date().toISOString();
    setDB((d) => {
      for (const a of alvo) {
        const nome = d.config.faixas[a.faixaIdx + 1]?.nome || 'graduação';
        const valor = taxaExameFaixa(d, a.faixaIdx + 1);
        d.pagamentos.push({
          id: uid('pg'), tipo: 'exame', pessoaId: a.id, filialId: a.filialId, competencia: todayISO().slice(0, 7),
          descricao: `Taxa de exame — ${nome}`, valor, vencimento, status: 'pendente', criadoEm: agora, lembretes: [], liberadaPor: user.nome,
        });
        notify(d, a.id, 'Taxa de exame liberada 🎖️', `Taxa para a faixa ${nome}: ${brl(valor)}, vencimento ${fmtDate(vencimento)}. Acesse Pagamentos para pagar e confirmar sua inscrição.`);
      }
    });
    toast(alvo.length === 1 ? `Taxa liberada para ${alvo[0].nome.split(' ')[0]}.` : `${alvo.length} taxas de exame liberadas.`);
  };
  const liberarUma = (a) =>
    ask(`Liberar a taxa de exame de ${a.nome} (${proxima(a)?.nome}): ${brl(taxaExameFaixa(db, a.faixaIdx + 1))}, vencimento ${fmtDate(vencimento)}?`, () => liberarTaxas([a]), 'Liberar taxa');
  // Lote por graduação (faixa atual → próxima), com o resumo de quantos e quanto antes de confirmar
  const grupos = Object.values(
    alunos.filter(podeLiberar).reduce((acc, a) => {
      (acc[a.faixaIdx] ||= { idx: a.faixaIdx, alunos: [] }).alunos.push(a);
      return acc;
    }, {})
  ).sort((x, y) => x.idx - y.idx);
  const gruposLote = grupos.filter((g) => faixaLote === '' || String(g.idx) === faixaLote);
  const doLote = gruposLote.flatMap((g) => g.alunos);
  const totalLote = doLote.reduce((s, a) => s + taxaExameFaixa(db, a.faixaIdx + 1), 0);
  const liberarLote = () =>
    ask(
      `Liberar ${doLote.length} taxa(s) de exame, vencimento ${fmtDate(vencimento)}: ` +
        gruposLote.map((g) => `${db.config.faixas[g.idx]?.nome} → ${db.config.faixas[g.idx + 1]?.nome}: ${g.alunos.length} × ${brl(taxaExameFaixa(db, g.idx + 1))}`).join('; ') +
        `. Total ${brl(totalLote)}.`,
      () => liberarTaxas(doLote),
      'Liberar taxas'
    );

  const aprovarGraduacao = (a) =>
    ask(`Aprovar oficialmente ${a.nome} para ${db.config.faixas[a.faixaIdx + 1]?.nome}? O conteúdo da nova faixa será liberado.`, () =>
      setDB((d) => {
        const x = d.alunos.find((y) => y.id === a.id);
        x.faixaIdx = Math.min(d.config.faixas.length - 1, x.faixaIdx + 1);
        x.historicoGraduacao = [...(x.historicoGraduacao || []), { data: todayISO(), faixaIdx: x.faixaIdx, por: user.nome }];
        x.preExame = null;
        x.inscritoExame = false;
        if (x.propostaGraduacao) x.propostaGraduacao.decidida = true;
        notify(d, a.id, 'Parabéns! Nova graduação 🎖️', `Você agora é ${d.config.faixas[x.faixaIdx].nome}. O conteúdo técnico foi liberado.`);
      }),
      'Aprovar'
    );

  const propostas = alunos.filter((a) => a.propostaGraduacao && !a.propostaGraduacao.decidida);

  return (
    <>
      <PageHead title="Graduação & Pré-Exame" sub="Checklist Apto / Necessita Reforço antes de gerar a taxa de exame">
        <Search value={q} onChange={setQ} placeholder="Buscar aluno" />
        {isAdmin && (
          <select value={filial} onChange={(e) => (setFilial(e.target.value), setFaixaLote(''))} style={{ maxWidth: 220 }}>
            <option value="">Todas as filiais</option>
            {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
      </PageHead>
      <Tabs tabs={[['avaliar', '📋 Pré-avaliação'], ['exame', '🎖️ Inscritos / Aprovação'], ['propostas', `📨 Propostas (${propostas.length})`]]} value={tab} onChange={setTab} />

      {tab === 'avaliar' && (
        <Card title="💳 Liberar taxa de exame" className="mb">
          <p className="small muted" style={{ marginTop: 0 }}>
            Libera a cobrança no app do aluno (Pagamentos) com o valor da tabela de cada graduação — independe da pré-avaliação. Quem já tem a taxa da próxima faixa liberada fica de fora.
          </p>
          <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
            <label className="small" style={{ display: 'grid', gap: 4 }}>
              Graduação
              <select value={faixaLote} onChange={(e) => setFaixaLote(e.target.value)} style={{ minWidth: 260 }}>
                <option value="">Todas as graduações ({grupos.reduce((s, g) => s + g.alunos.length, 0)} alunos)</option>
                {grupos.map((g) => (
                  <option key={g.idx} value={String(g.idx)}>
                    {db.config.faixas[g.idx]?.nome} → {db.config.faixas[g.idx + 1]?.nome} · {g.alunos.length} × {brl(taxaExameFaixa(db, g.idx + 1))}
                  </option>
                ))}
              </select>
            </label>
            <label className="small" style={{ display: 'grid', gap: 4 }}>
              Vencimento
              <input type="date" value={vencimento} min={todayISO()} onChange={(e) => setVencimento(e.target.value)} />
            </label>
            <button className="btn" disabled={!doLote.length || !vencimento} onClick={liberarLote}>
              Liberar para {doLote.length} aluno{doLote.length === 1 ? '' : 's'} · {brl(totalLote)}
            </button>
          </div>
          {proximoExame && <div className="xs muted mt">📅 Próximo exame: {proximoExame.titulo} — {fmtDate(proximoExame.data)}</div>}
          {!grupos.length && alunos.length > 0 && <div className="xs muted mt">Todos os alunos da lista já estão com a taxa liberada.</div>}
        </Card>
      )}

      {tab === 'avaliar' && (
        <Card>
          {alunos.length === 0 && <Empty>Nenhum aluno ativo.</Empty>}
          {alunos.map((a) => {
            const fr = frequencia(db, a);
            const fin = situacaoAluno(db, a);
            const taxa = taxaDe(a);
            const bloqueios = [!fr.ok && `frequência ${fr.pct}% (mín. ${fr.min}%)`, fin.bloqueado && 'inadimplente'].filter(Boolean);
            return (
              <div key={a.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                <Avatar src={a.foto} name={a.nome} />
                <div className="grow" style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 600 }}>{a.nome}</div>
                  <div className="row xs muted" style={{ gap: 6 }}>
                    <Faixa idx={a.faixaIdx} /> → <Faixa idx={a.faixaIdx + 1} />
                    {isAdmin && <span>· {filialNome(db, a.filialId)}</span>}
                  </div>
                  {bloqueios.length > 0 && <div className="xs" style={{ color: 'var(--red)' }}>⛔ Trava: {bloqueios.join(', ')}</div>}
                </div>
                <div className="row">
                  {a.inscritoExame && <span className="badge ink">Inscrito</span>}
                  {/* Escolha única: a opção marcada fica destacada; tocar de novo nela (ou em ✕) remove a avaliação */}
                  <div className="row" role="radiogroup" aria-label={`Pré-avaliação de ${a.nome}`} style={{ gap: 4, flexWrap: 'nowrap' }}>
                    {[
                      ['apto', '✅ Apto', 'var(--ok, #1a8f4a)'],
                      ['reforco', '⚠️ Necessita reforço', '#b45309'],
                      ['nao_apto', '✗ Não apto', 'var(--red)'],
                    ].map(([st, rot, cor]) => {
                      const sel = a.preExame?.status === st;
                      const travado = st === 'apto' && bloqueios.length > 0 && !sel;
                      return (
                        <button
                          key={st}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          className="btn sm"
                          title={sel ? 'Toque de novo para remover' : travado ? `Trava: ${bloqueios.join(', ')}` : ''}
                          style={sel ? { background: cor, borderColor: cor, color: '#fff' } : { background: 'transparent', borderColor: 'var(--line, #ddd)', color: travado ? '#999' : cor }}
                          onClick={() => (sel ? avaliar(a, null) : st === 'apto' ? marcarApto(a, bloqueios) : avaliar(a, st))}
                        >
                          {travado ? '🔒 Apto' : rot}
                        </button>
                      );
                    })}
                    {a.preExame && <button type="button" className="btn sm ghost" title="Remover avaliação" aria-label="Remover avaliação" onClick={() => avaliar(a, null)}>✕</button>}
                  </div>
                  {podeLiberar(a) && !a.inscritoExame && (
                    <button className="btn sm dark" title={`Taxa para ${proxima(a)?.nome}`} onClick={() => liberarUma(a)}>💳 Liberar taxa · {brl(taxaExameFaixa(db, a.faixaIdx + 1))}</button>
                  )}
                  {taxa && <span className={`badge ${taxa.status === 'pago' ? 'ok' : 'warn'}`}>{taxa.status === 'pago' ? 'Taxa paga' : `Taxa liberada · ${brl(taxa.valor)}`}</span>}
                  {!isAdmin && (
                    <button className="btn sm ghost" title="Propor graduação ao Administrador" onClick={() => setDB((d) => { d.alunos.find((y) => y.id === a.id).propostaGraduacao = { por: user.nome, data: todayISO() }; notify(d, 'admin', 'Proposta de graduação', `${user.nome} propôs a graduação de ${a.nome}.`); toast('Proposta enviada à Central.'); })}>📨</button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {tab === 'exame' && (
        <Card>
          {alunos.filter((a) => a.inscritoExame || a.preExame?.status === 'apto').length === 0 && <Empty icon="🎖️">Nenhum aluno apto ou inscrito.</Empty>}
          {alunos
            .filter((a) => a.inscritoExame || a.preExame?.status === 'apto')
            .map((a) => (
              <div key={a.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                <Avatar src={a.foto} name={a.nome} />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{a.nome}</div>
                  <div className="xs muted">Apto em {fmtDate(a.preExame?.data)} por {a.preExame?.por}</div>
                </div>
                {a.inscritoExame ? <span className="badge ok">Taxa paga · inscrito</span> : <span className="badge warn">Aguardando pagamento</span>}
                <button className="btn sm" disabled={!a.inscritoExame && !isAdmin} onClick={() => aprovarGraduacao(a)}>Aprovar graduação</button>
              </div>
            ))}
          <p className="xs muted">A aprovação oficial destrava automaticamente o conteúdo da faixa seguinte no app do aluno.</p>
        </Card>
      )}

      {tab === 'propostas' && (
        <Card>
          {propostas.length === 0 && <Empty icon="📨">Nenhuma proposta em aberto.</Empty>}
          {propostas.map((a) => (
            <div key={a.id} className="list-item" style={{ flexWrap: 'wrap' }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{a.nome}</div>
                <div className="xs muted">Proposta de {a.propostaGraduacao.por} em {fmtDate(a.propostaGraduacao.data)}</div>
              </div>
              {isAdmin && (
                <>
                  <button className="btn sm ghost" onClick={() => setDB((d) => (d.alunos.find((y) => y.id === a.id).propostaGraduacao.decidida = true))}>Arquivar</button>
                  <button className="btn sm" onClick={() => aprovarGraduacao(a)}>Aprovar</button>
                </>
              )}
            </div>
          ))}
        </Card>
      )}
      {confirmEl}
    </>
  );
}
