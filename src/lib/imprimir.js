/**
 * Impressão sem nova janela: monta a página num iframe invisível e chama o diálogo de impressão do navegador
 * (escolha da impressora, todas as páginas ou só algumas). Por não abrir janela, o navegador não bloqueia como pop-up,
 * mesmo depois de alguns segundos gerando as imagens.
 */
export function imprimirHTML(corpo, css = '', titulo = 'Impressão') {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><style>html,body{margin:0;padding:0}${css}</style></head><body>${corpo}</body></html>`);
    doc.close();
    const imgs = [...doc.images];
    Promise.all(imgs.map((im) => (im.complete ? 0 : new Promise((ok) => ((im.onload = ok), (im.onerror = ok))))))
      .then(() => {
        const win = frame.contentWindow;
        const limpar = () => setTimeout(() => frame.remove(), 1000);
        win.addEventListener('afterprint', limpar, { once: true });
        setTimeout(limpar, 120000); // garante a limpeza mesmo sem o evento
        win.focus();
        win.print();
        resolve();
      })
      .catch((e) => (frame.remove(), reject(e)));
  });
}

/** Uma imagem por página A4 inteira (declarações, certificados). orientacao: 'portrait' | 'landscape' */
export function imprimirImagens(imagens, { orientacao = 'portrait', titulo = 'Impressão' } = {}) {
  const [w, h] = orientacao === 'landscape' ? ['297mm', '210mm'] : ['210mm', '297mm'];
  return imprimirHTML(
    imagens.map((src) => `<img src="${src}">`).join(''),
    `@page{size:A4 ${orientacao};margin:0}img{width:${w};height:${h};display:block;break-after:page;page-break-after:always}img:last-child{break-after:auto;page-break-after:auto}`,
    titulo,
  );
}

/**
 * Abre um link (ex.: arquivo do armazenamento) numa nova aba sem ser bloqueado:
 * a aba é aberta no clique e o endereço é preenchido quando ficar pronto.
 */
export async function abrirLinkDepois(obterUrl) {
  const aba = window.open('', '_blank');
  try {
    const url = await obterUrl();
    if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else window.location.href = url;
  } catch (e) {
    aba?.close();
    throw e;
  }
}
