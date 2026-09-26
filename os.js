/* ════════════════════════════════════════════════════════════════════════════
   Command Center — a tela do CEO. Um BI sobre o retrato do Company OS.

   REGRA DA TELA: tudo o que se clica FILTRA. Um clique num badge, numa caixa
   do organograma, numa fila, numa empresa, num nome — entra no filtro cruzado
   (F) e a tela inteira se refaz. Os números vêm do banco (`company_os_meu_retrato`);
   esta tela só recorta e desenha. Nenhuma métrica nasce aqui.

   SEM BIBLIOTECA: o Supabase é REST, login e RPC são `fetch`. O CSP desta
   rota é `script-src 'self'`, e a defesa real está no banco (M378): cada porta
   confere a alçada de quem chama e devolve vazio para quem não tem.
   ════════════════════════════════════════════════════════════════════════════ */
'use strict';

const SUPABASE = 'https://hvkmwdinnfpprhgxpfzw.supabase.co';
const PUBLICA  = 'sb_publishable_13F7-Fl2S6MFmrWTxQFlUg_u4Ihi2T0';
const CHAVE_SESSAO = 'fineapps.os.sessao';

let SESSAO = null;
let RETRATO = null;
let RELOGIO = null;
const PAGINAS = ['inicio', 'aprov', 'avisos', 'status', 'filas', 'paths', 'monitor', 'custos', 'report', 'pedido'];
let ABA = PAGINAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
let GAVETA = null;              // id do item aberto na gaveta de detalhe
const F = {};                   // filtro cruzado: empresa, produto, fila, estado, natureza, quem, tipo, prioridade, pendente, caminho

const $ = (id) => document.getElementById(id);
const num = (n) => new Intl.NumberFormat('pt-BR').format(Number(n) || 0);
const moeda = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const dia = (t) => (t ? new Date(t).toLocaleDateString('pt-BR') : '—');
const hhmm = (t) => (t ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');
const quando = (t) => (t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };

function mostrar(alvo, texto, bom) { alvo.textContent = texto; alvo.className = 'aviso ' + (bom ? 'bom' : 'ruim'); alvo.hidden = false; }

/* ── ícones ────────────────────────────────────────────────────────────────
   Traço simples, desenhado aqui (sem biblioteca: o CSP é script-src 'self').
   Círculo vira caminho para caber num formato só. */
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const ICONES = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  aprovar: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  sino: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  lista: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  org: 'M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-2.5h12V16',
  rota: circ(6, 19, 2.5) + circ(18, 5, 2.5) + 'M8.5 19h8a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7h8',
  pulso: 'M22 12h-4l-3 9L9 3l-3 9H2',
  dinheiro: 'M12 2v20M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  grafico: 'M3 3v18h18M18 17V9M13 17V5M8 17v-3',
  mais: 'M12 5v14M5 12h14',
  sol: circ(12, 12, 4) + 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4',
  lua: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
  tela: 'M3 4h18v12H3zM8 20h8M12 16v4',
  atualizar: 'M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M4 6h16M4 12h16M4 18h16',
  x: 'M18 6 6 18M6 6l12 12',
  filtro: 'M22 3H2l8 9.46V19l4 2v-8.54z',
  alerta: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  certo: circ(12, 12, 10) + 'M8.5 12.5l2.5 2.5 4.5-5',
  relogio: circ(12, 12, 10) + 'M12 6v6l4 2',
  raio: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  escudo: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  medidor: 'M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0',
  externo: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  caixa: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
};
function icone(nome) {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', ICONES[nome] || ''); s.appendChild(p);
  return s;
}
function pintarIcones(raiz) {
  for (const e of (raiz || document).querySelectorAll('[data-icone]')) {
    const nome = e.dataset.icone === 'tema' ? ({ claro: 'sol', escuro: 'lua', sistema: 'tela' })[temaEscolhido()] : e.dataset.icone;
    e.replaceChildren(icone(nome));
  }
}

/* ── tema: claro · escuro · seguir o sistema ─────────────────────────────── */
const CHAVE_TEMA = 'fineapps.os.tema';
const temaEscolhido = () => document.documentElement.getAttribute('data-tema-escolha') || 'sistema';
const sistemaEscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function aplicarTema(escolha) {
  const escuro = escolha === 'escuro' || (escolha === 'sistema' && sistemaEscuro && sistemaEscuro.matches);
  document.documentElement.setAttribute('data-theme', escuro ? 'dark' : 'light');
  document.documentElement.setAttribute('data-tema-escolha', escolha);
  try { localStorage.setItem(CHAVE_TEMA, escolha); } catch { /* sem storage: vale só nesta aba */ }
  for (const b of document.querySelectorAll('.tema-seg button')) b.setAttribute('aria-checked', String(b.dataset.tema === escolha));
  const rot = { claro: 'Tema claro', escuro: 'Tema escuro', sistema: 'Tema do sistema' }[escolha];
  for (const e of document.querySelectorAll('[data-tema-rotulo]')) e.textContent = rot;
  pintarIcones(document);
}
const cicloTema = () => aplicarTema({ sistema: 'claro', claro: 'escuro', escuro: 'sistema' }[temaEscolhido()]);
if (sistemaEscuro) sistemaEscuro.addEventListener('change', () => { if (temaEscolhido() === 'sistema') aplicarTema('sistema'); });
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-tema-ciclo]'); if (c) { cicloTema(); return; }
  const t = e.target.closest('.tema-seg button[data-tema]'); if (t) aplicarTema(t.dataset.tema);
});

/* ── aviso rápido no canto: confirma o que você fez sem mudar de lugar ───── */
function toast(texto, bom = true) {
  const t = el('div', 'toast' + (bom ? '' : ' ruim'));
  t.append(icone(bom ? 'certo' : 'alerta'), el('span', null, texto));
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('saindo'); setTimeout(() => t.remove(), 300); }, 3200);
}

/* ── sessão: sobrevive ao refresh ──────────────────────────────────────────
   O token fica no localStorage deste navegador; "Sair" apaga. Foi decisão do
   CEO em 20/09 ("dou refresh e volta para o login — não rola"). */
function guardarSessao(j) {
  SESSAO = { access_token: j.access_token, refresh_token: j.refresh_token,
             expira_em: Date.now() + (Number(j.expires_in) || 3600) * 1000, user: j.user };
  try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify(SESSAO)); } catch { /* sem storage: fica só em memória */ }
}
function lerSessao() { try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); } catch { return null; } }
function apagarSessao() { SESSAO = null; try { localStorage.removeItem(CHAVE_SESSAO); } catch { /* ok */ } }

