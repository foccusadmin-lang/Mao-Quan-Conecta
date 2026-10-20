import { useState } from 'react';
import { setDB } from '../lib/db';
import { brl, fmtDate, todayISO, waLink } from '../lib/utils';
import { Modal, Empty, toast } from './ui';

/**
 * Lembrete geral de mensalidade vencida pelo WhatsApp.
 * O WhatsApp não permite envio em massa a partir do navegador (só com a API paga do WhatsApp Business),
 * então o disparo é uma fila: cada toque abre a conversa da próxima pessoa com a mensagem pronta.
 * Uma mensagem por pessoa, somando todas as mensalidades vencidas dela.
 */
export function LembreteGeral({ open, onClose, vencidos, nomeDe, telDe, filialDe, chavePix, user }) {
  const hoje = todayISO();
  const [enviadosAgora, setEnviadosAgora] = useState([]);

  // Agrupa por pessoa
  const pessoas = Object.values(
    vencidos.reduce((acc, p) => {
      (acc[p.pessoaId] ||= { id: p.pessoaId, itens: [] }).itens.push(p);
      return acc;
    }, {})
  )
    .map((x) => ({
      ...x,
      nome: nomeDe(x.id),
      tel: (telDe(x.id) || '').replace(/\D/g, ''),
      total: x.itens.reduce((s, p) => s + +p.valor, 0),
      // Já lembrado hoje (por qualquer pessoa da equipe)
      lembradoHoje: x.itens.every((p) => p.lembreteWhats?.em?.startsWith(hoje)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const comTel = pessoas.filter((x) => x.tel.length >= 10);
  const semTel = pessoas.filter((x) => x.tel.length < 10);
  const feito = (x) => enviadosAgora.includes(x.id) || x.lembradoHoje;
  const fila = comTel.filter((x) => !feito(x));

  const mensagem = (x) => {
    const linhas = x.itens.map((p) => `• ${p.descricao} — ${brl(p.valor)} (venceu em ${fmtDate(p.vencimento)})`).join('\n');
    return (
      `Olá, ${x.nome}! Lembrete da Associação Mao Quan Kung Fu Wushu.\n\n` +
      `Consta em aberto:\n${linhas}\n` +
      (x.itens.length > 1 ? `Total: ${brl(x.total)}\n` : '') +
      `\nPIX: ${chavePix(x.itens[0])}\n\n` +
      'Depois de pagar, envie o comprovante pelo app Mao Quan Conecta. Se já pagou, desconsidere esta mensagem. Obrigado!'
    );
  };

  const enviar = (x) => {
    window.open(waLink('55' + x.tel.replace(/^55(?=\d{10,11}$)/, ''), mensagem(x)), '_blank');
    setEnviadosAgora((l) => [...l, x.id]);
    const ids = x.itens.map((p) => p.id);
    const em = new Date().toISOString();
    setDB((d) => d.pagamentos.forEach((p) => ids.includes(p.id) && (p.lembreteWhats = { em, por: user.nome })));
  };

  const proximo = () => {
    if (!fila.length) return toast('Todos os lembretes já foram enviados.');
    enviar(fila[0]);
  };

  return (
    <Modal open={open} onClose={onClose} title="📲 Lembrete geral — mensalidades vencidas" wide>
      {pessoas.length === 0 ? (
        <Empty icon="✅">Ninguém com mensalidade vencida.</Empty>
      ) : (
        <div className="col">
          <div className="card" style={{ background: 'var(--soft, #f6f6f6)', padding: 12 }}>
            <div style={{ fontWeight: 700 }}>
              {comTel.length - fila.length} de {comTel.length} lembretes enviados
              {semTel.length > 0 && <span className="xs muted"> · {semTel.length} sem telefone</span>}
            </div>
            <div style={{ height: 8, background: '#0001', borderRadius: 8, margin: '8px 0', overflow: 'hidden' }}>
              <div style={{ width: `${comTel.length ? ((comTel.length - fila.length) / comTel.length) * 100 : 0}%`, height: '100%', background: 'var(--ok, #1a8f4a)' }} />
            </div>
            <button className="btn ok block" disabled={!fila.length} onClick={proximo}>
              {fila.length ? `▶ Enviar para ${fila[0].nome} (${fila.length} na fila)` : '✅ Todos enviados'}
            </button>
            <div className="xs muted" style={{ marginTop: 6 }}>
              Cada toque abre o WhatsApp com a mensagem pronta: é só tocar em enviar lá e voltar aqui para o próximo.
              Quem já foi lembrado hoje fica marcado e sai da fila.
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Aluno</th><th>Vencidas</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {pessoas.map((x) => (
                  <tr key={x.id} style={{ opacity: feito(x) ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 600 }}>
                      {x.nome}
                      <div className="xs muted">{filialDe(x.itens[0])}{x.tel ? '' : ' · sem telefone cadastrado'}</div>
                    </td>
                    <td className="small">{x.itens.map((p) => <div key={p.id}>{p.descricao} · {fmtDate(p.vencimento)}</div>)}</td>
                    <td className="nowrap">{brl(x.total)}</td>
                    <td className="nowrap">
                      {x.tel.length < 10 ? (
                        <span className="badge">Sem telefone</span>
                      ) : feito(x) ? (
                        <button className="btn sm ghost" title="Enviar de novo" onClick={() => enviar(x)}>✓ Enviado · reenviar</button>
                      ) : (
                        <button className="btn sm ok" onClick={() => enviar(x)}>📲 Enviar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="xs muted">Comprovantes aguardando conferência não entram na lista. O envio automático em massa só é possível com a API paga do WhatsApp Business.</div>
        </div>
      )}
    </Modal>
  );
}
