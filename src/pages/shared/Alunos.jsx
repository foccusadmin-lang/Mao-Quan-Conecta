import { useState } from 'react';
import { useDB, setDB, notify, situacaoAluno, frequencia, filialNome, faixaNome, promoverAProfessor, RECURSOS_PROF, recursosPadrao, liberarAluno, perfilDoEmail } from '../../lib/db';
import { fmtDate, todayISO, brl, maskCPF, maskRG } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Inp, Avatar, PhotoInput, Faixa, Tabs, StatusBadge, useConfirm, toast, Empty, Search, FaixaOptions } from '../../components/ui';
import { AttendanceChart } from '../../components/shared';

export default function Alunos({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [filtro, setFiltro] = useState('aprovado');
  const [filial, setFilial] = useState(isAdmin ? '' : user.filialId);
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(null);
  const [novo, setNovo] = useState(null);
  const [ask, confirmEl] = useConfirm();

  const liberar = () => {
    const email = (novo.email || '').trim().toLowerCase();
    if (!novo.nome.trim() || !/^\S+@\S+\.\S+$/.test(email)) return toast('Informe o nome e um e-mail Google válido.');
    if (!novo.filialId) return toast('Selecione a filial.');
    const uso = perfilDoEmail(db, email);
    if (uso) return toast(`Este e-mail já está cadastrado como ${uso === 'admin' ? 'Administrador' : uso === 'professor' ? 'Professor' : 'Aluno'}.`);
    setDB((d) => void liberarAluno(d, { ...novo, nome: novo.nome.trim(), email }, user.nome));
    setNovo(null);
    toast('Acesso liberado! O aluno já entra direto no painel com essa conta Google.');
  };

  if (!isAdmin && !user.filialId) return <Empty icon="🏯">Você ainda não foi vinculado a uma filial. Fale com o Administrador Geral.</Empty>;

  const base = db.alunos.filter((a) => !filial || a.filialId === filial);
  const lista = base
    .filter((a) => filtro === 'todos' || a.status === filtro || (filtro === 'atletas' && a.atleta?.ativo))
    .filter((a) => (a.nome + a.email + (a.matricula || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const setStatus = (a, status) =>
    setDB((d) => {
      const x = d.alunos.find((y) => y.id === a.id);
      x.status = status;
      if (status === 'aprovado') {
        x.aprovadoEm ||= todayISO();
        notify(d, a.id, 'Cadastro aprovado! 🥋', 'Bem-vindo(a) à Associação Mao Quan Kung Fu Wushu.');
      }
    });

  const cont = (s) => base.filter((a) => (s === 'atletas' ? a.atleta?.ativo : s === 'todos' || a.status === s)).length;

  return (
    <>
      <PageHead title={isAdmin ? 'Alunos & Prontuários' : 'Alunos da Filial'} sub={isAdmin ? 'Histórico único de alunos e atletas' : filialNome(db, user.filialId)}>
        <Search value={q} onChange={setQ} placeholder="Nome, e-mail ou matrícula" />
        {isAdmin && (
          <select value={filial} onChange={(e) => setFilial(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Todas as filiais</option>
            {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
        <button className="btn" onClick={() => setNovo({ nome: '', email: '', telefone: '', filialId: isAdmin ? filial || '' : user.filialId, faixaIdx: 0 })}>+ Liberar acesso de aluno</button>
      </PageHead>
      <Tabs
        tabs={[['aprovado', `Ativos (${cont('aprovado')})`], ['pendente', `Pendentes (${cont('pendente')})`], ['atletas', `Atletas (${cont('atletas')})`], ['inativo', `Inativos (${cont('inativo')})`], ['todos', `Todos (${cont('todos')})`]]}
        value={filtro}
        onChange={setFiltro}
      />

      <Card>
        {lista.length === 0 ? (
          <Empty>Nenhum aluno encontrado.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Aluno</th>{isAdmin && <th className="hide-sm">Filial</th>}<th>Graduação</th><th className="hide-sm">Frequência</th><th>Situação</th><th></th></tr>
              </thead>
              <tbody>
                {lista.map((a) => {
                  const fin = situacaoAluno(db, a);
                  const fr = a.status === 'aprovado' ? frequencia(db, a) : null;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <Avatar src={a.foto} name={a.nome} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{a.nome} {a.atleta?.ativo && <span title="Atleta">🏆</span>} {a.saude?.restricoes && <span title="Restrição médica">⚕️</span>}</div>
                            <div className="xs muted">{a.matricula} · {a.email}</div>
                          </div>
                        </div>
                      </td>
                      {isAdmin && <td className="hide-sm">{filialNome(db, a.filialId)}</td>}
                      <td><Faixa idx={a.faixaIdx} /></td>
                      <td className="hide-sm">{fr ? <span className={`badge ${fr.ok ? 'ok' : 'red'}`}>{fr.pct}%</span> : '—'}</td>
                      <td>
                        {a.status === 'aprovado' && !a.ultimoAcesso && !a.termos ? <span className="badge" title="Acesso liberado — ainda não entrou no app">⏳ Aguardando 1º acesso</span> : a.status !== 'aprovado' ? <StatusBadge status={a.status} /> : a.isento ? <span className="badge gold">Isento</span> : fin.bloqueado ? <span className="badge red">Bloqueado</span> : <span className="badge ok">Em dia</span>}
                      </td>
                      <td className="nowrap">
                        {a.status === 'pendente' && (
                          <>
                            <button className="btn sm ok" onClick={() => setStatus(a, 'aprovado')}>Aprovar</button>{' '}
                            <button className="btn sm ghost" onClick={() => ask(`Recusar o cadastro de ${a.nome}?`, () => setStatus(a, 'recusado'), 'Recusar')}>Recusar</button>{' '}
                          </>
                        )}
                        <button className="btn sm dark" onClick={() => setAberto(a.id)}>Abrir</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {aberto && <AlunoModal id={aberto} user={user} onClose={() => setAberto(null)} ask={ask} />}
      <Modal open={!!novo} onClose={() => setNovo(null)} title="Liberar acesso de aluno" footer={<button className="btn" onClick={liberar}>Liberar acesso</button>}>
        {novo && (
          <div className="col">
            <div className="alert gold small">
              <div>Cadastre a <b>conta Google (Gmail)</b> do aluno. No primeiro login com esse e-mail ele entra direto na Área do Aluno — sem precisar de aprovação. Se um dia for promovido a professor, o mesmo e-mail passa a abrir o Painel do Laoshi.</div>
            </div>
            <div className="form-grid">
              <Field label="Nome completo"><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoFocus /></Field>
              <Field label="E-mail Google do aluno"><input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} placeholder="aluno@gmail.com" /></Field>
              <Field label="WhatsApp"><input type="tel" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} placeholder="(11) 90000-0000" /></Field>
              {isAdmin ? (
                <Field label="Filial">
                  <select value={novo.filialId} onChange={(e) => setNovo({ ...novo, filialId: e.target.value })}>
                    <option value="">Selecione…</option>
                    {db.filiais.filter((f) => f.ativa).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Filial"><input value={filialNome(db, user.filialId)} disabled /></Field>
              )}
              <Field label="Graduação atual">
                <select value={novo.faixaIdx} onChange={(e) => setNovo({ ...novo, faixaIdx: +e.target.value })}><FaixaOptions /></select>
              </Field>
            </div>
          </div>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}

function AlunoModal({ id, user, onClose, ask }) {
  const db = useDB();
  const a = db.alunos.find((x) => x.id === id);
  const [tab, setTab] = useState('cadastro');
  const [f, setF] = useState(() => structuredClone(a));
  const [nota, setNota] = useState({ desempenho: 3, disciplina: 3, wude: 3, obs: '' });
  const [promo, setPromo] = useState(null);
  const isAdmin = user.role === 'admin';
  if (!a) return null;
  const fin = situacaoAluno(db, a);
  const fr = frequencia(db, a);

  const salvar = () => {
    setDB((d) => {
      const x = d.alunos.find((y) => y.id === id);
      const antes = x.atleta?.ativo;
      Object.assign(x, { ...f, tecnico: x.tecnico, historicoGraduacao: x.historicoGraduacao });
      if (!antes && f.atleta?.ativo) notify(d, id, 'Você foi convocado(a) como Atleta 🏆', `Polo: ${f.atleta.polo || '—'}. Acesse a aba Atleta e assine o termo.`);
    });
    toast('Aluno salvo.');
  };
  const addNota = () => {
    if (!nota.obs.trim()) return toast('Escreva uma observação.');
    setDB((d) => d.alunos.find((y) => y.id === id).tecnico.unshift({ ...nota, data: new Date().toISOString(), autor: user.nome }));
    setNota({ desempenho: 3, disciplina: 3, wude: 3, obs: '' });
    toast('Registro técnico adicionado.');
  };
  const pags = db.pagamentos.filter((p) => p.pessoaId === id).sort((x, y) => y.vencimento.localeCompare(x.vencimento));

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={a.nome}
      footer={
        <>
          {isAdmin && <button className="btn ghost" style={{ color: 'var(--red)', marginRight: 'auto' }} onClick={() => ask(`Excluir ${a.nome} definitivamente?`, () => (setDB((d) => { d.alunos = d.alunos.filter((y) => y.id !== id); }), onClose()), 'Excluir')}>Excluir</button>}
          <button className="btn ghost" onClick={() => (setTab('ficha'), setTimeout(() => window.print(), 150))}>🖨 Ficha A4</button>
          {['cadastro', 'saude'].includes(tab) && <button className="btn" onClick={salvar}>Salvar</button>}
        </>
      }
    >
      <Tabs tabs={[['cadastro', 'Cadastro'], ['saude', '⚕️ Prontuário médico'], ['tecnico', '🥋 Evolução técnica (Wu De)'], ['frequencia', '✅ Frequência'], ['financeiro', '💳 Financeiro'], ['ficha', '📄 Ficha A4']]} value={tab} onChange={setTab} />

      {tab === 'cadastro' && (
        <div className="col">
          <PhotoInput value={f.foto} name={f.nome} onChange={(v) => setF({ ...f, foto: v })} />
          <div className="form-grid">
            <Field label="Nome"><Inp obj={f} set={setF} k="nome" /></Field>
            <Field label="E-mail (Google)"><Inp obj={f} set={setF} k="email" type="email" disabled={!isAdmin} /></Field>
            <Field label="Telefone"><Inp obj={f} set={setF} k="telefone" type="tel" /></Field>
            <Field label="Nascimento"><Inp obj={f} set={setF} k="nascimento" type="date" /></Field>
            <Field label="RG"><input value={f.rg || ''} onChange={(e) => setF({ ...f, rg: maskRG(e.target.value) })} placeholder="00.000.000-0" /></Field>
            <Field label="CPF"><input value={f.cpf || ''} inputMode="numeric" onChange={(e) => setF({ ...f, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" /></Field>
            <Field label="Responsável"><Inp obj={f} set={setF} k="responsavel" /></Field>
            <Field label="Matrícula"><Inp obj={f} set={setF} k="matricula" disabled={!isAdmin} /></Field>
            {isAdmin && (
              <Field label="Filial">
                <select value={f.filialId || ''} onChange={(e) => setF({ ...f, filialId: e.target.value })}>
                  {db.filiais.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </Field>
            )}
            <Field label="Graduação atual" hint={isAdmin ? '' : 'Alterada via aprovação de exame'}>
              <select value={f.faixaIdx} disabled={!isAdmin} onChange={(e) => setF({ ...f, faixaIdx: +e.target.value })}>
                <FaixaOptions />
              </select>
            </Field>
            <Field label="Situação do cadastro">
              <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, aprovadoEm: f.aprovadoEm || (e.target.value === 'aprovado' ? todayISO() : undefined) })}>
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="inativo">Inativo</option>
                <option value="recusado">Recusado</option>
              </select>
            </Field>
          </div>
          <div className="card" style={{ background: '#faf8f6' }}>
            <div className="col">
              <label className="check"><Inp obj={f} set={setF} k="isento" type="checkbox" /> Isento de mensalidade (bolsista)</label>
              <label className="check"><Inp obj={f} set={setF} k="atleta.ativo" type="checkbox" /> Promover a Atleta de Competição</label>
              {f.atleta?.ativo && (
                <Field label="Polo / Equipe">
                  <select value={f.atleta.polo || ''} onChange={(e) => setF({ ...f, atleta: { ...f.atleta, polo: e.target.value } })}>
                    <option value="">Selecione…</option>
                    {db.config.polos.filter(Boolean).map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
              )}
              {isAdmin && <label className="check"><Inp obj={f} set={setF} k="habilitadoCampeonato" type="checkbox" /> Habilitado para campeonatos da Liga</label>}
            </div>
          </div>
          {isAdmin && (() => {
            const prof = db.professores.find((p) => p.email.toLowerCase() === a.email.toLowerCase());
            return prof ? (
              <div className="alert ok small">🎖️ <div>Esta conta Google já é <b>{prof.titulo}</b> — ao entrar, abre o Painel do Professor. Ajuste os recursos em Professores.</div></div>
            ) : (
              <button type="button" className="btn dark" onClick={() => setPromo({ titulo: 'Laoshi', filialId: a.filialId || '', recursos: recursosPadrao() })}>
                🎖️ Promover a Professor (Laoshi)
              </button>
            );
          })()}
          <Modal
            open={!!promo}
            onClose={() => setPromo(null)}
            title={`Promover ${a.nome} a Professor`}
            footer={
              <button
                className="btn"
                onClick={() => {
                  setDB((d) => promoverAProfessor(d, a.id, promo));
                  setPromo(null);
                  toast('Promovido! A conta Google agora abre o Painel do Professor.');
                }}
              >
                Confirmar promoção
              </button>
            }
          >
            {promo && (
              <div className="col">
                <div className="alert gold small"><div>A conta Google <b>{a.email}</b> passará a abrir o Painel do Professor, com os recursos marcados abaixo. O histórico de aluno é mantido.</div></div>
                <div className="form-grid">
                  <Field label="Título">
                    <select value={promo.titulo} onChange={(e) => setPromo({ ...promo, titulo: e.target.value })}>
                      {['Laoshi', 'Jiàoliàn', 'Zhùjiào', 'Jiǎngshī', 'Shifu'].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Filial designada">
                    <select value={promo.filialId} onChange={(e) => setPromo({ ...promo, filialId: e.target.value })}>
                      <option value="">— Nenhuma —</option>
                      {db.filiais.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                  </Field>
                </div>
                <b className="small">Recursos liberados no painel</b>
                <div className="grid g2" style={{ gap: 8 }}>
                  {RECURSOS_PROF.map(([k, label]) => (
                    <label key={k} className="check">
                      <input type="checkbox" checked={promo.recursos[k]} onChange={(e) => setPromo({ ...promo, recursos: { ...promo.recursos, [k]: e.target.checked } })} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Modal>
          <div className="xs muted">
            Termos: {a.termos ? `assinados em ${fmtDate(a.termos.data)} (v${a.termos.versao})` : 'não assinados'} · Cadastro em {fmtDate(a.criadoEm)}
          </div>
        </div>
      )}

      {tab === 'saude' && (
        <div className="form-grid">
          <Field label="Tipo sanguíneo"><Inp obj={f} set={setF} k="saude.tipoSanguineo" placeholder="Ex.: O+" /></Field>
          <Field label="Medicamentos de uso contínuo"><Inp obj={f} set={setF} k="saude.medicamentos" /></Field>
          <Field label="Alergias"><Inp obj={f} set={setF} k="saude.alergias" type="textarea" /></Field>
          <Field label="Histórico de lesões"><Inp obj={f} set={setF} k="saude.lesoes" type="textarea" /></Field>
          <Field label="Restrições médicas" style={{ gridColumn: '1/-1' }}><Inp obj={f} set={setF} k="saude.restricoes" type="textarea" /></Field>
          <Field label="Contato de emergência — nome"><Inp obj={f} set={setF} k="saude.emergenciaNome" /></Field>
          <Field label="Contato de emergência — telefone"><Inp obj={f} set={setF} k="saude.emergenciaTel" type="tel" /></Field>
        </div>
      )}

      {tab === 'tecnico' && (
        <div className="col">
          <div className="card" style={{ background: '#faf8f6' }}>
            <div className="form-grid">
              {[['desempenho', 'Desempenho técnico'], ['disciplina', 'Disciplina'], ['wude', 'Conduta (Wu De)']].map(([k, l]) => (
                <Field key={k} label={`${l}: ${'★'.repeat(nota[k])}${'☆'.repeat(5 - nota[k])}`}>
                  <input type="range" min="1" max="5" value={nota[k]} onChange={(e) => setNota({ ...nota, [k]: +e.target.value })} />
                </Field>
              ))}
            </div>
            <Field label="Observações" style={{ marginTop: 10 }}>
              <textarea value={nota.obs} onChange={(e) => setNota({ ...nota, obs: e.target.value })} placeholder="Evolução, pontos a reforçar, conduta…" />
            </Field>
            <div className="row end mt"><button className="btn" onClick={addNota}>Registrar</button></div>
          </div>
          {a.tecnico.length === 0 && <Empty icon="📝">Nenhum registro técnico.</Empty>}
          {a.tecnico.map((t, i) => (
            <div key={i} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="row small">
                  <span className="badge">Técnica {t.desempenho}/5</span>
                  <span className="badge">Disciplina {t.disciplina}/5</span>
                  <span className="badge gold">Wu De {t.wude}/5</span>
                </div>
                <div style={{ marginTop: 4 }}>{t.obs}</div>
                <div className="xs muted">{t.autor} · {fmtDate(t.data)}</div>
              </div>
            </div>
          ))}
          {a.historicoGraduacao?.length > 0 && (
            <Card title="🎖️ Histórico de graduações">
              {a.historicoGraduacao.map((h, i) => <div key={i} className="small">{fmtDate(h.data)} — {faixaNome(db, h.faixaIdx)}</div>)}
            </Card>
          )}
        </div>
      )}

      {tab === 'frequencia' && (
        <div className="col">
          <div className="grid g4">
            <div className="card stat ok"><div className="v">{fr.pct}%</div><div className="l">Frequência (90 dias)</div></div>
            <div className="card stat ink"><div className="v">{fr.presentes}</div><div className="l">Presenças</div></div>
            <div className="card stat red"><div className="v">{fr.faltas}</div><div className="l">Faltas (máx. {fr.maxFaltas})</div></div>
            <div className="card stat gold"><div className="v">{fr.min}%</div><div className="l">Mínimo p/ exame</div></div>
          </div>
          <Card title="Presenças por mês"><AttendanceChart alunoId={id} /></Card>
          <div className={`alert ${fr.ok ? 'ok' : 'red'}`}>{fr.ok ? '✅ Frequência suficiente para a pré-avaliação de exame.' : '⛔ Frequência abaixo do mínimo — não habilitado para o pré-exame.'}</div>
        </div>
      )}

      {tab === 'financeiro' && (
        <div className="col">
          <div className={`alert ${fin.bloqueado ? 'red' : 'ok'}`}>{a.isento ? '🎓 Aluno isento de mensalidade.' : fin.bloqueado ? '⛔ Bloqueado por inadimplência: material didático e exames suspensos.' : '✅ Situação financeira regular.'}</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {pags.map((p) => (
                  <tr key={p.id}><td>{p.descricao}</td><td>{fmtDate(p.vencimento)}</td><td>{brl(p.valor)}</td><td><StatusBadge status={p.status === 'pendente' && p.vencimento < todayISO() ? 'vencido' : p.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {pags.length === 0 && <Empty icon="🧾">Sem lançamentos.</Empty>}
        </div>
      )}

      {tab === 'ficha' && <FichaA4 a={a} fr={fr} />}
    </Modal>
  );
}

function FichaA4({ a, fr }) {
  const db = useDB();
  const s = a.saude || {};
  return (
    <div className="a4 print-area">
      <div className="row between" style={{ borderBottom: '3px solid var(--red)', paddingBottom: 10 }}>
        <div className="row">
          <img src="./logo.webp" alt="" style={{ width: 64 }} />
          <div>
            <h2 style={{ margin: 0 }}>Mao Quan Kung Fu Wushu</h2>
            <div className="small">Ficha cadastral do aluno</div>
          </div>
        </div>
        <Avatar src={a.foto} name={a.nome} size="lg" />
      </div>
      <div className="sec">
        <h4>Identificação</h4>
        <div className="kv">
          <div><b>Nome:</b> {a.nome}</div>
          <div><b>Matrícula:</b> {a.matricula}</div>
          <div><b>Nascimento:</b> {fmtDate(a.nascimento)}</div>
          <div><b>RG:</b> {a.rg || '—'}</div>
          <div><b>CPF:</b> {a.cpf || '—'}</div>
          <div><b>Telefone:</b> {a.telefone || '—'}</div>
          <div><b>E-mail:</b> {a.email}</div>
          <div><b>Responsável:</b> {a.responsavel || '—'}</div>
          <div><b>Filial:</b> {filialNome(db, a.filialId)}</div>
          <div><b>Graduação:</b> {faixaNome(db, a.faixaIdx)}</div>
        </div>
      </div>
      <div className="sec">
        <h4>Prontuário médico</h4>
        <div className="kv">
          <div><b>Tipo sanguíneo:</b> {s.tipoSanguineo || '—'}</div>
          <div><b>Medicamentos:</b> {s.medicamentos || '—'}</div>
          <div><b>Alergias:</b> {s.alergias || '—'}</div>
          <div><b>Lesões:</b> {s.lesoes || '—'}</div>
          <div style={{ gridColumn: '1/-1' }}><b>Restrições:</b> {s.restricoes || '—'}</div>
          <div><b>Emergência:</b> {s.emergenciaNome || '—'}</div>
          <div><b>Tel. emergência:</b> {s.emergenciaTel || '—'}</div>
        </div>
      </div>
      <div className="sec">
        <h4>Frequência e evolução</h4>
        <div className="kv">
          <div><b>Frequência (90 dias):</b> {fr.pct}% ({fr.presentes} presenças / {fr.faltas} faltas)</div>
          <div><b>Pré-exame:</b> {a.preExame ? (a.preExame.status === 'apto' ? 'Apto' : 'Necessita reforço') : '—'}</div>
        </div>
        {a.tecnico.slice(0, 3).map((t, i) => (
          <div key={i} className="small" style={{ marginTop: 4 }}>• {fmtDate(t.data)} — Téc. {t.desempenho}/5 · Disc. {t.disciplina}/5 · Wu De {t.wude}/5 — {t.obs}</div>
        ))}
      </div>
      <div className="sec">
        <h4>Termos</h4>
        <div className="small">{a.termos ? `Termos de imagem, regulamento e compromisso Wu De assinados digitalmente por “${a.termos.assinatura}” em ${fmtDate(a.termos.data)}.` : 'Termos ainda não assinados.'}</div>
      </div>
      <div className="row between" style={{ marginTop: 40 }}>
        <div className="center" style={{ borderTop: '1px solid #000', width: '45%', paddingTop: 4 }}>Assinatura do aluno/responsável</div>
        <div className="center" style={{ borderTop: '1px solid #000', width: '45%', paddingTop: 4 }}>Laoshi responsável</div>
      </div>
    </div>
  );
}
