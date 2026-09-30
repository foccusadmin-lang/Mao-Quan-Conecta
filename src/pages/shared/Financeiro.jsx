import { useState } from 'react';
import { useDB, setDB, notify, professorVeAluno, confirmarPagamento, rotinaFinanceira, situacaoAluno, filialNome, professorEmDia, gerarFiliacao, planoFiliacao, descPlano, divisaoFiliacao } from '../../lib/db';
import { brl, fmtDate, todayISO, monthISO, fmtMonth, uid, waLink, addDays, maskChavePix } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Stat, Tabs, StatusBadge, toast, Empty, Search, useConfirm } from '../../components/ui';
import { PixBox, useRecebedor, recebedorLocal } from '../../components/shared';
import { PlanosFilialEditor } from '../../components/Planos';
import { ConferenciaPagamento, SeloComprovante } from '../../components/Comprovante';
import { CobrancaRetroativa } from '../../components/CobrancaRetroativa';

const TIPO = { mensalidade: 'Mensalidade', filiacao: 'Filiação', exame: 'Taxa de exame', manutencao: 'Manutenção', outro: 'Outro' };

export default function Financeiro({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState(isAdmin ? 'resumo' : 'abertos');
  const [q, setQ] = useState('');
  const [mes, setMes] = useState(monthISO());
  const [filial, setFilial] = useState(isAdmin ? '' : user.filialId);
  const [novo, setNovo] = useState(null);
  const [pix, setPix] = useState(null);
  const [conferir, setConferir] = useState(null);
  const [retro, setRetro] = useState(false);
  const [ask, confirmEl] = useConfirm();
  const hoje = todayISO();
  const { rec: recMinhaFilial } = useRecebedor(isAdmin ? null : user.filialId);

  if (!isAdmin && !user.filialId) return <Empty icon="🏯">Você ainda não foi vinculado a uma filial.</Empty>;

  const nomeDe = (id) => db.alunos.find((a) => a.id === id)?.nome || db.professores.find((p) => p.id === id)?.nome || '—';
  const telDe = (id) => db.alunos.find((a) => a.id === id)?.telefone || db.professores.find((p) => p.id === id)?.telefone || '';
  const escopo = db.pagamentos.filter((p) => (!filial || p.filialId === filial) && (isAdmin || ((p.tipo === 'mensalidade' || p.tipo === 'exame') && professorVeAluno(db, user, db.alunos.find((a) => a.id === p.pessoaId)))));
  const busca = (p) => nomeDe(p.pessoaId).toLowerCase().includes(q.toLowerCase());

  const abertos = escopo.filter((p) => p.status === 'pendente' && busca(p)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const emConferencia = abertos.filter((p) => p.analise === 'enviado');
  const pagosMes = escopo.filter((p) => p.status === 'pago' && p.pagoEm?.startsWith(mes) && busca(p));
  const vencidos = abertos.filter((p) => p.vencimento < hoje);

  const confirmar = (p, metodo) =>
    ask(`Confirmar pagamento de ${brl(p.valor)} — ${nomeDe(p.pessoaId)} (${p.descricao})?${metodo === 'dinheiro' ? ' Recebido em mãos.' : ''}`, () => {
      setDB((d) => confirmarPagamento(d, p.id, user.nome, metodo));
      toast('Pagamento confirmado — acessos liberados.');
    });

  const chaveLembrete = (p) => {
    const rec = p.tipo === 'mensalidade' ? (isAdmin ? recebedorLocal(db, p.filialId) : recMinhaFilial) : null;
    return rec ? `${maskChavePix(rec.tipo, rec.chave)} (${rec.titular || rec.nome})` : db.config.pixChave;
  };

  const lembrete = (p) =>
    window.open(
      waLink(telDe(p.pessoaId) ? '55' + telDe(p.pessoaId).replace(/\D/g, '') : db.config.whatsapp, `Olá, ${nomeDe(p.pessoaId)}! Lembrete da Associação Mao Quan: ${p.descricao} no valor de ${brl(p.valor)} ${p.vencimento < hoje ? 'venceu' : 'vence'} em ${fmtDate(p.vencimento)}. PIX: ${chaveLembrete(p)}`),
      '_blank'
    );

  const alunosEscopo = db.alunos.filter((a) => a.status === 'aprovado' && (!filial || a.filialId === filial) && professorVeAluno(db, user, a));

  return (
    <>
      <PageHead title={isAdmin ? 'Financeiro' : 'Mensalidades da Filial'} sub={isAdmin ? 'Cobrança recorrente, confirmação de pagamentos e inadimplência' : filialNome(db, user.filialId)}>
        <Search value={q} onChange={setQ} placeholder="Buscar pessoa" />
        {isAdmin && (
          <select value={filial} onChange={(e) => setFilial(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Todas as filiais</option>
            {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
        <button className="btn ghost" onClick={() => (rotinaFinanceira(), toast('Cobranças do mês verificadas.'))}>🔁 Gerar cobranças do mês</button>
        <button className="btn ghost" onClick={() => setRetro(true)}>↩ Meses anteriores</button>
        <button className="btn" onClick={() => setNovo({ tipo: 'mensalidade', pessoaId: '', valor: '', vencimento: hoje, descricao: '' })}>+ Lançamento</button>
      </PageHead>

      <div className="grid g4 mb">
        <Stat label="Em aberto" value={brl(abertos.reduce((s, p) => s + +p.valor, 0))} icon="🧾" tone="gold" hint={`${abertos.length} cobranças`} />
        <Stat label="Vencidos" value={brl(vencidos.reduce((s, p) => s + +p.valor, 0))} icon="⛔" tone="red" hint={`${vencidos.length} cobranças`} />
        <Stat label={`Recebido em ${fmtMonth(mes)}`} value={brl(pagosMes.reduce((s, p) => s + +p.valor, 0))} icon="💰" tone="ok" />
        <Stat label="Alunos bloqueados" value={alunosEscopo.filter((a) => situacaoAluno(db, a).bloqueado).length} icon="🔒" tone="ink" />
      </div>

      <Tabs
        tabs={[...(isAdmin ? [['resumo', 'Resumo por filial']] : []), ['conferencia', `🔎 Conferência (${emConferencia.length})`], ['abertos', `Em aberto (${abertos.length})`], ['pagos', 'Recebidos'], ['isencoes', 'Isenções'], ['planos', '📋 Planos e valores'], ...(isAdmin ? [['professores', 'Filiação professores'], ['pix', 'PIX / QR Code']] : [])]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'resumo' && isAdmin && (() => {
        const soma = (l) => l.reduce((s, p) => s + +p.valor, 0);
        const linhas = db.filiais.filter((f) => !filial || f.id === filial).map((f) => {
          const pg = db.pagamentos.filter((p) => p.filialId === f.id);
          const mens = pg.filter((p) => p.tipo === 'mensalidade');
          const rec = recebedorLocal(db, f.id);
          return {
            f,
            alunos: db.alunos.filter((a) => a.status === 'aprovado' && a.filialId === f.id).length,
            previsto: soma(mens.filter((p) => (p.competencia || p.vencimento?.slice(0, 7)) === mes)),
            recebidoMens: soma(mens.filter((p) => p.status === 'pago' && p.pagoEm?.startsWith(mes))),
            recebidoOutros: soma(pg.filter((p) => p.tipo !== 'mensalidade' && p.status === 'pago' && p.pagoEm?.startsWith(mes))),
            aberto: soma(pg.filter((p) => p.status === 'pendente')),
            vencido: soma(pg.filter((p) => p.status === 'pendente' && p.vencimento < hoje)),
            recebedor: rec ? `${rec.titulo || 'Laoshi'} ${rec.nome}` : null,
          };
        });
        const tot = ['alunos', 'previsto', 'recebidoMens', 'recebidoOutros', 'aberto', 'vencido'].reduce((o, k) => ({ ...o, [k]: linhas.reduce((s, l) => s + l[k], 0) }), {});
        return (
          <Card title={`${filial ? filialNome(db, filial) : 'Todas as filiais'} · ${fmtMonth(mes)}`} actions={<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ maxWidth: 180 }} />}>
            <div className="grid g4 mb">
              <Stat label="Mensalidades previstas" value={brl(tot.previsto)} icon="📅" tone="ink" hint={`${tot.alunos} alunos ativos`} />
              <Stat label="Mensalidades recebidas" value={brl(tot.recebidoMens)} icon="💰" tone="ok" hint={tot.previsto ? `${Math.round((tot.recebidoMens / tot.previsto) * 100)}% do previsto` : ''} />
              <Stat label="Filiação, exames e outros" value={brl(tot.recebidoOutros)} icon="🏅" tone="gold" hint="Recebidos no mês" />
              <Stat label="Em aberto (total)" value={brl(tot.aberto)} icon="⛔" tone="red" hint={`${brl(tot.vencido)} vencido`} />
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Filial</th><th>Alunos</th><th>Previsto</th><th>Mensalidades recebidas</th><th>Outras receitas</th><th>Em aberto</th><th>Vencido</th><th>Mensalidade creditada a</th><th></th></tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.f.id}>
                      <td style={{ fontWeight: 600 }}>{l.f.nome}{!l.f.ativa && <div className="xs muted">Inativa</div>}</td>
                      <td>{l.alunos}</td>
                      <td className="nowrap">{brl(l.previsto)}</td>
                      <td className="nowrap" style={{ color: 'var(--ok)', fontWeight: 700 }}>{brl(l.recebidoMens)}</td>
                      <td className="nowrap">{brl(l.recebidoOutros)}</td>
                      <td className="nowrap">{brl(l.aberto)}</td>
                      <td className="nowrap" style={{ color: l.vencido ? 'var(--red)' : undefined }}>{brl(l.vencido)}</td>
                      <td className="small">{l.recebedor ? <span className="badge ok">{l.recebedor}</span> : <span className="badge">Associação</span>}</td>
                      <td>{!filial && <button className="btn sm ghost" onClick={() => setFilial(l.f.id)}>Detalhar</button>}</td>
                    </tr>
                  ))}
                </tbody>
                {linhas.length > 1 && (
                  <tfoot>
                    <tr style={{ fontWeight: 800 }}>
                      <td>Total geral</td><td>{tot.alunos}</td><td className="nowrap">{brl(tot.previsto)}</td><td className="nowrap">{brl(tot.recebidoMens)}</td><td className="nowrap">{brl(tot.recebidoOutros)}</td><td className="nowrap">{brl(tot.aberto)}</td><td className="nowrap">{brl(tot.vencido)}</td><td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {filial && <button className="btn sm ghost mt" onClick={() => setFilial('')}>← Ver todas as filiais</button>}
            <p className="xs muted" style={{ marginBottom: 0 }}>Mensalidades são creditadas na chave PIX do professor responsável pela filial; sem chave cadastrada, vão para a Associação. Filiação e demais taxas vão sempre para a Associação.</p>
          </Card>
        );
      })()}

      {tab === 'conferencia' && (
        <Card title="🔎 Comprovantes aguardando conferência">
          {emConferencia.length === 0 ? <Empty icon="✅">Nenhum comprovante aguardando conferência.</Empty> : emConferencia.map((p) => (
            <div key={p.id} className="list-item" style={{ flexWrap: 'wrap' }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{nomeDe(p.pessoaId)}</div>
                <div className="xs muted">{p.descricao} · {filialNome(db, p.filialId)} · enviado em {new Date(p.comprovantes?.at(-1)?.enviadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
              </div>
              <b>{brl(p.valor)}</b>
              <button className="btn sm ok" onClick={() => setConferir(p.id)}>🔎 Conferir</button>
            </div>
          ))}
        </Card>
      )}

      {tab === 'abertos' && (
        <Card>
          {abertos.length === 0 ? <Empty icon="✅">Nenhuma cobrança em aberto.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Pessoa</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {abertos.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{nomeDe(p.pessoaId)}<div className="xs muted">{filialNome(db, p.filialId)}</div></td>
                      <td>{p.descricao}<div className="xs muted">{TIPO[p.tipo]}</div></td>
                      <td>{fmtDate(p.vencimento)}</td>
                      <td className="nowrap">{brl(p.valor)}</td>
                      <td><StatusBadge status={p.vencimento < hoje ? 'vencido' : 'pendente'} /> <SeloComprovante p={p} /></td>
                      <td className="nowrap">
                        <button className={`btn sm ${p.analise === 'enviado' ? 'ok' : 'ghost'}`} title="Conferir comprovante e auditoria" onClick={() => setConferir(p.id)}>{p.comprovantes?.length ? '👁 Ver comprovante' : '🔎 Conferir'}</button>{' '}
                        <button className="btn sm ok" onClick={() => confirmar(p, 'pix')}>✔ Confirmar</button>{' '}
                        <button className="btn sm ghost" title="Recebido em mãos" onClick={() => confirmar(p, 'dinheiro')}>💵</button>{' '}
                        <button className="btn sm ghost" title="Lembrete WhatsApp" onClick={() => lembrete(p)}>📲</button>{' '}
                        <button className="btn sm ghost" title="QR PIX" onClick={() => setPix(p)}>▦</button>{' '}
                        {isAdmin && <button className="btn sm ghost" title="Excluir" onClick={() => ask('Excluir esta cobrança?', () => setDB((d) => { d.pagamentos = d.pagamentos.filter((x) => x.id !== p.id); }), 'Excluir')}>🗑</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'pagos' && (
        <Card actions={<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ maxWidth: 180 }} />} title="Pagamentos confirmados">
          {pagosMes.length === 0 ? <Empty icon="🧾">Nenhum recebimento neste mês.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Pessoa</th><th>Descrição</th><th>Pago em</th><th>Método</th><th>Valor</th><th>Confirmado por</th><th>Comprovante</th></tr></thead>
                <tbody>
                  {pagosMes.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{nomeDe(p.pessoaId)}</td>
                      <td>{p.descricao}</td>
                      <td>{fmtDate(p.pagoEm)}</td>
                      <td>{p.metodo === 'dinheiro' ? 'Em mãos' : p.metodo === 'isencao' ? <SeloComprovante p={p} /> : p.metodo?.toUpperCase()}</td>
                      <td>{brl(p.valor)}</td>
                      <td className="small">{p.confirmadoPor}</td>
                      <td className="nowrap"><button className="btn sm ghost" onClick={() => setConferir(p.id)}>{p.comprovantes?.length ? `📎 ${p.comprovantes.length}` : '🧾'} Auditoria</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'isencoes' && (
        <Card title="Isenções individuais">
          {alunosEscopo.map((a) => (
            <label key={a.id} className="list-item check">
              <input type="checkbox" checked={!!a.isento} disabled={!!a.isentoPor} onChange={(e) => setDB((d) => { const x = d.alunos.find((y) => y.id === a.id); x.isento = e.target.checked; if (e.target.checked) notify(d, a.id, 'Isenção concedida', 'Você está isento(a) da mensalidade.'); })} />
              <div className="grow">{a.nome}<div className="xs muted">{filialNome(db, a.filialId)}{a.isentoPor ? ` · ${a.isentoMotivo || 'Plano família'}` : ''}</div></div>
              {a.isento && <span className="badge gold">{a.isentoPor ? '👨‍👩‍👧 Família' : 'Isento'}</span>}
            </label>
          ))}
          {alunosEscopo.length === 0 && <Empty>Nenhum aluno.</Empty>}
        </Card>
      )}

      {tab === 'planos' &&
        (filial ? (
          <PlanosFilialEditor key={filial} filial={db.filiais.find((x) => x.id === filial)} />
        ) : (
          <Card><Empty icon="🏯">Selecione uma filial no seletor acima para configurar as modalidades, o pacote e os combos família.</Empty></Card>
        ))}

      {tab === 'professores' && isAdmin && (
        <Card title="Filiação anual dos professores (à vista, 3x ou 6x)">
          {db.professores.map((p) => (
            <div key={p.id} className="list-item" style={{ flexWrap: 'wrap' }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{p.titulo} {p.nome}</div>
                <div className="xs muted">{filialNome(db, p.filialId)}</div>
              </div>
              {professorEmDia(p) ? <span className="badge ok">Em dia até {fmtDate(p.filiacaoValidaAte)}</span> : <span className="badge red">Vencida</span>}
              {(() => {
                const pl = planoFiliacao(db, p.planoFiliacao);
                const abertas = db.pagamentos.filter((x) => x.pessoaId === p.id && x.tipo === 'filiacao' && x.status === 'pendente');
                return (
                  <>
                    <span className="badge">{pl ? pl.nome : 'Sem plano'}{p.renovacaoAutomatica !== false && pl ? ' · 🔁' : ''}</span>
                    {abertas.length > 0 ? (
                      <>
                        <span className="badge warn">{abertas.length} parcela(s) em aberto</span>
                        <button className="btn sm ghost" onClick={() => ask(`Cancelar as ${abertas.length} parcela(s) em aberto de ${p.nome}?`, () => setDB((d) => { const ids = new Set(abertas.map((x) => x.id)); d.pagamentos = d.pagamentos.filter((x) => !ids.has(x.id)); }), 'Cancelar parcelas')}>Cancelar parcelas</button>
                      </>
                    ) : (
                      <select defaultValue="" style={{ maxWidth: 240 }} onChange={(e) => { const id = e.target.value; e.target.value = ''; if (id) setDB((d) => { if (gerarFiliacao(d, p.id, id)) toast('Cobrança de filiação gerada.'); }); }}>
                        <option value="">Gerar cobrança…</option>
                        {db.config.planosFiliacao.map((x) => { const dv = divisaoFiliacao(db, p, x); return <option key={x.id} value={x.id}>{x.parcelas === 1 ? `${x.nome} — ${brl(dv.total)}` : `${x.nome} — ${x.parcelas}x de ${brl(dv.valorParcela)}`}{dv.n > 1 ? ` (÷${dv.n} responsáveis)` : ""}</option>; })}
                      </select>
                    )}
                  </>
                );
              })()}
            </div>
          ))}
          {db.professores.length === 0 && <Empty>Nenhum professor.</Empty>}
        </Card>
      )}

      {tab === 'pix' && isAdmin && (
        <div className="grid g2">
          <Card title="QR Code PIX (valor livre)"><PixBox descricao="Mao Quan Kung Fu" /></Card>
          <Card title="Tabela de valores e pacotes">
            {db.precos.map((p) => (
              <div key={p.id} className="list-item">
                <div className="grow"><div style={{ fontWeight: 600 }}>{p.nome}</div><div className="xs muted">{p.descricao}</div></div>
                <b>{brl(p.valor)}</b>
              </div>
            ))}
            <p className="xs muted">Edite valores em Configurações.</p>
          </Card>
        </div>
      )}

      <Modal open={retro} onClose={() => setRetro(false)} title="Cobrar meses anteriores" wide>
        {retro && <CobrancaRetroativa user={user} alunos={alunosEscopo} onFeito={() => (setRetro(false), setTab('abertos'))} />}
      </Modal>

      <Modal open={!!conferir} onClose={() => setConferir(null)} title="Conferência e auditoria do pagamento" wide>
        {conferir && (() => {
          const p = db.pagamentos.find((x) => x.id === conferir);
          // Ninguém confere o próprio pagamento (o professor-praticante é conferido por outro professor ou pela Central)
          const proprio = p && [user.id, db.alunos.find((a) => (a.email || '').toLowerCase() === (user.email || '').toLowerCase())?.id].includes(p.pessoaId);
          return (
            <>
              {proprio && !isAdmin && <div className="alert gold small mb">Este pagamento é seu — a conferência deve ser feita por outro professor da filial ou pela Central.</div>}
              <ConferenciaPagamento pagamentoId={conferir} user={user} nomePessoa={nomeDe(p?.pessoaId)} podeDecidir={isAdmin || !proprio} onFeito={() => setConferir(null)} />
            </>
          );
        })()}
      </Modal>

      <Modal open={!!pix} onClose={() => setPix(null)} title="Cobrança PIX">
        {pix && <PixBox valor={pix.valor} descricao={pix.descricao} txid={pix.id} filialId={pix.tipo === 'mensalidade' ? pix.filialId : undefined} />}
      </Modal>

      <Modal
        open={!!novo}
        onClose={() => setNovo(null)}
        title="Novo lançamento"
        footer={
          <button
            className="btn"
            onClick={() => {
              if (!novo.pessoaId || !novo.valor) return toast('Informe a pessoa e o valor.');
              setDB((d) => {
                const pessoa = d.alunos.find((a) => a.id === novo.pessoaId) || d.professores.find((p) => p.id === novo.pessoaId);
                d.pagamentos.push({ ...novo, id: uid('pg'), valor: +novo.valor, filialId: pessoa.filialId, competencia: novo.vencimento.slice(0, 7), descricao: novo.descricao || TIPO[novo.tipo], status: 'pendente', criadoEm: new Date().toISOString(), lembretes: [] });
                notify(d, novo.pessoaId, 'Nova cobrança', `${novo.descricao || TIPO[novo.tipo]} — ${brl(novo.valor)}`);
              });
              setNovo(null);
              toast('Lançamento criado.');
            }}
          >
            Criar cobrança
          </button>
        }
      >
        {novo && (
          <div className="form-grid">
            <Field label="Tipo">
              <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
                {Object.entries(TIPO).filter(([k]) => k !== 'filiacao' && (isAdmin || ['mensalidade', 'outro'].includes(k))).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Pessoa">
              <select value={novo.pessoaId} onChange={(e) => setNovo({ ...novo, pessoaId: e.target.value })}>
                <option value="">Selecione…</option>
                {alunosEscopo.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Field>
            <Field label="Valor (R$)"><input type="number" min="0" step="0.01" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} /></Field>
            <Field label="Vencimento"><input type="date" value={novo.vencimento} onChange={(e) => setNovo({ ...novo, vencimento: e.target.value })} /></Field>
            <Field label="Descrição"><input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}
