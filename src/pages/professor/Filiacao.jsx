import { useState } from 'react';
import { useDB, setDB, professorEmDia, gerarFiliacao, planoFiliacao } from '../../lib/db';
import { brl, fmtDate, todayISO } from '../../lib/utils';
import { PageHead, Card, Modal, StatusBadge, toast, useConfirm } from '../../components/ui';
import { PixBox, InvestButton } from '../../components/shared';

const TAG = { avista: 'Melhor custo', '3x': 'Parcelado', '6x': 'Mais flexível' };

export default function Filiacao({ user }) {
  const db = useDB();
  const c = db.config;
  const [pagar, setPagar] = useState(null);
  const [ask, confirmEl] = useConfirm();
  const hoje = todayISO();
  const emDia = professorEmDia(user);
  const minhas = db.pagamentos.filter((p) => p.pessoaId === user.id && p.tipo === 'filiacao');
  const abertas = minhas.filter((p) => p.status === 'pendente').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const historico = [...minhas].sort((a, b) => b.vencimento.localeCompare(a.vencimento));
  const planoAtual = planoFiliacao(db, user.planoFiliacao);

  const escolher = (pl) =>
    ask(
      pl.parcelas === 1
        ? `Gerar a filiação anual à vista de ${brl(pl.valorParcela)}?`
        : `Gerar a filiação anual em ${pl.parcelas} parcelas mensais de ${brl(pl.valorParcela)}? As parcelas são cobradas automaticamente todo mês.`,
      () => {
        setDB((d) => void gerarFiliacao(d, user.id, pl.id));
        toast('Cobrança gerada. Pague a 1ª parcela via PIX e envie o comprovante.');
      },
      'Gerar cobrança'
    );

  return (
    <>
      <PageHead title="Filiação do Professor" sub="Filiação anual com placa personalizada e certificado de alvará de funcionamento" />
      <div className={`alert ${emDia ? 'ok' : 'red'} mb`}>
        <div>
          {emDia ? `✅ Filiação em dia até ${fmtDate(user.filiacaoValidaAte)}.` : '⛔ Filiação / tarifa de manutenção vencida — material didático e estudo próprio bloqueados.'}
          {planoAtual && <> Plano: <b>{planoAtual.nome}</b>.</>}
        </div>
      </div>

      <div className="grid g3">
        {c.planosFiliacao.map((pl) => (
          <Card key={pl.id} className="pad-lg" style={pl.id === 'avista' ? { borderColor: 'var(--red)', borderWidth: 2 } : {}}>
            <span className={`badge ${pl.id === 'avista' ? 'red' : ''}`}>{TAG[pl.id] || 'Plano'}</span>
            {user.planoFiliacao === pl.id && <span className="badge ok" style={{ marginLeft: 6 }}>Seu plano</span>}
            <h3 style={{ marginTop: 10 }}>{pl.nome}</h3>
            <div style={{ fontSize: 30, fontWeight: 800 }}>
              {pl.parcelas > 1 && <span className="small muted">{pl.parcelas}x </span>}
              {brl(pl.valorParcela)}
            </div>
            <div className="small muted">Total anual: {brl(pl.parcelas * pl.valorParcela)}</div>
            <ul className="small" style={{ paddingLeft: 18 }}>
              <li>🏅 Placa personalizada de filial</li>
              <li>📜 Certificado de alvará de funcionamento</li>
              <li>🎬 Acervo técnico e capacitações</li>
              <li>🪪 Carteirinha de Professor Filiado</li>
              {pl.parcelas > 1 && <li>🔁 Parcelas mensais cobradas automaticamente</li>}
            </ul>
            <button className={`btn block ${pl.id === 'avista' ? '' : 'dark'}`} disabled={abertas.length > 0} onClick={() => escolher(pl)}>
              Escolher {pl.parcelas === 1 ? 'à vista' : `${pl.parcelas}x`}
            </button>
          </Card>
        ))}
      </div>
      {abertas.length > 0 && <p className="xs muted">Para trocar de plano, conclua ou peça à Central o cancelamento das parcelas em aberto.</p>}

      {abertas.length > 0 && (
        <Card title="🧾 Parcelas em aberto" className="mt">
          {abertas.map((p, i) => (
            <div key={p.id} className="list-item" style={{ flexWrap: 'wrap' }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{p.descricao}</div>
                <div className="xs muted">Vencimento {fmtDate(p.vencimento)}</div>
              </div>
              <b>{brl(p.valor)}</b>
              <StatusBadge status={p.vencimento < hoje ? 'vencido' : 'pendente'} />
              <button className={`btn sm ${i === 0 ? '' : 'ghost'}`} onClick={() => setPagar(p)}>Pagar</button>
            </div>
          ))}
          <p className="xs muted" style={{ marginBottom: 0 }}>Cada parcela confirmada pela Central estende a validade da filiação proporcionalmente ({planoAtual ? `${12 / planoAtual.parcelas} meses por parcela` : ''}).</p>
        </Card>
      )}

      <div className="grid g2 mt">
        <Card title="🔁 Renovação automática">
          <label className="check">
            <input
              type="checkbox"
              checked={user.renovacaoAutomatica !== false}
              onChange={(e) => setDB((d) => void (d.professores.find((x) => x.id === user.id).renovacaoAutomatica = e.target.checked))}
            />
            <div>
              Renovar automaticamente no mesmo plano
              <div className="xs muted">Um novo ciclo anual é gerado {c.renovacaoDiasAntes ?? 30} dias antes do fim da validade, com lembretes antes e depois de cada vencimento.</div>
            </div>
          </label>
        </Card>
        <Card title="🛍️ Loja Oficial & Incentivo">
          <div className="col">
            {c.lojaOficial ? <a className="btn dark block" href={c.lojaOficial} target="_blank" rel="noreferrer">Ir para a Loja Oficial ↗</a> : <div className="small muted">Link da Loja Oficial ainda não configurado.</div>}
            <InvestButton block />
          </div>
        </Card>
      </div>

      <Card title="Histórico" className="mt">
        {historico.length === 0 && <p className="muted small">Sem lançamentos.</p>}
        {historico.map((p) => (
          <div key={p.id} className="list-item">
            <div className="grow"><div style={{ fontWeight: 600 }}>{p.descricao}</div><div className="xs muted">Vencimento {fmtDate(p.vencimento)}{p.pagoEm && ` · pago em ${fmtDate(p.pagoEm)}`}</div></div>
            <b>{brl(p.valor)}</b> <StatusBadge status={p.status === 'pendente' && p.vencimento < hoje ? 'vencido' : p.status} />
          </div>
        ))}
      </Card>

      <Modal open={!!pagar} onClose={() => setPagar(null)} title={pagar?.descricao}>
        {pagar && (
          <>
            <PixBox valor={pagar.valor} descricao={pagar.descricao} txid={pagar.id} />
            <p className="xs muted center">A liberação ocorre após a confirmação pela Central Mao.</p>
          </>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}
