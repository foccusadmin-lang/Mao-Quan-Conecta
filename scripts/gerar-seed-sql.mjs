// Gera o SQL da configuração inicial a partir de src/lib/seed.js (mesmos dados do app)
import { seed } from '../src/lib/seed.js';
const s = seed();
const q = (v) => "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
const linhas = [];
for (const k of ['config', 'termos', 'institucional', 'modelos', 'diretoria', 'precos'])
  linhas.push(`insert into public.app_config (id, data) values ('${k}', ${q(s[k])}) on conflict (id) do nothing;`);
for (const c of ['filiais', 'materiais', 'eventos', 'comunicados'])
  for (const r of s[c]) linhas.push(`insert into public.${c} (id, data) values ('${r.id}', ${q(r)}) on conflict (id) do nothing;`);
process.stdout.write(linhas.join('\n'));