async function renovar() {
  if (!SESSAO || !SESSAO.refresh_token) throw new Error('sem sessão');
  const r = await fetch(`${SUPABASE}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: PUBLICA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: SESSAO.refresh_token }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.msg || 'sessão expirada');
  guardarSessao(j);
}

async function rpc(fn, corpo, tentouRenovar) {
  const r = await fetch(`${SUPABASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: PUBLICA, Authorization: `Bearer ${SESSAO.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo || {}),
  });
  if (r.status === 401 && !tentouRenovar) { await renovar(); return rpc(fn, corpo, true); }
  const texto = await r.text();
  if (!r.ok) {
    let msg = texto;
    try { msg = JSON.parse(texto).message || texto; } catch { /* texto cru serve */ }
    throw new Error(msg);
  }
  return texto ? JSON.parse(texto) : null;
}

const TRADUCOES = {
  'Invalid login credentials': 'E-mail ou senha não conferem.',
  'Email not confirmed': 'Esta conta ainda não teve o e-mail confirmado.',
  'Too many requests': 'Muitas tentativas seguidas. Espere um minuto e tente de novo.',
};
const emPortugues = (msg) => { for (const [en, pt] of Object.entries(TRADUCOES)) if (msg.includes(en)) return pt; return msg || 'Não consegui entrar.'; };

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('btn-entrar'); btn.disabled = true; $('erro-login').hidden = true;
  try {
    const r = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: PUBLICA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('email').value.trim(), password: $('senha').value }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(emPortugues(j.error_description || j.msg || j.message || ''));
    guardarSessao(j);
    $('senha').value = '';
    await abrirCasa();
  } catch (err) {
    mostrar($('erro-login'), String(err.message || err), false);
  } finally { btn.disabled = false; }
});

$('sair').addEventListener('click', () => { if (RELOGIO) clearInterval(RELOGIO); apagarSessao(); location.reload(); });
$('atualizar').addEventListener('click', atualizarAgora);
async function atualizarAgora() {
  const b = $('atualizar'); b.classList.add('girando');
  try { await abrirCasa(); toast('Retrato atualizado.'); } catch (e) { toast(String(e.message || e), false); }
  finally { b.classList.remove('girando'); }
}

/* ── abrir a casa ─────────────────────────────────────────────────────────── */
// ⚠ (D-14) A TERCEIRA FILA vem numa chamada PRÓPRIA, e não dentro do retrato.
//    Duas razões: ela tem cadência diferente (o portão registra quando algo
//    acontece, não a cada minuto), e a porta `company_os_meus_avisos` foi
//    DECLARADA em portas_humanas — porta declarada que ninguém abre é teto de
//    advisor inflado por nada, exatamente o que o C6 existe para evitar.
//    As duas saem em paralelo: o tempo de tela é o da mais lenta, não a soma.
let AVISOS = { sem_ciencia: 0, itens: [] }
async function abrirCasa() {
  const [retrato, avisos] = await Promise.all([
    rpc('company_os_meu_retrato'),
    rpc('company_os_meus_avisos').catch(() => null),
  ])
  if (avisos && avisos.itens) AVISOS = avisos
  if (!retrato || !retrato.estrutura) {
    mostrar($('erro-login'), 'Você entrou, mas esta conta não tem alçada declarada no Company OS. Nada aqui é da sua conta.', false);
    apagarSessao();
    $('entrada').hidden = false; $('app').hidden = true;
    return;
  }
  RETRATO = retrato;
  $('entrada').hidden = true; $('app').hidden = false;
  const email = SESSAO.user.email || '';
  $('quem').textContent = `${email} · alçada executiva`;
  $('quem-nome').textContent = email.startsWith('renato') ? 'Renato Correa' : email.split('@')[0];
  $('avatar').textContent = ($('quem-nome').textContent || '?').trim().charAt(0).toUpperCase();
  pintarCarimbo();
  montarSeletores();
  render();
  if (!RELOGIO) { RELOGIO = setInterval(() => { abrirCasa().catch(() => {}); }, 60_000); setInterval(pintarCarimbo, 10_000); }
}
/* "há 40 s" responde se o que você está vendo é de agora; a bolinha fica âmbar
   quando o retrato passa de 3 minutos (a atualização automática falhou). */
function pintarCarimbo() {
  if (!RETRATO) return;
  const s = Math.max(0, Math.round((Date.now() - new Date(RETRATO.gerado_em)) / 1000));
  const txt = s < 60 ? `atualizado há ${s} s` : s < 3600 ? `atualizado há ${Math.round(s / 60)} min` : `retrato de ${quando(RETRATO.gerado_em)}`;
  $('carimbo-txt').textContent = txt;
  $('carimbo').classList.toggle('velho', s > 180);
  $('carimbo').title = `Retrato gerado em ${quando(RETRATO.gerado_em)} · atualiza sozinho a cada minuto`;
}

async function boot() {
  const s = lerSessao();
  if (!s) return;
  SESSAO = s;
  $('entrada').hidden = true; $('app').hidden = false; esqueleto(); mostrarAba();
  try {
    if (!SESSAO.expira_em || SESSAO.expira_em - 60_000 < Date.now()) await renovar();
    await abrirCasa();
  } catch { apagarSessao(); $('entrada').hidden = false; $('app').hidden = true; }
}
function esqueleto() {
  const k = $('kpis-inicio'); k.replaceChildren();
  for (let n = 0; n < 6; n++) { const d = el('div', 'kpi esqueleto'); d.style.height = '6.3rem'; k.appendChild(d); }
  for (const id of ['inicio-aprov', 'inicio-executor', 'inicio-dist', 'inicio-avisos']) {
    const d = el('div', 'esqueleto'); d.style.height = '9rem'; d.style.margin = '0 1.2rem 1.1rem'; $(id).replaceChildren(d);
  }
}

/* ── filtro cruzado ───────────────────────────────────────────────────────── */
const ROTULO_F = { empresa: 'Empresa', produto: 'Produto', fila: 'Fila', estado: 'Status', natureza: 'Natureza', quem: 'Quem abriu',
                   tipo: 'Tipo', prioridade: 'Prioridade', pendente: 'Parado em você', caminho: 'Caminho', squad: 'Squad', executor: 'Executor' };
function alternar(chave, valor) {
  const atual = F[chave];
  const mesmo = Array.isArray(valor) ? JSON.stringify(atual) === JSON.stringify(valor) : atual === valor;
  if (mesmo) delete F[chave]; else F[chave] = valor;
  render();
}
function limpar() { for (const k of Object.keys(F)) delete F[k]; render(); }
$('limpar').addEventListener('click', limpar);
$('f-empresa').addEventListener('change', (e) => { if (e.target.value) F.empresa = e.target.value; else delete F.empresa; delete F.produto; render(); });
$('f-produto').addEventListener('change', (e) => { if (e.target.value) F.produto = e.target.value; else delete F.produto; render(); });

const pendente = (i) => i.aguarda_alcada || i.entrega_aberta || i.estado === 'decision_required';
const aberto = (i) => i.estado !== 'done' && i.estado !== 'cancelled';
const bate = (f, v) => (Array.isArray(f) ? f.includes(v) : f === v);

function passa(i) {
  if (F.empresa && i.empresa !== F.empresa) return false;
  if (F.produto && (i.produto || '— sem produto —') !== F.produto) return false;
  if (F.fila && !bate(F.fila, i.fila)) return false;
  if (F.estado && !bate(F.estado, i.estado)) return false;
  if (F.natureza && i.natureza !== F.natureza) return false;
  if (F.quem && i.quem_abriu !== F.quem) return false;
  if (F.tipo && i.tipo !== F.tipo) return false;
  if (F.prioridade && i.prioridade !== F.prioridade) return false;
  if (F.squad && i.squad !== F.squad) return false;
  if (F.executor && i.executor !== F.executor) return false;
  if (F.pendente && !pendente(i)) return false;
  if (F.caminho) {
    const c = i.caminho || {};
    if (F.caminho === 'limpo' && !c.caminho_limpo) return false;
    if (F.caminho === 'desvio' && !(c.desvios > 0)) return false;
    if (F.caminho === 'nao_classificado' && !(c.nao_classificados > 0)) return false;
  }
  return true;
}
const itens = () => (RETRATO.itens || []).filter(passa);
const todosItens = () => RETRATO.itens || [];

function desenharChips() {
  const c = $('chips'); c.replaceChildren();
  const chaves = Object.keys(F).filter((k) => k !== 'empresa' && k !== 'produto');
  for (const k of chaves) {
    const chip = el('span', 'chip');
    const v = F[k];
    chip.append(el('b', null, ROTULO_F[k] + ':'), document.createTextNode(' ' + (v === true ? 'sim' : Array.isArray(v) ? v.join(' + ') : rotuloEstado(v) || v)));
    const x = el('button', null, '×'); x.title = 'Tirar este filtro'; x.addEventListener('click', () => { delete F[k]; render(); });
    chip.appendChild(x); c.appendChild(chip);
  }
  $('f-empresa').value = F.empresa || '';
  $('f-produto').value = F.produto || '';
  $('f-empresa').classList.toggle('ativo', !!F.empresa);
  $('f-produto').classList.toggle('ativo', !!F.produto);
  $('limpar').hidden = Object.keys(F).length === 0;
}

function montarSeletores() {
  const est = RETRATO.estrutura;
  const emp = $('f-empresa'); const atualE = emp.value;
  emp.replaceChildren(new Option('Todas', ''));
  for (const e of est.empresas || []) emp.appendChild(new Option(e.nome, e.nome));
  emp.value = atualE;
  const prod = $('f-produto'); const atualP = prod.value;
  prod.replaceChildren(new Option('Todos', ''));
  const produtos = (est.produtos || []).filter((p) => !F.empresa || p.empresa === F.empresa);
  for (const p of produtos) prod.appendChild(new Option(p.nome, p.nome));
  prod.appendChild(new Option('— sem produto —', '— sem produto —'));
  prod.value = atualP;

  // formulário de pedido
  const pe = $('p-empresa'); const vE = pe.value;
  pe.replaceChildren(); for (const e of est.empresas || []) pe.appendChild(new Option(e.nome, e.nome));
  pe.value = vE || 'FineApps';
  montarProdutosDoPedido();

  // report
  const rf = $('r-fila'); const vF = rf.value;
  rf.replaceChildren(new Option('Todas', '')); for (const f of est.filas || []) rf.appendChild(new Option(f.nome, f.nome)); rf.value = vF;
  const rq = $('r-quem'); const vQ = rq.value;
  rq.replaceChildren(new Option('Todos', ''));
  for (const q of [...new Set(todosItens().map((i) => i.quem_abriu).filter(Boolean))].sort()) rq.appendChild(new Option(q, q));
  rq.value = vQ;
  if (!$('r-de').value) { const d = new Date(); d.setDate(d.getDate() - 7); $('r-de').value = d.toISOString().slice(0, 10); }
  if (!$('r-ate').value) $('r-ate').value = new Date().toISOString().slice(0, 10);
}
function montarProdutosDoPedido() {
  const pp = $('p-produto'); const v = pp.value;
  pp.replaceChildren(new Option('— nenhum (é da empresa) —', ''));
  for (const p of (RETRATO.estrutura.produtos || []).filter((p) => p.empresa === $('p-empresa').value && p.ativo)) pp.appendChild(new Option(p.nome, p.nome));
  pp.value = v;
}
$('p-empresa').addEventListener('change', montarProdutosDoPedido);

/* ── abas ─────────────────────────────────────────────────────────────────── */
/* ⚠ Uma página por assunto, na lateral — as abas de dentro de abas (Command
   Center › Aprovações/Status/Filas/Paths) viraram páginas de primeiro nível:
   o que se decide fica a um clique, não a dois. A página vai no endereço
   (#aprov), então o refresh volta onde você estava e o "voltar" funciona. */
const TITULOS = {
  inicio: ['Visão geral', 'O que precisa de você, o que está andando e quanto custa — num olhar'],
  aprov: ['Aprovações', 'Itens que não andam até você decidir'],
  avisos: ['Avisos', 'O que você precisa saber e não exige decisão sua'],
  status: ['Itens', 'Tudo o que está em aberto, por situação'],
  filas: ['Organograma', 'Quem carrega o quê, ao vivo'],
  paths: ['Caminhos', 'O percurso de cada item — e onde ele desviou'],
  monitor: ['Monitor', 'As réguas do sistema, as rampas de autonomia e o executor'],
  custos: ['Custos', 'Quanto você paga, quanto falta para o limite e onde foi parar'],
  report: ['Report', 'Recorte por período, fila, quem abriu e natureza'],
  pedido: ['Novo pedido', 'Entra assinado por você; a Triagem classifica e roteia'],
};
function irPara(aba) { if (!PAGINAS.includes(aba)) return; ABA = aba; if (GAVETA) { GAVETA = null; desenharGaveta(); } mostrarAba(); window.scrollTo({ top: 0 }); }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-aba]:not(section)'); if (b) { irPara(b.dataset.aba); return; }
  const ir = e.target.closest('[data-ir]'); if (ir) irPara(ir.dataset.ir);
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (PAGINAS.includes(h) && h !== ABA) { ABA = h; mostrarAba(); } });
function mostrarAba() {
  for (const b of $('abas').querySelectorAll('button[data-aba]')) b.setAttribute('aria-selected', String(b.dataset.aba === ABA));
  for (const s of document.querySelectorAll('section.aba')) s.hidden = s.dataset.aba !== ABA;
  const [t, sub] = TITULOS[ABA] || ['', ''];
  $('titulo-pagina').textContent = t; $('sub-pagina').textContent = sub;
  document.title = `${t} — Command Center`;
  if (location.hash.slice(1) !== ABA) history.replaceState(null, '', '#' + ABA);
  fecharMenu();
}
function abrirMenu() { $('lateral').classList.add('aberta'); $('veu').hidden = false; }
function fecharMenu() { $('lateral').classList.remove('aberta'); $('veu').hidden = true; }
$('abrir-menu').addEventListener('click', abrirMenu);
$('fechar-menu').addEventListener('click', fecharMenu);
$('veu').addEventListener('click', fecharMenu);

/* ── atalhos: 1–9 páginas, N novo pedido, R atualizar, T tema, Esc fecha ── */
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const alvo = e.target; const digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable);
  if (e.key === 'Escape') { if (GAVETA) fecharGaveta(); else fecharMenu(); if (digitando) alvo.blur(); return; }
  if (digitando || $('app').hidden) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 9) { irPara(PAGINAS[n - 1]); e.preventDefault(); return; }
  const k = e.key.toLowerCase();
  if (k === 'n') { irPara('pedido'); setTimeout(() => $('p-titulo').focus(), 50); e.preventDefault(); }
  else if (k === 'r') { atualizarAgora(); e.preventDefault(); }
  else if (k === 't') { cicloTema(); e.preventDefault(); }
});

/* ── vocabulário ──────────────────────────────────────────────────────────── */
const ESTADOS = [
  ['ready', 'Abertos, na fila'], ['in_progress', 'Em andamento'], ['validation', 'Entregues — aguardam aceite'],
  ['decision_required', 'Parados — precisam de você'], ['blocked', 'Bloqueados'], ['failed', 'Falharam'],
  ['done', 'Concluídos'], ['cancelled', 'Cancelados'],
];
const rotuloEstado = (k) => (ESTADOS.find(([e]) => e === k) || [])[1];
function tentativasTexto(i) {
  if (!i.tentativas) return '';
  const restam = (i.teto_tentativas || 0) - i.tentativas + 1;
  return restam <= 1 ? `já falhou ${i.tentativas}× — se falhar de novo, vai para as suas Aprovações`
                     : `já falhou ${i.tentativas}× — restam ${restam} tentativas`;
}
function situacao(i) {
  if (i.estado === 'ready' && i.aguarda_alcada) return 'na fila — aguarda a sua alçada';
  if (i.estado === 'ready' && i.nao_antes_de && new Date(i.nao_antes_de) > new Date()) return `na fila — nova tentativa às ${hhmm(i.nao_antes_de)}${i.tentativas ? ' · ' + tentativasTexto(i) : ''}`;
  if (i.estado === 'ready' && i.tentativas) return `na fila — pronto para a próxima tentativa · ${tentativasTexto(i)}`;
  if (i.estado === 'ready') return 'na fila — o executor pega no próximo despacho';
  if (i.estado === 'in_progress') return `em execução por ${i.executor || '—'} desde ${hhmm(i.desde)}`;
  if (i.estado === 'validation') return i.entrega_aberta ? 'entregue — aguarda o seu aceite' : 'aceita — o executor está concluindo';
  if (i.estado === 'decision_required') return 'parado — precisa de você';
  if (i.estado === 'done') return `concluído em ${quando(i.concluido)}${i.tem_prova ? ' · com prova' : ' · SEM prova'}`;
  return rotuloEstado(i.estado) || i.estado;
}

/* ⚠ O TOM da situação é a única cor do cartão. Antes tudo era cinza e negrito,
   e 60 itens tinham exatamente o mesmo peso visual — varrer a lista não dizia
   nada. Agora a cor responde "isto anda sozinho ou depende de mim?". */
function tomDoItem(i) {
  if (i.estado === 'decision_required') return 'parado';
  if (i.aguarda_alcada || i.entrega_aberta) return 'espera';
  if (i.estado === 'in_progress') return 'anda';
  if (i.estado === 'done') return 'ok';
  if (i.estado === 'cancelled') return '';
  return '';
}

/* ── cartão de item (reutilizado em todas as listas) ──────────────────────── */
function tag(rotulo, chave, valor) {
  const s = el('span', 'tag', rotulo); s.title = `Filtrar por ${ROTULO_F[chave] || chave}: ${valor}`;
  s.addEventListener('click', (e) => { e.stopPropagation(); alternar(chave, valor); });
  return s;
}
function cartaoItem(i, opts = {}) {
  const tom = tomDoItem(i);
  const cx = el('article', 'item clicavel' + (tom === 'parado' ? ' urgente' : pendente(i) && aberto(i) ? ' espera' : '') + (GAVETA === i.id ? ' aberto' : ''));
  const cab = el('button', 'item-cab'); cab.setAttribute('aria-haspopup', 'dialog'); cab.title = 'Abrir o detalhe';
  cab.appendChild(el('h4', null, i.titulo));
  const m = el('div', 'meta');
  // ⚠ A situação primeiro, e colorida: é ela que decide se você para neste
  //    cartão. Depois ONDE (empresa · produto · fila), um divisor, e O QUE
  //    (tipo · prioridade · impacto). Data e dinheiro vão para a direita.
  const sit = el('span', 'sit ' + tomDoItem(i), situacao(i));
  m.appendChild(sit);
  const div = () => el('span', 'div', '·');
  m.append(tag(i.empresa || '—', 'empresa', i.empresa),
           tag(i.produto || 'sem produto', 'produto', i.produto || '— sem produto —'),
           tag(i.fila, 'fila', i.fila), div(),
           tag(rotuloTipo(i.tipo), 'tipo', i.tipo),
           tag(PRIORIDADES[i.prioridade] || i.prioridade, 'prioridade', i.prioridade));
  const imp = IMPACTOS[i.impacto];
  if (imp) m.appendChild(el('span', null, imp));
  const dir = el('span', 'meta-dir');
  dir.appendChild(el('span', null, dia(i.criado)));
  if (Number(i.gasto) > 0) dir.appendChild(el('span', 'dinheiro', moeda(i.gasto)));
  m.appendChild(dir);
  cab.appendChild(m);
  cab.addEventListener('click', () => abrirGaveta(i.id));
  cx.appendChild(cab);
  if (opts.rodape) cx.appendChild(opts.rodape);
  return subirDir(cx);
}
/* ⚠ Data e dinheiro sobem para a linha do TÍTULO, à direita. Dentro da linha
   de etiquetas eles colidiam com a situação quando ela era longa ("já falhou
   1× — restam 2 tentativas" passava por cima da data). */
function subirDir(cx) {
  const dir = cx.querySelector('.meta-dir'); const h = cx.querySelector('h4');
  if (!dir || !h) return cx;
  const topo = el('div', 'item-topo'); h.replaceWith(topo); topo.append(h, dir);
  return cx;
}

/* ── a gaveta: o detalhe do item abre de lado, sem tirar você da lista ───── */
function abrirGaveta(id) { GAVETA = id; desenharGaveta(); render(); }
function fecharGaveta() { GAVETA = null; desenharGaveta(); render(); }
$('fechar-gaveta').addEventListener('click', fecharGaveta);
$('veu-gaveta').addEventListener('click', fecharGaveta);
function desenharGaveta() {
  const g = $('gaveta'); const i = GAVETA && RETRATO ? todosItens().find((x) => x.id === GAVETA) : null;
  if (GAVETA && RETRATO && !i) GAVETA = null;    // o item saiu do retrato: a gaveta fecha sozinha
  g.classList.toggle('aberta', !!i); g.setAttribute('aria-hidden', String(!i)); $('veu-gaveta').hidden = !i;
  const c = $('gaveta-corpo'); c.replaceChildren(); if (!i) return;
  c.appendChild(el('span', 'sit ' + tomDoItem(i), situacao(i)));
  const h = el('h2', null, i.titulo); h.id = 'gaveta-titulo'; c.appendChild(h);
  const ficha = el('dl', 'ficha');
  const par = (rot, valor, chave, filtro) => {
    if (valor == null || valor === '') return;
    ficha.appendChild(el('dt', null, rot));
    const dd = el('dd'); dd.appendChild(chave ? tag(valor, chave, filtro === undefined ? valor : filtro) : document.createTextNode(valor)); ficha.appendChild(dd);
  };
  par('Empresa', i.empresa, 'empresa');
  par('Produto', i.produto || 'sem produto', 'produto', i.produto || '— sem produto —');
  par('Fila', i.fila, 'fila'); par('Squad', i.squad, 'squad');
  par('Tipo', rotuloTipo(i.tipo), 'tipo', i.tipo);
  par('Prioridade', PRIORIDADES[i.prioridade] || i.prioridade, 'prioridade', i.prioridade);
  par('Impacto', IMPACTOS[i.impacto] ? IMPACTOS[i.impacto].replace('impacto ', '') : null);
  par('Natureza', i.natureza, 'natureza');
  par('Quem abriu', i.quem_abriu, 'quem');
  par('Executor', i.executor, 'executor');
  par('Aberto em', quando(i.criado)); par('Última mudança', i.atualizado ? quando(i.atualizado) : null);
  if (i.concluido) par('Concluído em', quando(i.concluido));
  if (Number(i.gasto) > 0) par('Consumo', moeda(i.gasto));
  if (i.tentativas) par('Tentativas', tentativasTexto(i));
  c.appendChild(ficha);
  c.appendChild(el('h3', null, 'O pedido'));
  c.appendChild(el('div', 'descricao', i.descricao || '(este item não tem descrição registrada)'));
  if (i.ultima_falha) { c.appendChild(el('h3', null, 'Última falha')); c.appendChild(el('p', 'falha', `${quando(i.ultima_falha_em)} — ${i.ultima_falha}`)); }
  c.appendChild(el('h3', null, 'Caminho'));
  const p = desenharPath(i); const d = p.querySelector('details'); if (d) d.open = true; c.appendChild(p);
}

function listar(alvo, lista, opts) {
  alvo.replaceChildren();
  if (!lista.length) { alvo.appendChild(el('p', 'vazio', opts && opts.vazio || 'Nada aqui com os filtros atuais.')); return; }
  for (const i of lista) alvo.appendChild(cartaoItem(i, opts));
}

/* ── ABA CC › Aprovações ──────────────────────────────────────────────────── */
const ROTULO_CLASSE = { aguarda_alcada: 'aguarda a sua alçada', deliberacao_escalada: 'deliberação escalada a você',
                        entrega_aguarda_aceite: 'entrega pronta — aguarda o seu aceite', travado: 'travado — estourou o limite' };
function desenharAprov() {
  const porId = new Map(todosItens().map((i) => [i.id, i]));
  const lista = ((RETRATO.inbox && RETRATO.inbox.itens) || []).filter((p) => { const i = porId.get(p.id); return !i || passa(i); });
  const total = (RETRATO.inbox && RETRATO.inbox.total) || 0;
  $('pill-aprov').textContent = String(total);
  $('pill-aprov').className = 'pill' + (total ? ' vermelho' : ''); $('pill-aprov').hidden = !total;
  $('sub-aprov').textContent = lista.length === 0
    ? (total ? 'Nada com os filtros atuais.' : 'Nada espera por você. A fila anda sozinha.')
    : `${lista.length} item(ns) não andam até você decidir. Em ordem de quem espera há mais tempo.`;
  const alvo = $('lista-aprov'); alvo.replaceChildren();
  if (!lista.length) alvo.appendChild(vazioGrande('Aprovações limpas', total ? 'Nada com os filtros atuais.' : 'Nada espera por você. A fila anda sozinha.'));
  for (const p of (lista.length ? lista : [])) {
    const i = porId.get(p.id);
    const cx = el('article', 'item ' + (Number(p.dias_esperando) >= 2 ? 'urgente' : 'espera'));
    cx.id = 'aprov-' + p.id;
    if (i) { const cab = el('button', 'item-cab'); cab.title = 'Abrir o detalhe'; cab.appendChild(el('h4', null, p.titulo)); cab.addEventListener('click', () => abrirGaveta(i.id)); cx.appendChild(cab); }
    else cx.appendChild(el('h4', null, p.titulo));
    const m = el('div', 'meta');
    // ⚠ Aprovações montava o próprio cartão e por isso ficou de fora da
    //    primeira passada — a aba mais importante da tela seguia com a linha
    //    corrida e com `impacto none` na cara do CEO. Mesmo padrão do resto:
    //    situação colorida, grupos com divisor, espera e dinheiro à direita.
    const escalado = p.classe === 'travado' && p.contexto && p.contexto.escalado_pelo_cto;
    m.appendChild(el('span', 'sit espera', escalado ? 'escalado pelo CTO — precisa da sua decisão' : (ROTULO_CLASSE[p.classe] || p.classe)));
    if (i) m.append(tag(i.empresa, 'empresa', i.empresa), tag(i.produto || 'sem produto', 'produto', i.produto || '— sem produto —'),
                    tag(i.fila, 'fila', i.fila), el('span', 'div', '·'), tag(rotuloTipo(i.tipo), 'tipo', i.tipo));
    const impA = IMPACTOS[p.impacto];
    if (impA) m.appendChild(el('span', null, impA));
    const dirA = el('span', 'meta-dir');
    // ⚠ "2 dia(s) esperando" é o número que ordena esta lista: fica à direita,
    //    alinhado com os outros, e em âmbar a partir de 2 dias.
    const esp = el('span', Number(p.dias_esperando) >= 2 ? 'quente' : null, esperaTexto(p.dias_esperando));
    dirA.appendChild(esp);
    if (Number(p.custo_ja_gasto) > 0) dirA.appendChild(el('span', 'dinheiro', moeda(p.custo_ja_gasto)));
    m.appendChild(dirA);
    cx.append(m, el('p', 'porque', p.porque_voce)); subirDir(cx);
    if (i && i.descricao) { const d = el('details'); d.append(el('summary', null, 'Ver o pedido inteiro'), el('div', 'descricao', i.descricao)); cx.appendChild(d); }
    if (p.classe === 'aguarda_alcada') {
      // (M455) A pergunta que o CEO já fez sobre este item, e a resposta quando
      // ela chegou — o banco as guarda no item; a tela só mostra.
      const pg = p.contexto && p.contexto.pergunta;
      if (pg && pg.id) {
        const q = el('div', 'pergunta');
        q.appendChild(el('p', 'porque', `Você perguntou${pg.em ? ' em ' + quando(pg.em) : ''}: “${pg.texto || '—'}”`));
        q.appendChild(pg.resposta
          ? el('p', 'porque resposta', `Resposta${pg.respondida_em ? ' em ' + quando(pg.respondida_em) : ''}: ${pg.resposta}`)
          : el('p', 'dica', pg.estado === 'cancelled' ? 'A pergunta foi cancelada.' : 'Sem resposta ainda — o COO responde pela oficina; a resposta também chega na aba Avisos.'));
        cx.appendChild(q);
      }
      // ⚠ Três saídas, não uma: aprovar, reprovar (o NÃO com motivo — vai para
      //    `cancelado` com rastro `rejected`) e questionar (abre pergunta ao COO
      //    com este item como pai; o item continua aqui até você decidir).
      cx.appendChild(caixaAcao(p, [
        ['Aprovar', 'company_os_minha_aprovacao', 'p_observacao', { p_canal: 'tela-os' }],
        ['Questionar', 'company_os_questionar', 'p_pergunta'],
        ['Reprovar', 'company_os_reprovar', 'p_motivo', null, 'perigo'],
      ], 'Motivo (para aprovar ou reprovar) ou a pergunta ao COO (para questionar) — mínimo 10 letras'));
    }
    if (p.classe === 'entrega_aguarda_aceite') {
      const ref = (p.contexto && p.contexto.referencia) || '';
      if (/^https?:\/\//.test(ref)) { const a = el('a', 'ligacao', 'Abrir a entrega (PR) em nova aba'); a.appendChild(icone('externo')); a.href = ref; a.target = '_blank'; a.rel = 'noopener noreferrer'; cx.appendChild(a); }
      else if (ref) cx.appendChild(el('p', 'porque', 'Evidência: ' + ref));
      if (p.contexto && p.contexto.detalhe) cx.appendChild(el('p', 'porque', p.contexto.detalhe));
      cx.appendChild(caixaAcao(p, [['Aceitar entrega', 'company_os_aceitar_entrega', 'p_observacao'], ['Recusar', 'company_os_recusar_entrega', 'p_motivo', null, 'perigo']],
        'Observação (para aceitar) ou motivo (para recusar) — mínimo 10 letras'));
    }
    if (p.classe === 'travado') cx.appendChild(caixaAcao(p, [['Devolver à fila', 'company_os_devolver_a_fila', 'p_motivo'], ['Cancelar item', 'company_os_cancelar_item', 'p_motivo', null, 'perigo']],
      'O que mudou (para devolver) ou por que encerrar (para cancelar) — mínimo 10 letras'));
    if (p.classe === 'deliberacao_escalada') cx.appendChild(el('p', 'porque', 'Deliberação escalada: a decisão é registrada pela Triagem com a sua palavra. Escreva a decisão num pedido novo ou fale com o executor.'));
    alvo.appendChild(cx);
  }
  // Só para você saber: o que a régua (CI) aceitou nos últimos 7 dias — informação, não pendência (M397)
  const regua = ((RETRATO.estrutura && RETRATO.estrutura.entregas_da_regua) || []).filter((e) => (!F.empresa || e.empresa === F.empresa) && (!F.produto || (e.produto || '— sem produto —') === F.produto) && (!F.fila || bate(F.fila, e.fila)));
  if (regua.length) {
    alvo.appendChild(el('h3', 'info-titulo', `Entregue pela régua nos últimos 7 dias — só para você saber (${regua.length})`));
    for (const e of regua) {
      const cx = el('article', 'item info');
      cx.appendChild(el('h4', null, e.titulo));
      const m = el('div', 'meta');
      m.append(el('span', 'sit ok', e.concluida ? 'em produção' : 'aceita pelo CI — concluindo'),
               tag(e.empresa, 'empresa', e.empresa), tag(e.produto || 'sem produto', 'produto', e.produto || '— sem produto —'),
               tag(e.fila, 'fila', e.fila), el('span', 'div', '·'),
               // (M452/C20) Quem diz se o nível exige alçada é o banco (`exige_alcada`, vindo do retrato),
               // não uma lista aqui: esta linha era a 13ª cópia de `IN ('product','executive')`, em JS.
               // Retrato antigo (sem a chave) não inventa resposta — fica em branco.
               el('span', null, e.exige_alcada == null ? '' : (e.exige_alcada ? 'você aprovou na entrada (7c)' : 'aceita pela régua técnica (7b)')));
      const dirR = el('span', 'meta-dir'); dirR.appendChild(el('span', null, quando(e.aceita_em))); m.appendChild(dirR);
      cx.appendChild(m); subirDir(cx);
      if (/^https?:\/\//.test(e.referencia || '')) { const a = el('a', 'ligacao', 'Ver a entrega (PR)'); a.appendChild(icone('externo')); a.href = e.referencia; a.target = '_blank'; a.rel = 'noopener noreferrer'; cx.appendChild(a); }
      alvo.appendChild(cx);
    }
  }
}
function caixaAcao(p, botoes, placeholder) {
  const cx = el('div', 'acao-caixa');
  const campo = el('input'); campo.type = 'text'; campo.placeholder = placeholder; campo.setAttribute('aria-label', placeholder);
  const msg = el('p', 'aviso'); msg.hidden = true; msg.setAttribute('role', 'alert');
  const bs = [];
  for (const [rot, fn, campoNome, extra, classe] of botoes) {
    const b = el('button', 'btn' + (classe ? ' ' + classe : botoes.length > 1 && rot !== botoes[0][0] ? ' sec' : ''), rot);
    b.addEventListener('click', async () => {
      for (const x of bs) x.disabled = true;
      try {
        const corpo = { p_work_item_id: p.id, ...(extra || {}) }; corpo[campoNome] = campo.value.trim();
        await rpc(fn, corpo);
        await abrirCasa();       // quem decide se saiu da lista é o banco, não o JavaScript
        toast(`${rot}: registrado.`);
      } catch (err) { mostrar(msg, String(err.message || err), false); for (const x of bs) x.disabled = false; }
    });
    bs.push(b);
  }
  cx.append(campo, ...bs, msg);
  return cx;
}

/* ── ABA CC › Status ──────────────────────────────────────────────────────── */
function desenharStatus() {
  const p = RETRATO.plantao || {};
  const fx = $('faixa-executor'); fx.replaceChildren();
  const exec = (p.em_execucao || []).length; const fila = (p.na_fila || []).length;
  const luz = el('span', 'luz' + (exec ? ' on' : fila ? ' espera' : ''));
  const s1 = el('span'); s1.append(luz, document.createTextNode('Executor: '), el('b', null, exec ? `${exec} em execução agora` : fila ? `${fila} esperando a vez` : 'ocioso'));
  const s2 = el('span'); s2.append(document.createTextNode('acordado pela última vez às '), el('b', null, p.ultimo_despacho ? quando(p.ultimo_despacho) : '—'));
  const s3 = el('span', null, p.redespacho_agendado ? 'redespacho automático a cada 10 min ligado' : 'redespacho automático DESLIGADO');
  fx.append(s1, s2, s3);

  const base = (RETRATO.itens || []).filter((i) => { const e = F.estado; delete F.estado; const ok = passa(i); if (e) F.estado = e; return ok; });
  const bd = $('badges-status'); bd.replaceChildren();
  for (const [k, rot] of ESTADOS) {
    const n = base.filter((i) => i.estado === k).length;
    const b = el('button', 'badge' + (n ? '' : ' zero')); b.setAttribute('aria-pressed', String(F.estado === k));
    const pill = el('span', 'pill' + (k === 'decision_required' && n ? ' vermelho' : k === 'validation' && n ? ' ambar' : k === 'in_progress' && n ? ' azul' : ''), String(n));
    b.append(document.createTextNode(rot + ' '), pill);
    b.addEventListener('click', () => alternar('estado', k));
    bd.appendChild(b);
  }
  const lista = itens().filter((i) => F.estado ? true : aberto(i)).sort((a, b) => new Date(b.atualizado || b.criado) - new Date(a.atualizado || a.criado));
  // (o texto abaixo continua dizendo onde clicar: agora o título abre o detalhe ao lado)
  // ⚠ A dica é texto de seção, não item: numa grade ela roubava uma célula e
  //    abria um buraco no canto. Atravessa as colunas.
  $('lista-status').replaceChildren(el('p', 'dica larga', F.estado ? `${lista.length} item(ns) em "${rotuloEstado(F.estado)}" · clique no título para abrir o detalhe` : `${lista.length} em aberto · clique numa situação para filtrar · clique no título para abrir o detalhe`));
  for (const i of lista) $('lista-status').appendChild(cartaoItem(i));
  if (!lista.length) $('lista-status').appendChild(el('p', 'vazio', 'Nada aqui com os filtros atuais.'));
}

/* ── ABA CC › Filas (organograma) ─────────────────────────────────────────── */
const C_LEVEL = [
  { papel: 'CFO', nome: 'Jack Check', filas: ['financeiro'], agente: 'jack-check' },
  { papel: 'CMO', nome: 'Phill Mark', filas: ['marketing'], agente: 'phill-mark' },
  { papel: 'CPO', nome: 'John Prod', filas: ['produto'], agente: 'john-prod' },
  { papel: 'COO', nome: 'Jonhy Ops', filas: ['operacoes', 'engenharia'], agente: 'operacoes' },
];
function contagens(lista) {
  return { abertos: lista.filter(aberto).length, parados: lista.filter((i) => aberto(i) && pendente(i)).length, exec: lista.filter((i) => i.estado === 'in_progress').length };
}
function selos(c) {
  const s = el('div', 'selos');
  s.appendChild(el('span', 'pill' + (c.abertos ? ' azul' : ''), String(c.abertos)));
  if (c.parados) { const p = el('span', 'pill vermelho', String(c.parados)); p.title = 'parados, precisam de decisão'; s.appendChild(p); }
  if (c.exec) { const p = el('span', 'pill ambar', String(c.exec)); p.title = 'em execução agora'; s.appendChild(p); }
  return s;
}
function caixa(cls, papel, nome, sub, c, pressed, onClick) {
  const b = el('button', 'org-caixa ' + cls); b.setAttribute('aria-pressed', String(!!pressed));
  b.append(el('div', 'papel', papel), el('div', 'nome', nome));
  if (sub) b.appendChild(el('div', 'sub', sub));
  b.appendChild(selos(c));
  b.addEventListener('click', onClick);
  return b;
}
function desenharOrg() {
  const org = $('org'); org.replaceChildren();
  // base sem os filtros de fila/produto/pendente, para as caixas mostrarem o todo e o clique filtrar
  const guardados = { fila: F.fila, produto: F.produto, pendente: F.pendente, squad: F.squad }; delete F.fila; delete F.produto; delete F.pendente; delete F.squad;
  const base = todosItens().filter(passa);
  Object.assign(F, Object.fromEntries(Object.entries(guardados).filter(([, v]) => v !== undefined)));

  /* A caixa do CEO mostra SÓ o que espera por ele. A fila executiva é do
     executor (squad mesa-do-ceo) — em 20/09 o "3" ali foi lido como "3 para
     aprovar" quando eram 3 itens já aprovados esperando execução. */
  const paradosEmMim = base.filter((i) => aberto(i) && pendente(i)).length;
  const naExecutiva = base.filter((i) => aberto(i) && i.fila === 'executiva').length;
  const ceo = caixa('ceo', 'CEO', 'Renato Correa', `${naExecutiva} na fila executiva (o executor faz)`, { abertos: paradosEmMim, parados: 0, exec: 0 }, F.pendente === true, () => alternar('pendente', true));
  const selo = ceo.querySelector('.selos .pill'); selo.className = 'pill' + (paradosEmMim ? ' vermelho' : ''); selo.title = 'parados em você (Aprovações)';
  selo.textContent = paradosEmMim ? `${paradosEmMim} para você` : 'nada para você';
  org.append(el('div', 'org-nivel').appendChild(ceo).parentElement, el('div', 'org-ligacao'));

  const nivelC = el('div', 'org-nivel');
  for (const c of C_LEVEL) {
    const dos = base.filter((i) => c.filas.includes(i.fila));
    const pressed = Array.isArray(F.fila) ? JSON.stringify(F.fila) === JSON.stringify(c.filas) : c.filas.length === 1 && F.fila === c.filas[0];
    nivelC.appendChild(caixa(c.papel === 'COO' ? 'coo' : '', c.papel, c.nome, 'fila ' + c.filas.join(' + '), contagens(dos), pressed, () => alternar('fila', c.filas.length === 1 ? c.filas[0] : c.filas)));
  }
  org.appendChild(nivelC);

  // Produtos e squads ficam sob o COO (Operations): um nível inteiro, para não
  // espremer o organograma numa coluna só.
  org.appendChild(el('div', 'org-ligacao'));
  org.appendChild(el('div', 'org-rotulo', 'Produtos — sob o COO'));
  const prods = el('div', 'org-nivel');
  const nomes = [...(RETRATO.estrutura.produtos || []).map((p) => p.nome)];
  if (base.some((i) => !i.produto)) nomes.push('— sem produto —');
  for (const pn of nomes) {
    const dosP = base.filter((i) => (i.produto || '— sem produto —') === pn);
    const pr = el('div', 'org-ramo');
    const pInfo = (RETRATO.estrutura.produtos || []).find((p) => p.nome === pn);
    pr.appendChild(caixa('produto', 'Produto', pn, pInfo ? pInfo.empresa : 'itens sem produto', contagens(dosP), F.produto === pn, () => alternar('produto', pn)));
    pr.appendChild(el('div', 'org-ligacao'));
    const sq = el('div', 'org-filhos');
    for (const s of (RETRATO.estrutura.squads || []).filter((s) => ['engenharia', 'operacoes'].includes(s.fila))) {
      const dosS = dosP.filter((i) => i.fila === s.fila);
      sq.appendChild(caixa('squad', 'Squad', s.nome, `WIP máx ${s.wip_max}`, contagens(dosS), F.produto === pn && F.fila === s.fila,
        () => { const mesmo = F.produto === pn && F.fila === s.fila; if (mesmo) { delete F.produto; delete F.fila; } else { F.produto = pn; F.fila = s.fila; } render(); }));
    }
    pr.appendChild(sq); prods.appendChild(pr);
  }
  org.appendChild(prods);

  const lista = itens().filter(aberto).sort((a, b) => (pendente(b) - pendente(a)) || new Date(b.atualizado) - new Date(a.atualizado));
  const alvo = $('lista-filas'); alvo.replaceChildren();
  alvo.appendChild(el('p', 'dica larga', (F.fila || F.produto || F.pendente) ? `${lista.length} item(ns) na seleção · clique no título para abrir o detalhe` : 'Clique numa caixa para filtrar. Abaixo, tudo o que está em aberto.'));
  for (const i of lista) alvo.appendChild(cartaoItem(i));
  if (!lista.length) alvo.appendChild(el('p', 'vazio', 'Nada em aberto aqui.'));
}

/* ── ABA CC › Paths ───────────────────────────────────────────────────────── */
/* ⚠ O §10.2 promete "linguagem de negócio, sem nome de token nem log", e a
   tela mostrava `technical_bug`, `infrastructure`, `impacto none`. Os nomes do
   banco ficam no banco; aqui sai português. Tipo desconhecido cai no próprio
   nome com o underline trocado por espaço — nunca some, nunca vira "outro". */
const TIPOS = {
  business_feature: 'funcionalidade', business_rule: 'regra de negócio', technical_bug: 'defeito',
  technical_debt: 'dívida técnica', infrastructure: 'infraestrutura', security: 'segurança',
  operational_incident: 'incidente', structural_change: 'mudança estrutural', capacity: 'capacidade',
  decision: 'decisão', product: 'produto',
  // (M455) os 12 que faltavam — o catálogo é `company_os.tipos_de_trabalho` (23 tipos em 25/09);
  // `analytical_research` é o tipo de toda pergunta do CEO ao COO e saía como "analytical research".
  analytical_research: 'pergunta ao COO', cpi: 'melhoria contínua', exception: 'exceção',
  financial_analysis: 'análise financeira', governance_approval: 'aprovação de governança',
  maintenance: 'manutenção', market_analysis: 'análise de mercado', performance: 'desempenho',
  policy_change: 'mudança de política', pricing: 'preço', process_improvement: 'melhoria de processo',
  product_decision: 'decisão de produto', refactoring: 'refatoração',
};
const IMPACTOS = { none: null, low: 'impacto baixo', medium: 'impacto médio', high: 'impacto alto', critical: 'impacto crítico' };
const PRIORIDADES = { critica: 'crítica', alta: 'alta', media: 'média', baixa: 'baixa' };
const rotuloTipo = (k) => TIPOS[k] || String(k || '—').replace(/_/g, ' ');

const NOME_LUGAR = { request_intake: 'pedido', work_item: 'item', fila: 'fila', execucao: 'execução', entrega: 'entrega', aceite: 'aceite', concluido: 'concluído', mesa: 'aprovações', cancelado: 'cancelado' };
const lugar = (l) => NOME_LUGAR[l] || l;
/* ⚠ Eram 15 a 20 pastilhas por item, com `execução → fila` repetido dez vezes
   seguidas: o log cru na tela. Duas mudanças: repetição CONSECUTIVA vira
   contador (×7), e o caminho inteiro sai da frente — fica o RESUMO, que é o
   que responde "este item andou ou ficou rodando?", com o detalhe a um clique.
   Nenhum passo é jogado fora; o que muda é o que aparece primeiro. */
function dobrarRepetidos(perc) {
  const out = [];
  for (const s of perc) {
    const ult = out[out.length - 1];
    if (ult && ult.de === s.de && ult.para === s.para && ult.classificacao === s.classificacao) { ult.n += 1; ult.ultimo = s; continue; }
    out.push({ ...s, n: 1, ultimo: s });
  }
  return out;
}
function desenharPath(i) {
  const envolve = el('div');
  const perc = i.percorrido || [];
  const r = i.caminho || {};

  const res = el('div', 'path-resumo');
  const cls = r.nao_classificados ? 'ruim' : r.desvios ? 'desvio' : 'limpo';
  const rot = r.nao_classificados ? `${r.nao_classificados} perna(s) não classificada(s)` : r.desvios ? `${r.desvios} desvio(s)` : 'caminho limpo';
  res.appendChild(el('span', 'selo ' + cls, rot));
  res.appendChild(el('span', null, `${r.passos_percorridos || 0} passo(s)`));
  // ⚠ A volta repetida é o sintoma que interessa: item que anda é diferente de
  //    item que gira. O maior laço é dito em palavras, não deduzido de pastilha.
  const dobrado = dobrarRepetidos(perc);
  const maior = dobrado.reduce((a, b) => (b.n > (a ? a.n : 0) ? b : a), null);
  if (maior && maior.n > 1) res.appendChild(el('span', null, `voltou ${maior.n}× em ${lugar(maior.de)} → ${lugar(maior.para)}`));
  envolve.appendChild(res);

  if (!perc.length) { res.appendChild(el('span', null, 'sem passos registrados')); return envolve; }

  const det = el('details');
  det.appendChild(el('summary', null, 'Ver o caminho passo a passo'));
  const p = el('div', 'path');
  dobrado.forEach((s, n) => {
    const c = s.classificacao === 'esperado' ? 'ok' : s.classificacao === 'desvio_conhecido' ? 'desvio' : 'ruim';
    const chip = el('span', 'passo ' + c, `${lugar(s.de)} → ${lugar(s.para)}`);
    if (s.n > 1) chip.appendChild(el('span', 'x', ' ×' + s.n));
    chip.title = `${quando(s.ultimo.quando)} · ${s.ultimo.desfecho}${s.ultimo.motivo ? ' · ' + s.ultimo.motivo : ''}`;
    if (n) p.appendChild(el('span', 'seta', '›'));
    p.appendChild(chip);
  });
  for (const fa of (r.faltando) || []) { p.appendChild(el('span', 'seta', '›')); const c = el('span', 'passo falta', `${lugar(fa.de)} → ${lugar(fa.para)}`); c.title = 'ainda não percorrido'; p.appendChild(c); }
  det.appendChild(p);
  envolve.appendChild(det);
  return envolve;
}
function desenharPaths() {
  const esp = [...(RETRATO.estrutura.caminho_esperado || [])].sort((a, b) => a.passo - b.passo);
  $('cam-esperado').textContent = esp.length ? esp.map((e, n) => (n ? '' : lugar(e.de) + ' → ') + lugar(e.para)).join(' → ') : '—';
  const base = (RETRATO.itens || []).filter((i) => { const c = F.caminho; delete F.caminho; const ok = passa(i); if (c) F.caminho = c; return ok; });
  const bd = $('badges-paths'); bd.replaceChildren();
  for (const [k, rot, cls] of [['limpo', 'Caminho limpo', ''], ['desvio', 'Com desvio', 'ambar'], ['nao_classificado', 'Perna não classificada', 'vermelho']]) {
    const n = base.filter((i) => { const c = i.caminho || {}; return k === 'limpo' ? c.caminho_limpo : k === 'desvio' ? c.desvios > 0 : c.nao_classificados > 0; }).length;
    const b = el('button', 'badge' + (n ? '' : ' zero')); b.setAttribute('aria-pressed', String(F.caminho === k));
    b.append(document.createTextNode(rot + ' '), el('span', 'pill' + (n && cls ? ' ' + cls : ''), String(n)));
    b.addEventListener('click', () => alternar('caminho', k)); bd.appendChild(b);
  }
  const lista = itens();
  const abertos = lista.filter(aberto).sort((a, b) => new Date(b.atualizado) - new Date(a.atualizado));
  const fechados = lista.filter((i) => !aberto(i)).sort((a, b) => new Date(b.concluido || b.atualizado) - new Date(a.concluido || a.atualizado));
  const pintar = (alvo, l) => { alvo.replaceChildren(); if (!l.length) { alvo.appendChild(el('p', 'vazio', 'Nada aqui.')); return; } for (const i of l) { const cx = cartaoItem(i, { comPath: false }); cx.appendChild(desenharPath(i)); alvo.appendChild(cx); } };
  pintar($('paths-abertos'), abertos); pintar($('paths-fechados'), fechados);
}

/* ── ABA Novo pedido ──────────────────────────────────────────────────────── */
$('form-pedido').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('btn-pedido'); btn.disabled = true; $('msg-pedido').hidden = true;
  try {
    await rpc('company_os_abrir_pedido', {
      p_titulo: $('p-titulo').value.trim(), p_descricao: $('p-desc').value.trim(), p_prioridade: $('p-prio').value,
      p_empresa: $('p-empresa').value, p_produto: $('p-produto').value || null,
    });
    mostrar($('msg-pedido'), 'Pedido aberto e assinado por você. A Triagem classifica e roteia em instantes; ele aparece em Itens assim que virar item.', true);
    toast('Pedido aberto.');
    $('p-titulo').value = ''; $('p-desc').value = '';
    await abrirCasa();
  } catch (err) { mostrar($('msg-pedido'), String(err.message || err), false); }
  finally { btn.disabled = false; }
});
function desenharPedido() {
  const meus = itens().filter((i) => i.quem_abriu === SESSAO.user.email).sort((a, b) => new Date(b.criado) - new Date(a.criado)).slice(0, 12);
  listar($('meus-pedidos'), meus, { vazio: 'Nenhum pedido seu virou item ainda (com os filtros atuais).' });
}

/* ── ABA Monitor ──────────────────────────────────────────────────────────── */
function kpi(alvo, rot, val, sub, cls, onClick, pressed, ico) {
  const d = el(onClick ? 'button' : 'div', 'kpi' + (cls ? ' ' + cls : '') + (onClick ? ' clicavel' : ''));
  if (onClick) { d.addEventListener('click', onClick); d.setAttribute('aria-pressed', String(!!pressed)); }
  const r = el('div', 'r'); if (ico) r.appendChild(icone(ico)); r.appendChild(document.createTextNode(rot));
  d.append(r, el('div', 'v', val)); if (sub) d.appendChild(el('div', 's', sub));
  alvo.appendChild(d);
  return d;
}
function linhas(alvo, pares) {
  alvo.replaceChildren();
  for (const [k, v, onClick, pressed] of pares) {
    const l = el('div', 'linha' + (onClick ? ' clicavel' : '')); l.append(el('span', null, k), el('span', 'd', v));
    if (onClick) { l.addEventListener('click', onClick); if (pressed) l.classList.add('ativa'); }
    alvo.appendChild(l);
  }
  if (!pares.length) alvo.appendChild(el('p', 'vazio', 'Nada.'));
}
/* ⚠ O MEDIDOR DE CONSUMO (M418). O CEO pediu três — Claude, GitHub e Vercel —
   com avisos em 50, 75 e 90%. Medido: só o GitHub tem API hoje. Os outros dois
   vêm do banco NOMEADOS, com o motivo, e aparecem apagados no pé do medidor:
   painel que simplesmente omite o que não mede deixa quem olha achando que
   está vendo tudo. Nenhum número nasce aqui — o banco calcula (§10.1). */
function desenharMedidor(alvo) {
  alvo.replaceChildren();
  const c = (RETRATO.painel && RETRATO.painel.consumo) || null;
  if (!c) { alvo.appendChild(el('p', 'vazio', 'O banco ainda não devolve o medidor de consumo.')); return; }
  const faixa = c.faixa || 'sem_medicao';
  const cx = el('div', 'medidor ' + faixa);

  const cab = el('div', 'cab');
  cab.appendChild(el('span', 'nome', 'GitHub Actions'));
  cab.appendChild(el('span', 'pill', c.limite_vigente === 'orcamento_usd' ? 'contra o orçamento' : 'contra a franquia'));
  cab.appendChild(el('span', 'pct', c.percentual == null ? 'sem medição' : `${String(c.percentual).replace('.', ',')}%`));
  cx.appendChild(cab);

  cx.appendChild(el('p', 'frase', c.aviso || '—'));

  const trilho = el('div', 'trilho');
  const largura = Math.max(0, Math.min(100, Number(c.percentual) || 0));
  const dentro = el('div', 'preenche'); dentro.style.width = largura + '%';
  trilho.appendChild(dentro);
  // ⚠ As três marcas ficam DESENHADAS no trilho: sem elas, "56%" não responde
  //    "isso é perto?". As faixas vêm do banco, não daqui.
  for (const k of ['aviso_1', 'aviso_2', 'aviso_3']) {
    const v = c.faixas && c.faixas[k];
    if (v == null) continue;
    const marca = el('i'); marca.style.left = Math.min(100, Number(v)) + '%'; marca.title = `aviso de ${v}%`;
    trilho.appendChild(marca);
  }
  cx.appendChild(trilho);

  const esc = el('div', 'escala');
  const un = c.unidade === 'USD' ? (n) => 'US$ ' + Number(n).toFixed(2).replace('.', ',') : (n) => num(n) + ' min';
  esc.append(el('span', null, c.usado == null ? '—' : un(c.usado)),
             el('span', null, c.teto == null ? '—' : 'de ' + un(c.teto)));
  cx.appendChild(esc);

  const aus = c.nao_medidos || [];
  if (aus.length) {
    const box = el('div', 'ausentes');
    box.appendChild(el('b', null, 'Ainda sem medição automática:'));
    for (const a of aus) box.appendChild(el('p', null, `${a.medidor === 'claude' ? 'Claude' : a.medidor === 'vercel' ? 'Vercel' : a.medidor} — ${a.porque}`));
    cx.appendChild(box);
  }
  alvo.appendChild(cx);
}

/* ── ABA Avisos (D-14) ────────────────────────────────────────────────────── */
/* ⚠ Esta fila NÃO pede decisão. O que exige alçada vai para Aprovações, e o
   OS41 reprova quem tentar usar esta porta para fugir disso. Aqui o CEO dá
   CIÊNCIA — e, se quiser entender, abre pergunta ao COO. */
async function acaoAviso(fn, corpo, msg) {
  try {
    await rpc(fn, corpo)
    $('msg-avisos').hidden = true
    toast(msg)
    await abrirCasa()
  } catch (e) { mostrar($('msg-avisos'), String(e.message || e), false) }
}
function desenharAvisos() {
  const lista = AVISOS.itens || []
  const novos = lista.filter((a) => !a.visto_em)
  const pill = $('pill-avisos')
  pill.hidden = !novos.length
  if (novos.length) { pill.className = 'pill ambar'; pill.textContent = String(novos.length) }

  $('sub-avisos').textContent = !lista.length
    ? 'Nada para você saber agora. Quando o sistema parar por algo que você não precisa decidir, ele conta aqui.'
    : `${novos.length} sem ciência${lista.length > novos.length ? ` · ${lista.length - novos.length} já vistos nos últimos 14 dias` : ''}. Nada aqui espera decisão sua.`

  const barra = $('barra-ciencia'); barra.hidden = !novos.length
  $('dica-ciencia').textContent = novos.length ? `${novos.length} aviso(s) — ciência é só "eu li".` : ''

  const alvo = $('lista-avisos'); alvo.replaceChildren()
  if (!lista.length) { alvo.appendChild(vazioGrande('Fila de avisos limpa', 'Quando o sistema parar por algo que você não precisa decidir, ele conta aqui.')); return }

  for (const a of lista) {
    const cx = el('article', 'item' + (a.visto_em ? ' info' : ' espera'))
    cx.appendChild(el('h4', null, a.assunto))
    const m = el('div', 'meta')
    // ⚠ O TOM diz há quanto tempo ele está parado ali: a régua OS41 acende aos
    //    7 dias, e a tela avisa antes de a régua acender.
    const d = Number(a.dias_sem_ciencia)
    m.appendChild(el('span', 'sit ' + (a.visto_em ? 'ok' : d >= 7 ? 'parado' : 'espera'),
      a.visto_em ? 'ciência dada' : d >= 1 ? `sem ciência há ${d} dia(s)` : 'novo'))
    m.appendChild(el('span', null, a.origem))
    const dir = el('span', 'meta-dir'); dir.appendChild(el('span', null, quando(a.criado_em)))
    m.appendChild(dir)
    cx.appendChild(m); subirDir(cx)
    // ⚠ O corpo inteiro, sem cortar: ele diz o que mudou, o que já foi tentado
    //    e o que acontece se nada for feito. Cortar isso devolveria ao CEO a
    //    tarefa em vez da decisão, que é o §10.2 ao contrário.
    cx.appendChild(el('div', 'descricao', a.corpo))
    if (a.medido && Object.keys(a.medido).length) {
      const det = el('details'); det.appendChild(el('summary', null, 'Ver os números medidos'))
      const pre = el('pre', null, JSON.stringify(a.medido, null, 2)); det.appendChild(pre); cx.appendChild(det)
    }

    const caixa = el('div', 'acao-caixa')
    if (!a.visto_em) {
      const b = el('button', 'btn sec', 'Dar ciência')
      b.addEventListener('click', () => acaoAviso('company_os_dar_ciencia', { p_ids: [a.id] }, 'Ciência registrada.'))
      caixa.appendChild(b)
    }
    // (M455) A resposta do COO chega como OUTRO aviso nesta fila (origem
    //    `resposta-ao-ceo`) — é o único caminho que o CEO lê sem depender de
    //    ninguém. O que a tela pode dizer aqui é que a pergunta existe e onde ela está.
    if (a.pergunta_id) caixa.appendChild(el('span', 'dica', 'Pergunta aberta ao COO — a resposta chega aqui, como um aviso “Resposta: …”. Veja o item em Organograma.'))
    else {
      const inp = el('input'); inp.placeholder = 'Perguntar ao COO (mínimo 10 letras)'
      const b2 = el('button', 'btn', 'Perguntar')
      b2.addEventListener('click', () => {
        if (inp.value.trim().length < 10) { mostrar($('msg-avisos'), 'Escreva a pergunta (mínimo 10 letras).', false); return }
        acaoAviso('company_os_perguntar_ao_coo', { p_aviso_id: a.id, p_pergunta: inp.value.trim() },
                  'Pergunta aberta ao COO, com o fato medido junto.')
      })
      caixa.append(inp, b2)
    }
    cx.appendChild(caixa)
    alvo.appendChild(cx)
  }
}
$('btn-ciencia').addEventListener('click', () => {
  const ids = (AVISOS.itens || []).filter((a) => !a.visto_em).map((a) => a.id).slice(0, 50)
  if (!ids.length) return
  acaoAviso('company_os_dar_ciencia', { p_ids: ids }, `Ciência registrada em ${ids.length} aviso(s).`)
})

function desenharMonitor() {
  const vig = RETRATO.vigilancia || { total: 0, vermelhos: [] };
  const p = RETRATO.plantao || {};
  const inv = RETRATO.invariantes || [];
  const os27 = inv.find((i) => i.id === 'OS27'); const os28 = inv.find((i) => i.id === 'OS28');
  const parados = (os27 && os27.detalhes && os27.detalhes.parados || []).length;
  const semTriagem = (os28 && os28.detalhes && os28.detalhes.pedidos_sem_triagem_total) || 0;
  $('pill-monitor').hidden = vig.vermelhos.length === 0; $('pill-monitor').textContent = String(vig.vermelhos.length); $('pill-monitor').className = 'pill vermelho';
  const k = $('kpis-monitor'); k.replaceChildren();
  kpi(k, 'Réguas verdes', `${num(vig.total - vig.vermelhos.length)}/${num(vig.total)}`, vig.vermelhos.length ? 'vermelhas: ' + vig.vermelhos.join(', ') : 'promoção liberada', vig.vermelhos.length ? 'atencao' : 'ok');
  kpi(k, 'Em execução agora', num((p.em_execucao || []).length), (p.em_execucao || []).map((i) => i.executor).join(', ') || 'executor ocioso', (p.em_execucao || []).length ? 'ok' : '', () => { F.estado = 'in_progress'; irPara('status'); render(); });
  kpi(k, 'Esperando a vez', num((p.na_fila || []).length), (p.na_fila || []).some((i) => i.ultima_falha) ? 'há item que já falhou' : 'na fila', '', () => { F.estado = 'ready'; irPara('status'); render(); });
  kpi(k, 'Parados há mais de 2h', num(parados), 'sem executor, sem despacho', parados ? 'atencao' : 'ok');
  kpi(k, 'Pedidos sem triagem', num(semTriagem), 'há mais de 2h', semTriagem ? 'atencao' : 'ok');
  const os29 = inv.find((i) => i.id === 'OS29'); const rampaParada = (os29 && os29.detalhes && os29.detalhes.parados || []).length;
  kpi(k, 'Rampa 7b parada', num(rampaParada), 'técnico há mais de 2h sem CI/CTO', rampaParada ? 'atencao' : 'ok');
  kpi(k, 'Último despacho', p.ultimo_despacho ? hhmm(p.ultimo_despacho) : '—', p.ultimo_despacho ? dia(p.ultimo_despacho) : 'o banco ainda não acordou o executor');

  $('sub-reguas').textContent = vig.vermelhos.length === 0 ? 'todas verdes — o CI lê estas mesmas réguas contra a produção a cada push' : `${vig.vermelhos.length} vermelha(s): os números do painel podem não valer nada até ficarem verdes`;
  // ⚠ 47 linhas iguais escondiam a que importa. Agora: um quadradinho por
  //    régua (o todo num olhar), as vermelhas abertas no topo, as verdes
  //    recolhidas atrás de um clique — nenhuma some.
  const sd = $('saude-reguas'); sd.replaceChildren();
  for (const i of inv) { const q = el('span', i.passou ? '' : 'v'); q.title = `${i.id} — ${i.passou ? 'verde' : 'VERMELHA'}: ${i.descricao}`; sd.appendChild(q); }
  const rg = $('reguas'); rg.replaceChildren();
  const regua = (i) => {
    const d = el('div', 'regua' + (i.passou ? '' : ' v'));
    d.append(el('span', 'cod', i.id));
    const t = el('div'); t.appendChild(el('div', 'txt', i.descricao));
    if (!i.passou) { const dt = el('details'); dt.append(el('summary', null, 'detalhes'), el('pre', null, JSON.stringify(i.detalhes, null, 2))); t.appendChild(dt); }
    d.appendChild(t); return d;
  };
  for (const i of inv.filter((x) => !x.passou)) rg.appendChild(regua(i));
  const verdes = inv.filter((x) => x.passou);
  if (verdes.length) {
    const det = el('details', 'reguas-verdes'); det.appendChild(el('summary', null, `Ver as ${verdes.length} verdes`));
    for (const i of verdes) det.appendChild(regua(i));
    rg.appendChild(det);
  }
  desenharRampas();
  linhas($('mon-executor'), (p.despachos || []).slice(0, 10).map((d) => [
    `${d.evento === 'company-os-liberado' ? 'executor acordado' : d.evento === 'company-os-entrega-aceita' ? 'conclusão acordada' : d.evento === 'company-os-pedido-novo' ? 'triagem acordada' : d.evento} · ${d.titulo || ''}`.trim(),
    `${quando(d.quando)}${d.enviado ? '' : ' · NÃO enviado'}`]));
  const dv = RETRATO.desvios || {};
  const pares = Object.entries(dv.por_desvio || {}).map(([k, v]) => [k, num(v)]);
  pares.push(['passos no caminho / total', `${num(dv.passos && dv.passos.no_caminho)} / ${num(dv.passos && dv.passos.total)}`]);
  pares.push(['itens com desvio', num(dv.itens && dv.itens.com_desvio)]);
  linhas($('mon-desvios'), pares);
}

const RAMPAS_TEXTO = { '7b': ['7b — tema técnico não volta ao CEO', 'Ligada: entrega técnica com CI verde é aceita pela régua e vai a produção; item técnico travado é decidido pelo CTO (devolver, cancelar ou escalar a você com motivo de negócio). Desligada: tudo volta a esperar o seu aceite, como na 7a.'] };
function desenharRampas() {
  const pr = $('painel-rampas'); if (!pr) return; pr.replaceChildren();
  const rampas = (RETRATO.estrutura && RETRATO.estrutura.rampas) || [];
  if (!rampas.length) { pr.appendChild(el('p', 'dica', 'Nenhuma rampa declarada.')); return; }
  for (const r of rampas) {
    const [tit, expl] = RAMPAS_TEXTO[r.nome] || [r.nome, ''];
    const bloco = el('div', 'rampa');
    const cab = el('div', 'rampa-cab'); cab.append(el('b', null, tit), el('span', 'sit ' + (r.ligada ? 'ok' : ''), r.ligada ? 'Ligada' : 'Desligada'));
    bloco.appendChild(cab);
    if (expl) bloco.appendChild(el('p', null, expl));
    bloco.appendChild(el('p', 'motivo-fonte', `${r.motivo} — ${quando(r.mudada_em)}`));
    const mudar = el('details'); mudar.appendChild(el('summary', null, r.ligada ? 'Desligar esta rampa…' : 'Ligar esta rampa…'));
    bloco.appendChild(mudar); pr.appendChild(bloco);
    const form = el('div', 'acao-caixa');
    const motivo = el('input'); motivo.type = 'text'; motivo.placeholder = (r.ligada ? 'Por que desligar' : 'Por que ligar') + ' (mínimo 10 letras)';
    const b = el('button', 'btn ' + (r.ligada ? 'perigo' : 'sec'), r.ligada ? 'Desligar rampa' : 'Ligar rampa'); const msg = el('p', 'aviso'); msg.hidden = true;
    b.addEventListener('click', async () => { b.disabled = true; try { await rpc('company_os_ligar_rampa', { p_nome: r.nome, p_ligada: !r.ligada, p_motivo: motivo.value.trim() }); await abrirCasa(); toast(`Rampa ${r.nome} ${r.ligada ? 'desligada' : 'ligada'}.`); } catch (err) { mostrar(msg, String(err.message || err), false); b.disabled = false; } });
    form.append(motivo, b, msg); mudar.appendChild(form);
  }
}

/* ── ABA Custos ───────────────────────────────────────────────────────────── */
function desenharCustos() {
  desenharMedidor($('medidor-consumo'));
  // ⚠ A pastilha na ABA existe para o aviso não ficar escondido atrás de um
  //    clique: o detalhe mora num lugar só, mas o SINAL aparece de qualquer
  //    aba. Ela só acende a partir da segunda faixa — pastilha que fica acesa
  //    sempre é pastilha que ninguém olha.
  const mc = (RETRATO.painel && RETRATO.painel.consumo) || {};
  const pc = $('pill-custos');
  const grave = mc.faixa === 'estourado' ? 'vermelho' : (mc.faixa === 'aviso_2' || mc.faixa === 'aviso_3') ? 'ambar' : null;
  pc.hidden = !grave;
  if (grave) { pc.className = 'pill ' + grave; pc.textContent = `${String(mc.percentual).replace('.', ',')}%`; pc.title = mc.aviso || ''; }
  const c = RETRATO.custos || {}; const cu = c.custeio || {};
  const filtrado = !!(F.empresa || F.produto || F.fila);
  const passaC = (i) => (!F.empresa || i.empresa === F.empresa) && (!F.produto || (i.produto || '— sem produto —') === F.produto) && (!F.fila || bate(F.fila, i.fila));
  const itensC = (cu.itens || []).filter(passaC);
  const realF = itensC.reduce((s, i) => s + Number(i.custo_real || 0), 0);
  const consumoF = itensC.reduce((s, i) => s + Number(i.consumo || 0), 0);
  const minutosF = itensC.reduce((s, i) => s + Number(i.minutos || 0), 0);
  const ac = cu.actions || {};
  const k = $('kpis-custos'); k.replaceChildren();
  kpi(k, 'Custo fixo do mês', moeda(cu.fixos_brl), `${(cu.fixos || []).length} contratos · câmbio ${Number(cu.cambio || 0).toFixed(2)}`);
  kpi(k, 'GitHub Actions no mês', `${num(Math.round(cu.minutos_total || 0))} min`, Number(ac.minutos_excedentes) > 0 ? `${num(Math.round(ac.minutos_excedentes))} min além da franquia = ${moeda(ac.excedente_brl)}` : `franquia de ${num(ac.franquia)} min`, Number(ac.minutos_excedentes) > 0 ? 'atencao' : 'ok');
  kpi(k, 'Custo real do mês', moeda(cu.custo_real_total), cu.provisorio ? 'fixos + excedente · provisório até o mês fechar' : 'mês fechado');
  kpi(k, 'Rateado nos itens' + (filtrado ? ' (filtro)' : ''), moeda(realF), `${num(itensC.length)} tarefa(s) · ${num(cu.rodadas)} rodadas no mês`);
  kpi(k, 'Consumo (chave de rateio)' + (filtrado ? ' (filtro)' : ''), moeda(consumoF), 'valor de tabela dos tokens — não é cobrança');
  kpi(k, 'Custo médio por tarefa', itensC.length ? moeda(realF / itensC.length) : '—', 'do custo real rateado');
  kpi(k, 'Parado esperando você', moeda(c.gasto_parado_esperando_voce), 'consumo já feito em itens travados');

  // custo real por tarefa
  $('sub-custeio').textContent = `${dia(cu.mes)} · ${num(itensC.length)} tarefa(s)${filtrado ? ' (com filtro)' : ''}`;
  const ti = $('custeio-itens'); ti.replaceChildren();
  const cabI = el('tr'); for (const [h, n] of [['Tarefa', 0], ['Fila', 0], ['Empresa / produto', 0], ['Rodadas', 1], ['Fatia', 1], ['Fixos rateados', 1], ['Actions', 1], ['Custo real', 1]]) cabI.appendChild(el('th', n ? 'n' : '', h)); ti.appendChild(cabI);
  for (const i of itensC.slice(0, 40)) {
    const r = el('tr');
    const tdF = el('td'); tdF.appendChild(tag(i.fila, 'fila', i.fila));
    const tdE = el('td'); tdE.append(tag(i.empresa, 'empresa', i.empresa), document.createTextNode(' / '), tag(i.produto || 'sem produto', 'produto', i.produto || '— sem produto —'));
    r.append(el('td', null, i.titulo), tdF, tdE, el('td', 'n', num(i.rodadas)), el('td', 'n', `${Number(i.fatia).toFixed(1)}%`), el('td', 'n', moeda(i.fixos_rateados)), el('td', 'n', moeda(i.actions_brl)), el('td', 'n', moeda(i.custo_real)));
    ti.appendChild(r);
  }
  const totI = el('tr', 'total'); const tdtI = el('td', null, `Total: ${num(itensC.length)} tarefa(s)`); tdtI.colSpan = 5;
  totI.append(tdtI, el('td', 'n', moeda(itensC.reduce((s, i) => s + Number(i.fixos_rateados || 0), 0))), el('td', 'n', moeda(itensC.reduce((s, i) => s + Number(i.actions_brl || 0), 0))), el('td', 'n', moeda(realF))); ti.appendChild(totI);

  // por fila (custo real)
  const filas = (RETRATO.estrutura.filas || []).map((f) => f.nome);
  const t = $('custos-filas'); t.replaceChildren();
  const cab = el('tr'); for (const [h, n] of [['Fila', 0], ['Tarefas', 1], ['Rodadas', 1], ['Consumo', 1], ['Custo real', 1]]) cab.appendChild(el('th', n ? 'n' : '', h)); t.appendChild(cab);
  for (const f of filas) {
    const dos = itensC.filter((i) => i.fila === f); if (!dos.length && F.fila && !bate(F.fila, f)) continue;
    const l = el('tr', 'clicavel' + (bate(F.fila, f) ? ' ativa' : ''));
    l.append(el('td', null, f), el('td', 'n', num(dos.length)), el('td', 'n', num(dos.reduce((s, i) => s + Number(i.rodadas || 0), 0))), el('td', 'n', moeda(dos.reduce((s, i) => s + Number(i.consumo || 0), 0))), el('td', 'n', moeda(dos.reduce((s, i) => s + Number(i.custo_real || 0), 0))));
    l.addEventListener('click', () => alternar('fila', f)); t.appendChild(l);
  }
  const tot = el('tr', 'total'); tot.append(el('td', null, 'Total'), el('td', 'n', num(itensC.length)), el('td', 'n', num(itensC.reduce((s, i) => s + Number(i.rodadas || 0), 0))), el('td', 'n', moeda(consumoF)), el('td', 'n', moeda(realF))); t.appendChild(tot);
  // A mesma soma da tabela, desenhada: uma medida, uma régua, o rótulo no texto.
  const bf = $('barras-filas'); bf.replaceChildren();
  const porFila = filas.map((f) => [f, itensC.filter((i) => i.fila === f).reduce((s, i) => s + Number(i.custo_real || 0), 0)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxF = Math.max(0, ...porFila.map(([, v]) => v));
  for (const [f, v] of porFila) {
    const b = el('button', bate(F.fila, f) ? 'ativa' : ''); b.title = `Filtrar pela fila ${f}`;
    const tr = el('span', 'trilho'); const sp = el('span'); sp.style.width = (maxF ? (v / maxF) * 100 : 0) + '%'; tr.appendChild(sp);
    b.append(el('span', null, f), tr, el('span', 'val', moeda(v)));
    b.addEventListener('click', () => alternar('fila', f)); bf.appendChild(b);
  }
  if (!porFila.length) bf.appendChild(el('p', 'dica', 'Nenhum custo rateado com os filtros atuais.'));

  // custos fixos (declaração executiva)
  const pf = $('painel-fixos'); pf.replaceChildren();
  for (const f of (cu.fixos || [])) {
    const linha = el('div', 'atual'); linha.append(el('span', null, f.item), el('span', null, `${f.moeda === 'USD' ? 'US$ ' + Number(f.valor).toFixed(2) + ' = ' : ''}${moeda(f.valor_brl)}/mês`));
    pf.append(linha, el('p', 'motivo', f.motivo));
  }
  const totF = el('div', 'atual total-fixos'); totF.append(el('span', null, 'Total'), el('span', null, `${moeda(cu.fixos_brl)}/mês`)); pf.appendChild(totF);
  pf.appendChild(el('p', 'motivo', `Total: ${moeda(cu.fixos_brl)}/mês. Actions: US$ ${Number(ac.preco_minuto_usd || 0).toFixed(3)}/min além de ${num(ac.franquia)} min. Só os minutos das rodadas do executor entram por tarefa; CI de PR e vigias ficam fora.`));
  const form = el('div', 'acao-caixa');
  const item = el('input'); item.type = 'text'; item.placeholder = 'Contrato (ex.: Vercel Pro)'; item.style.flex = '0 0 11rem';
  const valor = el('input'); valor.type = 'number'; valor.min = '0'; valor.step = '0.01'; valor.placeholder = 'Valor/mês'; valor.style.flex = '0 0 7rem';
  const moedaSel = el('select'); for (const m of ['BRL', 'USD']) { const o = el('option', null, m); o.value = m; moedaSel.appendChild(o); } moedaSel.style.flex = '0 0 5rem';
  const motivo = el('input'); motivo.type = 'text'; motivo.placeholder = 'Motivo (mínimo 10 letras) — valor 0 tira do rateio';
  const b = el('button', 'btn sec', 'Declarar custo fixo'); const msg = el('p', 'aviso'); msg.hidden = true;
  b.addEventListener('click', async () => { b.disabled = true; try { await rpc('company_os_declarar_custo_fixo', { p_item: item.value.trim(), p_valor: Number(valor.value), p_moeda: moedaSel.value, p_motivo: motivo.value.trim() }); await abrirCasa(); toast('Custo fixo declarado.'); } catch (err) { mostrar(msg, String(err.message || err), false); b.disabled = false; } });
  form.append(item, valor, moedaSel, motivo, b, msg);
  const decl = el('details'); decl.appendChild(el('summary', null, 'Declarar ou mudar um custo fixo…')); decl.appendChild(form); pf.appendChild(decl);

  // rodadas recentes
  const lanc = (c.lancamentos || []).filter((l) => (!F.empresa || l.empresa === F.empresa) && (!F.produto || (l.produto || '— sem produto —') === F.produto) && (!F.fila || bate(F.fila, l.fila)));
  $('sub-lanc').textContent = `${lanc.length} mais recentes${filtrado ? ' (com filtro)' : ''}`;
  const tl = $('lancamentos'); tl.replaceChildren();
  const cb = el('tr'); for (const [h, n] of [['Quando', 0], ['Item', 0], ['Fila', 0], ['Executor', 0], ['Minutos', 1], ['Consumo', 1]]) cb.appendChild(el('th', n ? 'n' : '', h)); tl.appendChild(cb);
  for (const l of lanc) {
    const r = el('tr');
    const tdF = el('td'); tdF.appendChild(tag(l.fila, 'fila', l.fila));
    r.append(el('td', null, quando(l.quando)), el('td', null, l.titulo), tdF, el('td', null, (l.executor || '—').split(' · ')[0]), el('td', 'n', l.minutos != null ? num(l.minutos) : '—'), el('td', 'n', moeda(l.valor)));
    tl.appendChild(r);
  }
}

/* ── ABA Report ───────────────────────────────────────────────────────────── */
for (const id of ['r-de', 'r-ate', 'r-fila', 'r-quem', 'r-nat', 'r-base']) $(id).addEventListener('change', () => desenharReport());
function desenharReport() {
  const de = $('r-de').value ? new Date($('r-de').value + 'T00:00:00') : null;
  const ate = $('r-ate').value ? new Date($('r-ate').value + 'T23:59:59') : null;
  const base = $('r-base').value;
  const lista = itens().filter((i) => {
    const t = i[base] ? new Date(i[base]) : null;
    if (!t) return false;
    if (de && t < de) return false; if (ate && t > ate) return false;
    if ($('r-fila').value && i.fila !== $('r-fila').value) return false;
    if ($('r-quem').value && i.quem_abriu !== $('r-quem').value) return false;
    if ($('r-nat').value && i.natureza !== $('r-nat').value) return false;
    return true;
  }).sort((a, b) => new Date(b[base]) - new Date(a[base]));
  const k = $('kpis-report'); k.replaceChildren();
  kpi(k, 'Itens no período', num(lista.length), `por ${$('r-base').selectedOptions[0].textContent.toLowerCase()}`);
  kpi(k, 'Concluídos', num(lista.filter((i) => i.estado === 'done').length), `${num(lista.filter((i) => i.estado === 'done' && i.tem_prova).length)} com prova`, 'ok');
  kpi(k, 'Parados / travados', num(lista.filter((i) => aberto(i) && pendente(i)).length), 'precisam de você', lista.some((i) => aberto(i) && pendente(i)) ? 'atencao' : '');
  kpi(k, 'Técnico × negócio', `${num(lista.filter((i) => i.natureza === 'técnico').length)} × ${num(lista.filter((i) => i.natureza === 'negócio').length)}`, 'itens por natureza');
  const custeio = new Map((((RETRATO.custos || {}).custeio || {}).itens || []).map((x) => [x.id, Number(x.custo_real || 0)]));
  const custoReal = (i) => custeio.has(i.id) ? custeio.get(i.id) : 0;
  kpi(k, 'Custo real (mês)', moeda(lista.reduce((s, i) => s + custoReal(i), 0)), 'rateado do que você paga · consumo: ' + moeda(lista.reduce((s, i) => s + Number(i.gasto || 0), 0)));
  kpi(k, 'Desvios', num(lista.reduce((s, i) => s + Number((i.caminho || {}).desvios || 0), 0)), `em ${num(lista.filter((i) => (i.caminho || {}).desvios > 0).length)} item(ns)`);

  const t = $('tabela-report'); t.replaceChildren();
  const cab = el('tr'); for (const [h, n] of [['Data', 0], ['Item', 0], ['Empresa / produto', 0], ['Fila', 0], ['Status', 0], ['Quem abriu', 0], ['Natureza', 0], ['Passos / desvios', 1], ['Custo real', 1]]) cab.appendChild(el('th', n ? 'n' : '', h)); t.appendChild(cab);
  for (const i of lista) {
    const r = el('tr');
    const tdE = el('td'); tdE.append(tag(i.empresa, 'empresa', i.empresa), document.createTextNode(' / '), tag(i.produto || 'sem produto', 'produto', i.produto || '— sem produto —'));
    const tdF = el('td'); tdF.appendChild(tag(i.fila, 'fila', i.fila));
    const tdS = el('td'); tdS.appendChild(tag(rotuloEstado(i.estado) || i.estado, 'estado', i.estado));
    const tdQ = el('td'); tdQ.appendChild(tag(i.quem_abriu || '—', 'quem', i.quem_abriu));
    const tdN = el('td'); tdN.appendChild(tag(i.natureza, 'natureza', i.natureza));
    const tdT = el('td'); const bt = el('button', 'btn-texto', i.titulo); bt.addEventListener('click', () => abrirGaveta(i.id)); tdT.appendChild(bt);
    r.append(el('td', null, quando(i[base])), tdT, tdE, tdF, tdS, tdQ, tdN, el('td', 'n', `${num((i.caminho || {}).passos_percorridos)} / ${num((i.caminho || {}).desvios)}`), el('td', 'n', moeda(custoReal(i))));
    t.appendChild(r);
  }
  const tot = el('tr', 'total'); const tdt = el('td', null, `Total: ${num(lista.length)} item(ns)`); tdt.colSpan = 8; tot.append(tdt, el('td', 'n', moeda(lista.reduce((s, i) => s + custoReal(i), 0)))); t.appendChild(tot);
}

/* ── peças pequenas ───────────────────────────────────────────────────────── */
function vazioGrande(titulo, texto) {
  const d = el('div', 'vazio-grande'); d.append(icone('certo'), el('b', null, titulo), el('span', null, texto)); return d;
}
const esperaTexto = (d) => { const n = Number(d) || 0; return n === 0 ? 'desde hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`; };
function lin(titulo, subPartes, dirTopo, dirBaixo, onClick, dirClasse) {
  const b = el(onClick ? 'button' : 'div', 'lin'); if (onClick) b.addEventListener('click', onClick);
  b.appendChild(el('span', 'lin-tit', titulo));
  const sub = el('span', 'lin-sub'); for (const p of subPartes.filter(Boolean)) sub.appendChild(typeof p === 'string' ? el('span', null, p) : p); b.appendChild(sub);
  const dir = el('span', 'lin-dir'); if (dirTopo) dir.appendChild(el('b', dirClasse || null, dirTopo)); if (dirBaixo) dir.appendChild(el('span', null, dirBaixo)); b.appendChild(dir);
  return b;
}
function linVazia(alvo, texto) { const d = el('div', 'lin-vazia'); d.append(icone('certo'), el('span', null, texto)); alvo.appendChild(d); }

/* ── VISÃO GERAL ──────────────────────────────────────────────────────────
   A primeira tela responde, nesta ordem: o que espera por mim, o que está
   andando sozinho, e quanto isso custa. Nenhum número nasce aqui — cada um é o
   mesmo que a página de origem mostra, e o clique leva até ela. */
function desenharInicio() {
  const h = new Date().getHours();
  const nome = ($('quem-nome').textContent || '').split(' ')[0];
  const inbox = RETRATO.inbox || { total: 0, itens: [] };
  const novos = (AVISOS.itens || []).filter((a) => !a.visto_em);
  const p = RETRATO.plantao || {};
  const exec = p.em_execucao || []; const fila = p.na_fila || [];
  const vig = RETRATO.vigilancia || { total: 0, vermelhos: [] };
  const cons = (RETRATO.painel && RETRATO.painel.consumo) || {};
  const cu = ((RETRATO.custos || {}).custeio) || {};

  const sa = $('saudacao'); sa.replaceChildren();
  const esq = el('div');
  esq.appendChild(el('h2', null, `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}${nome ? ', ' + nome : ''}`));
  const res = el('p', 'resumo');
  const partes = [];
  partes.push(inbox.total ? [`${inbox.total} decisão(ões)`, ' esperam por você'] : ['Nada', ' espera por você']);
  partes.push(novos.length ? [`${novos.length} aviso(s)`, ' sem ciência'] : ['nenhum aviso', ' novo']);
  partes.push(exec.length ? [`${exec.length} em execução`, ' agora'] : ['executor', ' ocioso']);
  partes.forEach(([b, t], n) => { if (n) res.appendChild(document.createTextNode(' · ')); res.append(el('b', null, b), document.createTextNode(t)); });
  esq.appendChild(res);
  sa.append(esq, el('p', 'dica', new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })));

  const k = $('kpis-inicio'); k.replaceChildren();
  const maisAntiga = Math.max(0, ...(inbox.itens || []).map((x) => Number(x.dias_esperando) || 0));
  kpi(k, 'Aprovações', num(inbox.total), inbox.total ? `a mais antiga ${esperaTexto(maisAntiga)}` : 'nada espera por você', inbox.total ? (maisAntiga >= 2 ? 'atencao' : 'alerta') : 'ok', () => irPara('aprov'), false, 'aprovar');
  kpi(k, 'Avisos sem ciência', num(novos.length), novos.length ? 'nada aqui pede decisão' : 'fila limpa', novos.length ? 'alerta' : 'ok', () => irPara('avisos'), false, 'sino');
  kpi(k, 'Em execução', num(exec.length), exec.length ? `${num(fila.length)} esperando a vez` : fila.length ? `ocioso · ${num(fila.length)} na fila` : 'executor ocioso', exec.length ? 'ok' : '', () => { F.estado = 'in_progress'; irPara('status'); render(); }, false, 'raio');
  kpi(k, 'Réguas verdes', `${num(vig.total - vig.vermelhos.length)}/${num(vig.total)}`, vig.vermelhos.length ? 'vermelha: ' + vig.vermelhos.join(', ') : 'todas verdes', vig.vermelhos.length ? 'atencao' : 'ok', () => irPara('monitor'), false, 'escudo');
  const fx = cons.faixa === 'estourado' ? 'atencao' : (cons.faixa === 'aviso_2' || cons.faixa === 'aviso_3') ? 'alerta' : cons.percentual == null ? '' : 'ok';
  const unidade = cons.unidade === 'USD' ? (n) => 'US$ ' + Number(n).toFixed(2).replace('.', ',') : (n) => num(n) + ' min';
  const kc = kpi(k, 'Consumo de Actions', cons.percentual == null ? '—' : `${String(cons.percentual).replace('.', ',')}%`, cons.usado == null ? 'sem medição' : `${unidade(cons.usado)} de ${unidade(cons.teto)}`, fx, () => irPara('custos'), false, 'medidor');
  if (cons.percentual != null) { const t = el('div', 'mini-trilho'); const sp = el('span'); sp.style.width = Math.min(100, Number(cons.percentual)) + '%'; t.appendChild(sp); kc.appendChild(t); }
  kpi(k, 'Custo real do mês', moeda(cu.custo_real_total), cu.provisorio ? 'fixos + excedente · provisório' : 'mês fechado', '', () => irPara('custos'), false, 'dinheiro');

  // Precisa de você
  const porId = new Map(todosItens().map((i) => [i.id, i]));
  const ia = $('inicio-aprov'); ia.replaceChildren();
  const pend = ((inbox.itens) || []).filter((x) => { const i = porId.get(x.id); return !i || passa(i); }).slice(0, 6);
  if (!pend.length) linVazia(ia, inbox.total ? 'Nada com os filtros atuais.' : 'Nada espera por você. A fila anda sozinha.');
  for (const x of pend) {
    const i = porId.get(x.id);
    const escalado = x.classe === 'travado' && x.contexto && x.contexto.escalado_pelo_cto;
    ia.appendChild(lin(x.titulo,
      [el('span', 'sit ' + (Number(x.dias_esperando) >= 2 ? 'parado' : 'espera'), escalado ? 'escalado pelo CTO' : (ROTULO_CLASSE[x.classe] || x.classe)), i && i.produto, i && i.fila],
      esperaTexto(x.dias_esperando), Number(x.custo_ja_gasto) > 0 ? moeda(x.custo_ja_gasto) : null,
      () => { irPara('aprov'); setTimeout(() => { const c = $('aprov-' + x.id); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = c.querySelector('input'); if (inp) inp.focus({ preventScroll: true }); } }, 60); },
      Number(x.dias_esperando) >= 2 ? 'quente' : null));
  }

  // Executor agora
  const ie = $('inicio-executor'); ie.replaceChildren();
  const st = el('div', 'exec-status');
  const lg = el('span', 'luz-grande' + (exec.length ? ' on' : fila.length ? ' espera' : '')); lg.appendChild(icone(exec.length ? 'raio' : 'relogio'));
  const tx = el('div'); tx.append(el('b', null, exec.length ? `${exec.length} em execução agora` : fila.length ? `${fila.length} esperando a vez` : 'Executor ocioso'),
    el('small', null, `último despacho ${p.ultimo_despacho ? quando(p.ultimo_despacho) : '—'} · redespacho automático ${p.redespacho_agendado ? 'ligado' : 'DESLIGADO'}`));
  st.append(lg, tx); ie.appendChild(st);
  const le = el('div', 'linhas-lista'); ie.appendChild(le);
  for (const x of exec) le.appendChild(lin(x.titulo, [el('span', 'sit anda', 'em execução'), x.squad, x.executor], `desde ${hhmm(x.desde)}`, null, porId.has(x.id) ? () => abrirGaveta(x.id) : null));
  for (const x of fila.slice(0, Math.max(0, 4 - exec.length))) le.appendChild(lin(x.titulo, [el('span', 'sit', 'próximo na fila'), x.squad, x.tentativas ? `já falhou ${x.tentativas}×` : null], null, null, porId.has(x.id) ? () => abrirGaveta(x.id) : null));
  if (!exec.length && !fila.length) linVazia(le, 'Nada na fila de execução.');

  // Distribuição por situação — os mesmos números dos filtros de Itens
  const idist = $('inicio-dist'); idist.replaceChildren();
  const abertosF = itens().filter(aberto);
  const est = ESTADOS.filter(([e]) => e !== 'done' && e !== 'cancelled').map(([e, rot]) => [e, rot, abertosF.filter((i) => i.estado === e).length]).filter(([, , n]) => n > 0);
  const tot = abertosF.length;
  const cabD = el('div', 'exec-status'); const tg = el('span', 'luz-grande'); tg.appendChild(icone('lista'));
  const txd = el('div'); txd.append(el('b', null, `${num(tot)} itens em aberto`), el('small', null, Object.keys(F).length ? 'com os filtros atuais' : 'em todas as empresas e produtos'));
  cabD.append(tg, txd); idist.appendChild(cabD);
  const pil = el('div', 'pilha');
  for (const [e, rot, n] of est) { const sp = el('span', 'c-' + e); sp.style.flexGrow = String(n); sp.title = `${rot}: ${n}`; pil.appendChild(sp); }
  if (tot) idist.appendChild(pil);
  const leg = el('div', 'leg');
  for (const [e, rot, n] of est) { const b = el('button'); b.title = `Ver só "${rot}"`; b.append(el('i', 'c-' + e), el('span', null, rot), el('b', null, num(n))); b.addEventListener('click', () => { F.estado = e; irPara('status'); render(); }); leg.appendChild(b); }
  if (!tot) linVazia(idist, 'Nada em aberto com os filtros atuais.');
  idist.appendChild(leg);

  // Avisos sem ciência
  const iav = $('inicio-avisos'); iav.replaceChildren();
  if (!novos.length) linVazia(iav, 'Nenhum aviso novo.');
  for (const a of novos.slice(0, 5)) {
    const d = Number(a.dias_sem_ciencia) || 0;
    iav.appendChild(lin(a.assunto, [el('span', 'sit ' + (d >= 7 ? 'parado' : 'espera'), d >= 1 ? `sem ciência há ${d} dia(s)` : 'novo'), a.origem], dia(a.criado_em), null, () => irPara('avisos')));
  }

  // Entregue pela régua
  const ir = $('inicio-regua'); ir.replaceChildren();
  const regua = ((RETRATO.estrutura && RETRATO.estrutura.entregas_da_regua) || []).filter((e) => (!F.empresa || e.empresa === F.empresa) && (!F.produto || (e.produto || '— sem produto —') === F.produto));
  $('inicio-regua-n').textContent = regua.length ? `${regua.length} entrega(s) — só para você saber` : '';
  if (!regua.length) linVazia(ir, 'Nenhuma entrega da régua nos últimos 7 dias com os filtros atuais.');
  for (const e of regua.slice(0, 8)) {
    const url = /^https?:\/\//.test(e.referencia || '') ? e.referencia : null;
    const l = lin(e.titulo, [el('span', 'sit ok', e.concluida ? 'em produção' : 'aceita pelo CI'), e.produto, e.fila], quando(e.aceita_em), url ? 'ver o PR ↗' : null,
      url ? () => window.open(url, '_blank', 'noopener,noreferrer') : null);
    ir.appendChild(l);
  }
}

/* ── render geral ─────────────────────────────────────────────────────────── */
function render() {
  if (!RETRATO) return;
  desenharChips(); montarSeletores();
  desenharAprov(); desenharStatus(); desenharOrg(); desenharPaths();
  desenharPedido(); desenharAvisos(); desenharMonitor(); desenharCustos(); desenharReport();
  desenharInicio(); desenharGaveta();
  mostrarAba();
}

aplicarTema(temaEscolhido());
boot();
