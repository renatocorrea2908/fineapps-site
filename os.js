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

const SUPABASE = 'https://tnwlomwoktqdfgjbzvvh.supabase.co';   // (S4/D-22) a casa do OS
const PUBLICA  = 'sb_publishable_ggXRY3l0pefgFGfwkmne3Q_DOTju8Ma';
const CHAVE_SESSAO = 'fineapps.os.sessao';

let SESSAO = null;
let RETRATO = null;
let RELOGIO = null;
// (28/09, G1b) 11 → 8 páginas: Caminhos e Report moram dentro de Itens; os endereços antigos (#paths, #report) levam para lá
const PAGINAS = ['inicio', 'aprov', 'aceite', 'avisos', 'status', 'filas', 'monitor', 'custos', 'pedido'];
const PAGINAS_ANTIGAS = { paths: ['status', 'lista'], report: ['status', 'relatorio'] };
let MODO_ITENS = 'lista';
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
  aceite: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
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
  seta_cima: 'M12 19V5M5 12l7-7 7 7',
  seta_baixo: 'M12 5v14M19 12l-7 7-7-7',
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

async function rpc(fn, corpo, tentouRenovar, tentouDeNovo) {
  const r = await fetch(`${SUPABASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: PUBLICA, Authorization: `Bearer ${SESSAO.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo || {}),
  });
  if (r.status === 401 && !tentouRenovar) { await renovar(); return rpc(fn, corpo, true, tentouDeNovo); }
  const texto = await r.text();
  // (27/09) 57014 = o banco cortou a consulta pelo teto de tempo; a consulta cortada é desfeita, então
  // repetir UMA vez é seguro — medido: a 2ª tentativa costuma responder (o 1º corte é o banco ocupado)
  if (!r.ok && !tentouDeNovo && /57014|statement timeout/.test(texto)) { await new Promise((ok) => setTimeout(ok, 1500)); return rpc(fn, corpo, tentouRenovar, true); }
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
  for (const id of ['inicio-aprov', 'inicio-executor', 'inicio-avisos']) {
    const d = el('div', 'esqueleto'); d.style.height = '9rem'; d.style.margin = '0 1.2rem 1.1rem'; $(id).replaceChildren(d);
  }
}

/* ── filtro cruzado ───────────────────────────────────────────────────────── */
const ROTULO_F = { empresa: 'Empresa', produto: 'Produto', fila: 'Fila', estado: 'Status', natureza: 'Natureza', quem: 'Quem abriu',
                   tipo: 'Tipo', origem: 'Origem', cliente: 'Cliente', prioridade: 'Prioridade', pendente: 'Parado em você', caminho: 'Caminho', squad: 'Squad', executor: 'Executor', qualidade: 'Qualidade' };
// (27/09, CEO) o card de qualidade do Monitor leva a Itens filtrado pelos itens que ELE contou (a porta devolve os ids)
let QUAL_SEL = null;
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
// (28/09, CEO) natureza, origem e tipo também no alto — o mesmo filtro que o clique na etiqueta liga
for (const k of ['natureza', 'origem', 'tipo', 'cliente']) {
  $('f-' + k).addEventListener('change', (e) => { if (e.target.value) F[k] = e.target.value; else delete F[k]; render(); });
}

/* ⚠ (26/09) "O que espera por VOCÊ" é o que o banco pôs na sua caixa
   (`inbox`, de `pendencias_do_ceo`) — e mais nada. A tela decidia sozinha
   (alçada OU entrega aberta OU decisão) e chamava de "aguarda o seu aceite"
   toda entrega técnica que a régua (7b) ou o CTO decidem: eram 12 "para você"
   na caixa do CEO quando a caixa tinha 5. */
let NA_CAIXA = new Map();        // id → classe, de RETRATO.inbox
const pendente = (i) => NA_CAIXA.has(i.id);
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
  if (F.origem && i.origem !== F.origem) return false;
  if (F.cliente && (i.cliente || INTERNO) !== F.cliente) return false;
  if (F.prioridade && i.prioridade !== F.prioridade) return false;
  if (F.squad && i.squad !== F.squad) return false;
  if (F.executor && i.executor !== F.executor) return false;
  if (F.pendente && !pendente(i)) return false;
  if (F.qualidade && !(QUAL_SEL && QUAL_SEL.has(i.id))) return false;
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
  const NO_ALTO = ['empresa', 'produto', 'natureza', 'origem', 'tipo', 'cliente'];   // estes têm seletor próprio no alto
  const chaves = Object.keys(F).filter((k) => !NO_ALTO.includes(k));
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
  for (const k of ['natureza', 'origem', 'tipo', 'cliente']) {
    const s = $('f-' + k);
    // valor filtrado que não está na lista (ex.: tipo que só aparece em item antigo) entra na hora — nunca some
    if (F[k] && ![...s.options].some((o) => o.value === F[k])) s.appendChild(new Option(k === 'tipo' ? rotuloTipo(F[k]) : k === 'origem' ? rotuloOrigem(F[k]) : F[k], F[k]));
    s.value = F[k] || ''; s.classList.toggle('ativo', !!F[k]);
  }
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
  // origem e tipo: os que existem nos itens, na ordem do catálogo (alto da tela e Report)
  const origens = Object.keys(ORIGENS).filter((o) => todosItens().some((i) => i.origem === o));
  const tipos = [...new Set(todosItens().map((i) => i.tipo).filter(Boolean))].sort((a, b) => rotuloTipo(a).localeCompare(rotuloTipo(b), 'pt-BR'));
  const clientes = [...new Set(todosItens().map((i) => i.cliente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (todosItens().some((i) => !i.cliente)) clientes.push(INTERNO);
  // o filtro Empresa é o DONO do item; com uma empresa só ele não separa nada e sai da tela
  $('grupo-empresa').hidden = new Set(todosItens().map((i) => i.empresa).filter(Boolean)).size <= 1 && !F.empresa;
  for (const [id, todos, lista, rot] of [['f-cliente', 'Todos', clientes, (x) => x], ['f-origem', 'Todas', origens, rotuloOrigem], ['r-origem', 'Todas', origens, rotuloOrigem],
                                          ['f-tipo', 'Todos', tipos, rotuloTipo], ['r-tipo', 'Todos', tipos, rotuloTipo]]) {
    const sel = $(id); const v = sel.value;
    sel.replaceChildren(new Option(todos, ''));
    for (const x of lista) sel.appendChild(new Option(rot(x), x));
    sel.value = v;
  }
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
  aprov: ['Aprovações', 'Pode ir? — itens que não começam sem a sua alçada'],
  aceite: ['Aceitações', 'Ficou bom? — entregas que só fecham com o seu aceite'],
  avisos: ['Avisos', 'O que você precisa saber e não exige decisão sua'],
  status: ['Itens', 'Tudo o que está em aberto, por situação e caminho — ou o relatório do período'],
  filas: ['Organograma', 'Quem carrega o quê, ao vivo'],
  monitor: ['Monitor', 'As réguas do sistema, as rampas de autonomia e o executor'],
  custos: ['Custos', 'Quanto você paga, quanto falta para o limite e onde foi parar'],
  pedido: ['Novo pedido', 'Entra assinado por você; a Triagem classifica e roteia'],
};
function irPara(aba) { if (PAGINAS_ANTIGAS[aba]) { MODO_ITENS = PAGINAS_ANTIGAS[aba][1]; aba = PAGINAS_ANTIGAS[aba][0]; } if (!PAGINAS.includes(aba)) return; ABA = aba; if (GAVETA) { GAVETA = null; desenharGaveta(); } mostrarAba(); window.scrollTo({ top: 0 }); }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-aba]:not(section)'); if (b) { irPara(b.dataset.aba); return; }
  const ir = e.target.closest('[data-ir]'); if (ir) irPara(ir.dataset.ir);
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (PAGINAS_ANTIGAS[h]) { irPara(h); return; } if (PAGINAS.includes(h) && h !== ABA) { ABA = h; mostrarAba(); } });
function mostrarAba() {
  for (const b of $('abas').querySelectorAll('button[data-aba]')) b.setAttribute('aria-selected', String(b.dataset.aba === ABA));
  for (const s of document.querySelectorAll('section.aba')) s.hidden = s.dataset.aba !== ABA;
  // (G1b) Itens: lista ou relatório do período
  for (const b of document.querySelectorAll('[data-modo-itens]')) b.setAttribute('aria-selected', String(b.dataset.modoItens === MODO_ITENS));
  $('itens-lista').hidden = MODO_ITENS !== 'lista'; $('itens-relatorio').hidden = MODO_ITENS !== 'relatorio';
  const [t, sub] = TITULOS[ABA] || ['', ''];
  $('titulo-pagina').textContent = t; $('sub-pagina').textContent = sub;
  document.title = `${t} — Command Center`;
  if (location.hash.slice(1) !== ABA) history.replaceState(null, '', '#' + ABA);
  fecharMenu();
}
function abrirMenu() { $('lateral').classList.add('aberta'); $('veu').hidden = false; }
function fecharMenu() { $('lateral').classList.remove('aberta'); $('veu').hidden = true; }
$('abrir-menu').addEventListener('click', abrirMenu);
for (const b of document.querySelectorAll('[data-modo-itens]')) b.addEventListener('click', () => { MODO_ITENS = b.dataset.modoItens; mostrarAba(); });
$('fechar-menu').addEventListener('click', fecharMenu);
$('veu').addEventListener('click', fecharMenu);

/* ── atalhos: 1–8 páginas, N novo pedido, R atualizar, T tema, Esc fecha ── */
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const alvo = e.target; const digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable);
  if (e.key === 'Escape') { if (POP) fecharFiltro(); else if (GAVETA) fecharGaveta(); else fecharMenu(); if (digitando) alvo.blur(); return; }
  if (digitando || $('app').hidden) return;
  if (/^[1-8]$/.test(e.key)) { irPara(PAGINAS[Number(e.key) - 1]); e.preventDefault(); return; }
  const k = e.key.toLowerCase();
  if (k === 'n') { irPara('pedido'); setTimeout(() => $('p-titulo').focus(), 50); e.preventDefault(); }
  else if (k === 'r') { atualizarAgora(); e.preventDefault(); }
  else if (k === 't') { cicloTema(); e.preventDefault(); }
});

/* ── vocabulário ──────────────────────────────────────────────────────────── */
const ESTADOS = [
  ['ready', 'Abertos, na fila'], ['in_progress', 'Em andamento'], ['validation', 'Entregues — em aceite'],
  ['decision_required', 'Parados — em decisão'], ['blocked', 'Bloqueados'], ['failed', 'Falharam'],
  ['done', 'Concluídos'], ['cancelled', 'Cancelados'],
];
const rotuloEstado = (k) => (ESTADOS.find(([e]) => e === k) || [])[1];
function tentativasTexto(i) {
  if (!i.tentativas) return '';
  const restam = (i.teto_tentativas || 0) - i.tentativas + 1;
  // (26/09) item técnico não sobe ao CEO: ao bater o teto, vai à mesa do CTO (ou a Triagem divide)
  const destino = (i.alcada === 'technical' || i.natureza === 'técnico') ? 'sai da fila e o CTO decide (não vem para você)' : 'vai para as suas Aprovações';
  return restam <= 1 ? `já falhou ${i.tentativas}× — se falhar de novo, ${destino}`
                     : `já falhou ${i.tentativas}× — restam ${restam} tentativas`;
}
function situacao(i) {
  if (i.estado === 'ready' && i.aguarda_alcada) return 'na fila — aguarda a sua alçada';
  if (i.estado === 'ready' && i.nao_antes_de && new Date(i.nao_antes_de) > new Date()) return `na fila — nova tentativa às ${hhmm(i.nao_antes_de)}${i.tentativas ? ' · ' + tentativasTexto(i) : ''}`;
  if (i.estado === 'ready' && i.tentativas) return `na fila — pronto para a próxima tentativa · ${tentativasTexto(i)}`;
  if (i.estado === 'ready') return 'na fila — o executor pega no próximo despacho';
  if (i.estado === 'in_progress') return `em execução por ${i.executor || '—'} desde ${hhmm(i.desde)}`;
  if (i.estado === 'validation') {
    if (!i.entrega_aberta) return 'aceita — o executor está concluindo';
    return NA_CAIXA.get(i.id) === 'entrega_aguarda_aceite' ? 'entregue — aguarda o SEU aceite' : 'entregue — o aceite é da régua (CI/CTO), não seu';
  }
  // ⚠ (26/09) "parado" nem sempre é com você: item técnico parado é do CTO, e estouro
  //    de turnos a Triagem divide. Só diz "precisa de você" o que está na SUA caixa.
  if (i.estado === 'decision_required') return NA_CAIXA.has(i.id) ? 'parado — precisa de você' : 'parado — com o CTO ou a Triagem (não é com você)';
  if (i.estado === 'done') return `concluído em ${quando(i.concluido)}${i.tem_prova ? ' · com prova' : ' · SEM prova'}`;
  return rotuloEstado(i.estado) || i.estado;
}

/* ⚠ O TOM da situação é a única cor do cartão. Antes tudo era cinza e negrito,
   e 60 itens tinham exatamente o mesmo peso visual — varrer a lista não dizia
   nada. Agora a cor responde "isto anda sozinho ou depende de mim?". */
function tomDoItem(i) {
  if (i.estado === 'decision_required') return NA_CAIXA.has(i.id) ? 'parado' : 'espera';
  if (NA_CAIXA.has(i.id)) return 'espera';
  if (i.estado === 'validation' && i.entrega_aberta) return 'anda';
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
/* (28/09, OS-59.5) o chamado que originou o item vira link: url_base do produto (M597) +
   ?abrir=chamado_id (M607) — o mesmo formato que src/lib/abrir-registro.ts lê no Stratum.
   Sem url_base declarada ou sem chamado_id, não aparece nada (nunca um link quebrado). */
function linkChamado(i) {
  if (!i.chamado_id) return null;
  const pInfo = (RETRATO.estrutura.produtos || []).find((p) => p.nome === i.produto);
  if (!pInfo || !pInfo.url_base) return null;
  const a = el('a', 'ligacao', 'Abrir o chamado em nova aba');
  a.appendChild(icone('externo'));
  a.href = `${pInfo.url_base}?abrir=${i.chamado_id}`;
  a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}
function cartaoItem(i, opts = {}) {
  const tom = tomDoItem(i);
  const cx = el('article', 'item clicavel' + (tom === 'parado' ? ' urgente' : pendente(i) && aberto(i) ? ' espera' : '') + (GAVETA === i.id ? ' aberto' : ''));
  const cab = el('button', 'item-cab'); cab.setAttribute('aria-haspopup', 'dialog'); cab.title = 'Abrir o detalhe';
  // (27/09, M551) o número do item vem antes do título — é por ele que se pergunta e se rastreia
  const h4 = el('h4'); if (i.codigo) h4.appendChild(el('span', 'codigo', i.codigo)); h4.appendChild(document.createTextNode(i.titulo)); cab.appendChild(h4);
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
           // (28/09, CEO) as três etiquetas: natureza · origem · tipo
           tagNatureza(i), tagOrigem(i), tagCliente(i),
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
  const lc = linkChamado(i); if (lc) cx.appendChild(lc);
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
  const h = el('h2'); if (i.codigo) h.appendChild(el('span', 'codigo', i.codigo)); h.appendChild(document.createTextNode(i.titulo)); h.id = 'gaveta-titulo'; c.appendChild(h);
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
  if (i.cliente) par('Cliente', i.cliente, 'cliente');
  if (ORIGENS[i.origem]) par('Origem', rotuloOrigem(i.origem) + (i.origem_ref ? ` · ${i.origem_ref}` : ''), 'origem', i.origem);
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
  const lc = linkChamado(i); if (lc) c.appendChild(lc);
  const p = desenharPath(i, 'det:gaveta-caminho:'); const d = p.querySelector('details'); if (d) d.open = true; c.appendChild(p);
}

function listar(alvo, lista, opts) {
  alvo.replaceChildren();
  if (!lista.length) { alvo.appendChild(el('p', 'vazio', opts && opts.vazio || 'Nada aqui com os filtros atuais.')); return; }
  for (const i of lista) alvo.appendChild(cartaoItem(i, opts));
}

/* ── ABA CC › Aprovações ──────────────────────────────────────────────────── */
const ROTULO_CLASSE = { aguarda_alcada: 'aguarda a sua alçada', deliberacao_escalada: 'deliberação escalada a você',
                        entrega_aguarda_aceite: 'entrega pronta — aguarda o seu aceite', travado: 'travado — estourou o limite' };
/* ⚠ (26/09) DUAS PERGUNTAS, DUAS PÁGINAS. "Pode ir?" (Aprovações: alçada,
   deliberação escalada, travado) e "Ficou bom?" (Aceitações: a entrega que só
   fecha com o seu aceite) moravam na mesma lista — e o CEO lia tudo como
   "está vindo para o meu aceite". A caixa é a mesma do banco; a tela só separa. */
const eAceite = (p) => p.classe === 'entrega_aguarda_aceite';
function desenharAprov() { desenharCaixa('aprov'); desenharCaixa('aceite'); }
/* ── A FICHA DE UMA PÁGINA (M472/D6) ──────────────────────────────────────
   O que o CEO lê antes de decidir: a pergunta, o negócio, a recomendação de
   cada executivo e custo/prazo DA CASA (calculados pelo banco, não por quem
   escreveu). A tela só mostra — nenhum número nasce aqui. */
const CARGO = { cfo: 'CFO', product: 'CPO', marketing: 'CMO', operations: 'COO / CTO' };
const POSICAO = { aprovar: ['aprovar', 'ok'], ajustar: ['ajustar', 'espera'], recusar: ['recusar', 'parado'] };
function desenharFicha(f) {
  const d = el('div', 'ficha-decisao');
  const ag = new Map(((RETRATO.estrutura && RETRATO.estrutura.agentes) || []).map((a) => [a.nome, a]));
  d.append(el('div', 'ficha-rot', 'A decisão'), el('div', 'ficha-pergunta', f.pergunta));
  if (f.negocio) d.append(el('div', 'ficha-rot', 'O negócio'), el('p', 'ficha-negocio', f.negocio));
  const recs = Array.isArray(f.recomendacoes) ? f.recomendacoes : [];
  if (recs.length) {
    d.appendChild(el('div', 'ficha-rot', 'O que cada executivo recomenda'));
    const g = el('div', 'ficha-recs');
    for (const r of recs) {
      const a = ag.get(r.executivo) || {};
      const nome = r.executivo === 'operacoes' ? 'Rayn Ops' : (r.persona || a.persona || r.executivo);
      const quem = el('div', 'ficha-quem'); quem.append(el('b', null, nome), el('small', null, CARGO[a.funcao] || a.funcao || ''));
      const [pt, tom] = POSICAO[r.posicao] || [r.posicao, ''];
      const l = el('div', 'ficha-rec'); l.append(quem, el('span', 'sit ' + tom, pt), el('div', null, r.porque || '')); g.appendChild(l);
    }
    d.appendChild(g);
  }
  const c = f.custo || {}, pz = f.prazo || {};
  const base = (x) => x && x.base_n != null ? `${x.base_pequena ? 'base pequena: ' : 'base: '}${num(x.base_n)} item(ns) ${x.base === 'mesmo tipo' ? 'do mesmo tipo' : 'de todos os tipos'}` : null;
  const numeros = el('div', 'ficha-numeros');
  const caixaN = (v, n, b) => { const x = el('div', 'ficha-num'); x.append(el('div', 'v', v), el('div', 'n', n)); if (b) x.appendChild(el('span', 'base', b)); numeros.appendChild(x); };
  if (c.estimado_brl != null) caixaN(moeda(c.estimado_brl), 'custo típico de um item como este, pelo histórico da casa', base(c));
  else if (c.referencia_da_casa) caixaN(moeda(c.ja_gasto_brl), `já gasto; um item como este custa ${moeda(c.referencia_da_casa.custo_mediano_brl)} no meio do histórico`, base(c.referencia_da_casa));
  if (pz.estimado_horas != null) caixaN(`~${String(Math.round(Number(pz.estimado_horas))).replace('.', ',')} h`, 'do início à entrega, no meio do histórico', base(pz));
  else if (pz.situacao) caixaN('entregue', pz.situacao, null);
  if (numeros.childNodes.length) d.append(el('div', 'ficha-rot', 'Custo e prazo, pelo histórico da casa'), numeros);
  d.appendChild(el('p', 'ficha-rodape', `Ficha escrita pela Triagem ${quando(f.escrita_em)}. Os números vêm do banco; quem escreve a ficha não pode alterá-los.`));
  return d;
}

function desenharCaixa(modo) {
  const ehAceite = modo === 'aceite';
  const porId = new Map(todosItens().map((i) => [i.id, i]));
  const daPagina = ((RETRATO.inbox && RETRATO.inbox.itens) || []).filter((p) => eAceite(p) === ehAceite);
  const lista = daPagina.filter((p) => { const i = porId.get(p.id); return !i || passa(i); });
  const total = daPagina.length;
  const pill = $('pill-' + modo);
  pill.textContent = String(total); pill.hidden = !total;
  pill.className = 'pill' + (total ? (ehAceite ? ' ambar' : ' vermelho') : '');
  const limpo = ehAceite ? 'Nenhuma entrega espera o seu aceite. O que é técnico, a régua (CI) e o CTO aceitam sozinhos.' : 'Nada espera a sua alçada. A fila anda sozinha.';
  $('sub-' + modo).textContent = lista.length === 0
    ? (total ? 'Nada com os filtros atuais.' : limpo)
    : ehAceite ? `${lista.length} entrega(s) prontas que só fecham com o seu aceite (ou recusa com motivo). As mais antigas primeiro.`
               : `${lista.length} item(ns) não começam até você decidir. As mais antigas primeiro.`;
  const alvo = $('lista-' + modo); alvo.replaceChildren();
  // (M472/D6) o que já subiu e ainda não tem a ficha: você vê que existe, mas só decide com a ficha
  const prep = (((RETRATO.inbox && RETRATO.inbox.em_preparo) || {}).itens || []).filter((x) => (x.classe === 'entrega_aguarda_aceite') === ehAceite);
  if (prep.length) {
    const f = el('div', 'em-preparo'); f.appendChild(el('span', 'ponto'));
    f.appendChild(el('span', null, `${num(prep.length)} decisão(ões) em preparo: a Triagem está escrevendo a ficha de uma página. ${prep.length === 1 ? 'Ela chega' : 'Elas chegam'} aqui quando estiver${prep.length === 1 ? '' : 'em'} completa${prep.length === 1 ? '' : 's'}.`));
    f.title = prep.map((x) => x.titulo).join('\n'); alvo.appendChild(f);
  }
  if (!lista.length) alvo.appendChild(vazioGrande(ehAceite ? 'Aceitações limpas' : 'Aprovações limpas', total ? 'Nada com os filtros atuais.' : limpo));
  for (const p of lista) {
    const i = porId.get(p.id);
    const cx = el('article', 'item ' + (Number(p.dias_esperando) >= 2 ? 'urgente' : 'espera'));
    cx.id = 'caixa-' + p.id;
    if (i) { const cab = el('button', 'item-cab'); cab.title = 'Abrir o detalhe'; cab.appendChild(el('h4', null, p.titulo)); cab.addEventListener('click', () => abrirGaveta(i.id)); cx.appendChild(cab); }
    else cx.appendChild(el('h4', null, p.titulo));
    if (i) { const lc = linkChamado(i); if (lc) cx.appendChild(lc); }
    const m = el('div', 'meta');
    // ⚠ Aprovações montava o próprio cartão e por isso ficou de fora da
    //    primeira passada — a aba mais importante da tela seguia com a linha
    //    corrida e com `impacto none` na cara do CEO. Mesmo padrão do resto:
    //    situação colorida, grupos com divisor, espera e dinheiro à direita.
    const escalado = p.classe === 'travado' && p.contexto && p.contexto.escalado_pelo_cto;
    m.appendChild(el('span', 'sit espera', escalado ? 'escalado pelo CTO — precisa da sua decisão' : (ROTULO_CLASSE[p.classe] || p.classe)));
    if (i) m.append(tag(i.empresa, 'empresa', i.empresa), tag(i.produto || 'sem produto', 'produto', i.produto || '— sem produto —'),
                    tag(i.fila, 'fila', i.fila), el('span', 'div', '·'), tagNatureza(i), tagOrigem(i), tag(rotuloTipo(i.tipo), 'tipo', i.tipo));
    const impA = IMPACTOS[p.impacto];
    if (impA) m.appendChild(el('span', null, impA));
    const dirA = el('span', 'meta-dir');
    // ⚠ "2 dia(s) esperando" é o número que ordena esta lista: fica à direita,
    //    alinhado com os outros, e em âmbar a partir de 2 dias.
    const esp = el('span', Number(p.dias_esperando) >= 2 ? 'quente' : null, esperaTexto(p.dias_esperando));
    dirA.appendChild(esp);
    if (Number(p.custo_ja_gasto) > 0) dirA.appendChild(el('span', 'dinheiro', moeda(p.custo_ja_gasto)));
    m.appendChild(dirA);
    cx.append(m); subirDir(cx);
    const ficha = p.contexto && p.contexto.ficha;
    if (ficha && ficha.pergunta) cx.appendChild(desenharFicha(ficha));
    else cx.appendChild(el('p', 'porque', p.porque_voce));
    if (i && i.descricao) { const d = chave(el('details'), 'det:pedido:' + p.id); d.append(el('summary', null, 'Ver o pedido inteiro'), el('div', 'descricao', i.descricao)); cx.appendChild(d); }
    if (p.classe === 'aguarda_alcada') {
      // (M455) A pergunta que o CEO já fez sobre este item, e a resposta quando
      // ela chegou — o banco as guarda no item; a tela só mostra.
      const pg = p.contexto && p.contexto.pergunta;
      if (pg && pg.id) {
        const q = el('div', 'pergunta');
        q.appendChild(el('p', 'porque', `Você perguntou${pg.em ? ' em ' + quando(pg.em) : ''}: “${pg.texto || '—'}”`));
        q.appendChild(pg.resposta
          ? el('p', 'porque resposta', `Resposta${pg.respondida_em ? ' em ' + quando(pg.respondida_em) : ''}: ${pg.resposta}`)
          : el('p', 'dica', pg.estado === 'cancelled' ? 'A pergunta foi cancelada.' : 'Sem resposta ainda — o Rayn Ops (COO / CTO) responde pela oficina; a resposta também chega na aba Avisos.'));
        cx.appendChild(q);
      }
      // ⚠ Três saídas, não uma: aprovar, reprovar (o NÃO com motivo — vai para
      //    `cancelado` com rastro `rejected`) e questionar (abre pergunta ao COO
      //    com este item como pai; o item continua aqui até você decidir).
      cx.appendChild(caixaAcao(p, [
        ['Aprovar', 'company_os_minha_aprovacao', 'p_observacao', { p_canal: 'tela-os' }],
        ['Questionar', 'company_os_questionar', 'p_pergunta'],
        ['Reprovar', 'company_os_reprovar', 'p_motivo', null, 'perigo'],
      ], 'Motivo (para aprovar ou reprovar) ou a pergunta ao COO / CTO (para questionar) — mínimo 10 letras'));
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
  // Só para você saber: o que a régua (CI) aceitou nos últimos 7 dias — informação, não pendência (M397).
  // Mora em Aceitações: é a outra metade da mesma pergunta ("ficou bom?"), respondida sem você.
  if (!ehAceite) return;
  const regua = ((RETRATO.estrutura && RETRATO.estrutura.entregas_da_regua) || []).filter((e) => (!F.empresa || e.empresa === F.empresa) && (!F.produto || (e.produto || '— sem produto —') === F.produto) && (!F.fila || bate(F.fila, e.fila)));
  const alvoR = $('lista-regua'); alvoR.replaceChildren();
  if (regua.length) {
    alvoR.appendChild(el('h3', 'info-titulo', `Aceito pela régua nos últimos 7 dias, sem precisar de você — só para você saber (${regua.length})`));
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
      alvoR.appendChild(cx);
    }
  }
}
function caixaAcao(p, botoes, placeholder) {
  const cx = el('div', 'acao-caixa');
  const campo = chave(el('input'), 'acao:' + p.id); campo.type = 'text'; campo.placeholder = placeholder; campo.setAttribute('aria-label', placeholder);
  const msg = el('p', 'aviso'); msg.hidden = true; msg.setAttribute('role', 'alert');
  const bs = [];
  for (const [rot, fn, campoNome, extra, classe] of botoes) {
    const b = el('button', 'btn' + (classe ? ' ' + classe : botoes.length > 1 && rot !== botoes[0][0] ? ' sec' : ''), rot);
    b.addEventListener('click', async () => {
      for (const x of bs) x.disabled = true;
      try {
        const corpo = { p_work_item_id: p.id, ...(extra || {}) }; corpo[campoNome] = campo.value.trim();
        await rpc(fn, corpo);
        campo.value = '';        // deu certo: o texto já foi; a atualização não o traz de volta
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
  // (27/09) o filtro de qualidade é sobre itens ENCERRADOS: com ele, os fechados aparecem sem precisar escolher a situação
  const lista = itens().filter((i) => F.estado || F.qualidade ? true : aberto(i)).sort((a, b) => new Date(b.atualizado || b.criado) - new Date(a.atualizado || a.criado));
  // (o texto abaixo continua dizendo onde clicar: agora o título abre o detalhe ao lado)
  // ⚠ A dica é texto de seção, não item: numa grade ela roubava uma célula e
  //    abria um buraco no canto. Atravessa as colunas.
  $('lista-status').replaceChildren(el('p', 'dica larga', F.qualidade && !F.estado ? `${lista.length} item(ns) — ${F.qualidade} · clique no título para abrir o detalhe` : F.estado ? `${lista.length} item(ns) em "${rotuloEstado(F.estado)}" · clique no título para abrir o detalhe` : `${lista.length} em aberto · clique numa situação para filtrar · clique no título para abrir o detalhe`));
  for (const i of lista) $('lista-status').appendChild(cartaoItem(i));
  if (!lista.length) $('lista-status').appendChild(el('p', 'vazio', 'Nada aqui com os filtros atuais.'));
}

/* ── ABA CC › Filas (organograma) ─────────────────────────────────────────── */
const C_LEVEL = [
  { papel: 'CFO', nome: 'Jack Check', filas: ['financeiro'], agente: 'jack-check' },
  { papel: 'CMO', nome: 'Phill Mark', filas: ['marketing'], agente: 'phill-mark' },
  { papel: 'CPO', nome: 'John Prod', filas: ['produto'], agente: 'john-prod' },
  { papel: 'COO / CTO', nome: 'Rayn Ops', filas: ['operacoes', 'engenharia'], agente: 'operacoes' },
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
  // (27/09) o estado também sai: com o filtro em "Cancelados" o mapa da casa zerava e parecia que ninguém trabalhava
  const guardados = { fila: F.fila, produto: F.produto, pendente: F.pendente, squad: F.squad, estado: F.estado }; delete F.fila; delete F.produto; delete F.pendente; delete F.squad; delete F.estado;
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
    nivelC.appendChild(caixa(c.agente === 'operacoes' ? 'coo' : '', c.papel, c.nome, 'fila ' + c.filas.join(' + '), contagens(dos), pressed, () => alternar('fila', c.filas.length === 1 ? c.filas[0] : c.filas)));
  }
  org.appendChild(nivelC);

  // Produtos: uma caixa por produto (clique filtra).
  org.appendChild(el('div', 'org-ligacao'));
  org.appendChild(el('div', 'org-rotulo', 'Produtos'));
  const prods = el('div', 'org-nivel');
  const nomes = [...(RETRATO.estrutura.produtos || []).map((p) => p.nome)];
  if (base.some((i) => !i.produto)) nomes.push('— sem produto —');
  for (const pn of nomes) {
    const dosP = base.filter((i) => (i.produto || '— sem produto —') === pn);
    const pInfo = (RETRATO.estrutura.produtos || []).find((p) => p.nome === pn);
    prods.appendChild(caixa('produto', 'Produto', pn, pInfo ? pInfo.empresa : 'itens sem produto', contagens(dosP), F.produto === pn, () => alternar('produto', pn)));
  }
  org.appendChild(prods);

  // (26/09, E4) As SQUADS são as pistas que executam — todas as abertas, com as
  // vagas (wip) e quantas estão em execução agora. Até o E4 esta linha só mostrava
  // a Operações (filtro antigo por fila) e as outras squads pareciam não existir.
  org.appendChild(el('div', 'org-ligacao'));
  org.appendChild(el('div', 'org-rotulo', 'Squads — as pistas que executam (sob o COO / CTO)'));
  const sqs = el('div', 'org-nivel');
  for (const s of (RETRATO.estrutura.squads || [])) {
    const dosS = base.filter((i) => i.squad === s.nome);
    const c = contagens(dosS);
    const livres = dosS.filter((i) => i.estado === 'ready' && !(i.nao_antes_de && new Date(i.nao_antes_de) > new Date())).length;
    sqs.appendChild(caixa('squad', 'Squad', s.nome, `${c.exec} de ${s.wip_max} vaga(s) em uso · ${livres} na fila`, c, F.squad === s.nome, () => alternar('squad', s.nome)));
  }
  org.appendChild(sqs);

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
  analytical_research: 'pergunta ao COO / CTO', cpi: 'melhoria contínua', exception: 'exceção',
  financial_analysis: 'análise financeira', governance_approval: 'aprovação de governança',
  maintenance: 'manutenção', market_analysis: 'análise de mercado', performance: 'desempenho',
  policy_change: 'mudança de política', pricing: 'preço', process_improvement: 'melhoria de processo',
  product_decision: 'decisão de produto', refactoring: 'refatoração',
};
const IMPACTOS = { none: null, low: 'impacto baixo', medium: 'impacto médio', high: 'impacto alto', critical: 'impacto crítico' };
const PRIORIDADES = { critica: 'crítica', alta: 'alta', media: 'média', baixa: 'baixa' };
const rotuloTipo = (k) => TIPOS[k] || String(k || '—').replace(/_/g, ' ');
/* (28/09, M587) de onde o item veio — gravado no banco no nascimento do item; a parte herda do pai. */
/* (28/09, M593) o cliente para quem o item é — vem com o chamado; item sem cliente é da casa */
const INTERNO = '— interno (da casa) —';
const ORIGENS = {
  chamado_bug: 'chamado · bug', chamado_melhoria: 'chamado · melhoria', pedido_ceo: 'pedido do CEO', pergunta_ceo: 'pergunta do CEO',
  backlog_en: 'backlog de engenharia', vigia: 'achado do Vigia', ci_vermelho: 'CI vermelho', sistema: 'sistema',
};
const rotuloOrigem = (k) => ORIGENS[k] || String(k || '—').replace(/_/g, ' ');
function tagNatureza(i) {
  const t = tag(i.natureza || '—', 'natureza', i.natureza);
  t.classList.add('tag-nat', i.natureza === 'técnico' ? 'tec' : 'neg');
  return t;
}
function tagCliente(i) {
  if (!i.cliente) return document.createTextNode('');
  const t = tag(i.cliente, 'cliente', i.cliente); t.classList.add('tag-cliente'); t.title = 'Cliente: ' + i.cliente + ' — clique para ver só os itens dele';
  return t;
}
function tagOrigem(i) {
  if (!ORIGENS[i.origem]) return document.createTextNode('');   // antes da M587 o retrato mandava pessoa/cliente/sistema: não mostra
  const t = tag(rotuloOrigem(i.origem) + (i.origem_ref ? ` ${i.origem_ref}` : ''), 'origem', i.origem);
  t.classList.add('tag-origem', 'o-' + i.origem);
  return t;
}

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
function desenharPath(i, prefixo = 'det:caminho:') {
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

  const det = chave(el('details'), prefixo + i.id);
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
  // (28/09, G1b) a aba Caminhos saiu: o filtro por caminho fica em Itens e o passo a passo, no detalhe do item
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
  d.append(r, el('div', 'v' + (String(val).length > 7 ? ' longo' : ''), val)); if (sub) d.appendChild(el('div', 's', sub));
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
async function acaoAviso(fn, corpo, msg, campo) {
  try {
    await rpc(fn, corpo)
    if (campo) campo.value = ''
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
      const det = chave(el('details'), 'det:medido:' + a.id); det.appendChild(el('summary', null, 'Ver os números medidos'))
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
    if (a.pergunta_id) caixa.appendChild(el('span', 'dica', 'Pergunta aberta ao COO / CTO — a resposta chega aqui, como um aviso “Resposta: …”. Veja o item em Organograma.'))
    else {
      const inp = chave(el('input'), 'perg:' + a.id); inp.placeholder = 'Perguntar ao COO / CTO (mínimo 10 letras)'
      // (M622) pedido devolvido por ser PERGUNTA: o texto do CEO já vem no campo — um clique e vai ao COO
      if (a.medido && a.medido.pergunta_sugerida && !inp.value) inp.value = String(a.medido.pergunta_sugerida)
      const b2 = el('button', 'btn', 'Perguntar')
      b2.addEventListener('click', () => {
        if (inp.value.trim().length < 10) { mostrar($('msg-avisos'), 'Escreva a pergunta (mínimo 10 letras).', false); return }
        acaoAviso('company_os_perguntar_ao_coo', { p_aviso_id: a.id, p_pergunta: inp.value.trim() },
                  'Pergunta aberta ao COO / CTO, com o fato medido junto.', inp)
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

/* (27/09, CEO) % entregue sem falha e % cancelado por falha, numa janela de data e hora (M549) */
function desenharQualidade() {
  const alvo = $('kpis-qualidade'); if (!alvo) return;
  barraJanela('janela-qualidade', 'qualidade', () => ({ de: new Date(Date.now() - 7 * 864e5), ate: new Date() }), () => desenharQualidade());
  const jq = dadosDaJanela('company_os_minha_qualidade', 'qualidade', () => desenharQualidade());
  alvo.replaceChildren();
  if (!jq) { alvo.appendChild(el('p', 'dica', 'carregando…')); return; }
  if (jq.erro || !jq.dados || jq.dados.encerrados == null) { alvo.appendChild(el('p', 'dica', 'A medida de qualidade chega com a M549.')); return; }
  const q = jq.dados; const pct = (v) => (v == null ? '—' : String(v).replace('.', ',') + '%');
  // (27/09, CEO) "ao clicar nesses cards, leva para Itens já filtrado" — pelos ids que a porta contou (M557)
  const irQual = (ids, rot) => Array.isArray(ids) ? () => {
    for (const k of Object.keys(F)) if (k !== 'empresa' && k !== 'produto') delete F[k];
    QUAL_SEL = new Set(ids); F.qualidade = `${rot} · ${rotuloJanela(JANELA.qualidade)}`;
    irPara('status'); render();
  } : null;
  const dicaClique = (ids) => Array.isArray(ids) ? ' · clique para ver os itens' : '';
  kpi(alvo, 'Entregues sem falha', pct(q.pct_entregues_sem_falha), `${num(q.concluidos_sem_falha)} de ${num(q.encerrados)} encerrados · ${num(q.concluidos_com_falha)} concluídos depois de falhar${dicaClique(q.ids_sem_falha)}`, q.pct_entregues_sem_falha == null ? '' : q.pct_entregues_sem_falha >= 70 ? 'ok' : 'atencao', irQual(q.ids_sem_falha, 'entregues sem falha'));
  kpi(alvo, 'Cancelados por falha', pct(q.pct_cancelados_por_falha), `${num(q.cancelados_por_falha)} de ${num(q.encerrados)} encerrados · ${num(q.divididos)} divididos (fora da conta)${dicaClique(q.ids_cancelados_por_falha)}`, q.pct_cancelados_por_falha > 10 ? 'atencao' : 'ok', irQual(q.ids_cancelados_por_falha, 'cancelados por falha'));
  kpi(alvo, 'Rodadas por item concluído', q.rodadas_por_concluido == null ? '—' : String(q.rodadas_por_concluido).replace('.', ','), 'quantas vezes o executor pegou o item até concluir');
  $('sub-qualidade').textContent = `itens encerrados em ${rotuloJanela(JANELA.qualidade)} · falha = rodada que voltou ou entrega recusada`;
}

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
  // (26/09) "Em execução" e "Esperando a vez" saíram daqui: a esteira acima diz os mesmos números da Visão geral e de Itens.
  esteira($('esteira-monitor'));
  kpi(k, 'Parados há mais de 2h', num(parados), 'sem executor, sem despacho', parados ? 'atencao' : 'ok');
  kpi(k, 'Pedidos sem triagem', num(semTriagem), 'há mais de 2h', semTriagem ? 'atencao' : 'ok');
  const os29 = inv.find((i) => i.id === 'OS29'); const rampaParada = (os29 && os29.detalhes && os29.detalhes.parados || []).length;
  kpi(k, 'Aceite Técnico parado', num(rampaParada), 'entrega técnica há mais de 2 h sem decisão do CI/CTO', rampaParada ? 'atencao' : 'ok');
  kpi(k, 'Último despacho', p.ultimo_despacho ? hhmm(p.ultimo_despacho) : '—', p.ultimo_despacho ? dia(p.ultimo_despacho) : 'o banco ainda não acordou o executor');
  desenharQualidade();

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
    if (!i.passou) { const dt = chave(el('details'), 'det:regua:' + i.id); dt.append(el('summary', null, 'detalhes'), el('pre', null, JSON.stringify(i.detalhes, null, 2))); t.appendChild(dt); }
    d.appendChild(t); return d;
  };
  for (const i of inv.filter((x) => !x.passou)) rg.appendChild(regua(i));
  const verdes = inv.filter((x) => x.passou);
  if (verdes.length) {
    const det = chave(el('details', 'reguas-verdes'), 'det:reguas-verdes'); det.appendChild(el('summary', null, `Ver as ${verdes.length} verdes`));
    for (const i of verdes) det.appendChild(regua(i));
    rg.appendChild(det);
  }
  desenharRampas();
  const robosDesligados = desenharRobos();
  if (robosDesligados) { const pm = $('pill-monitor'); pm.hidden = false; pm.className = 'pill vermelho'; pm.textContent = String(vig.vermelhos.length + robosDesligados); pm.title = `${robosDesligados} robô(s) desligado(s) no GitHub`; }
  const pista = (d) => { const m = String(d.detalhe || '').match(/pista ([\w-]+)/); return m ? m[1] : ''; };
  const situacao = (d) => d.enviado ? 'enviado' : /^FREIO/.test(d.detalhe || '') ? 'segurado pelo freio' : /^ROBÔ DESLIGADO/.test(d.detalhe || '') ? 'guardado (robô desligado)' : 'não enviado';
  tabelaExcel('mon-despachos', [
    { rot: 'Quando', valor: (d) => d.quando, texto: (d) => quando(d.quando), filtro: (d) => dia(d.quando) },
    { rot: 'Evento', valor: (d) => NOME_EVENTO[d.evento] || d.evento },
    { rot: 'Item', valor: (d) => d.titulo || '—', celula: (d) => { const b = el('button', 'btn-texto', d.titulo || '—'); if (d.work_item_id && todosItens().some((x) => x.id === d.work_item_id)) b.addEventListener('click', () => abrirGaveta(d.work_item_id)); return b; } },
    { rot: 'Pista', valor: pista },
    { rot: 'Situação', valor: situacao, celula: (d) => el('span', 'sit ' + (d.enviado ? 'ok' : 'parado'), situacao(d)) },
  ], p.despachos || [], { barra: 'barra-despachos', unidade: 'despacho(s)' });
  desenharDesvios();
}

/* (M466, 26/09) As rampas têm NOME de gente, e as duas regras de aceite são
   FIXAS da casa — sem botão. O nome e o "fixa" vêm do banco; este mapa só
   cobre o retrato de antes da M466, para a tela não voltar a mostrar código. */
/* ── ROBÔS DO GITHUB (M467/P-80) ──────────────────────────────────────────
   De 21 a 26/09 o robô do Aceite Técnico e o do merge ficaram DESLIGADOS no
   GitHub e ninguém soube: o banco mandava evento e o GitHub jogava fora. Agora
   o próprio GitHub diz o estado a cada rodada, o banco para de mandar para robô
   desligado e avisa — e a tela mostra aqui. Desligado = vermelho, sempre. */
const PARA_QUE_TIT = { 'oficina-os.yml': 'Executor', 'oficina-ci.yml': 'Aceite Técnico', 'oficina-entrega.yml': 'Merge', 'council-os.yml': 'Triagem' };
const PARA_QUE = { 'oficina-os.yml': 'Pega o item liberado da fila e faz o trabalho (código, teste, PR).',
                   'oficina-ci.yml': 'Espera o CI do PR e aceita ou recusa a entrega técnica.',
                   'oficina-entrega.yml': 'Faz o merge da entrega aceita e conclui o item.',
                   'council-os.yml': 'Classifica e divide pedidos novos, decide o técnico travado e escreve a ficha das decisões que sobem para você.' };
function desenharRobos() {
  const alvo = $('robos'); if (!alvo) return 0; alvo.replaceChildren();
  const robos = (RETRATO.estrutura && RETRATO.estrutura.robos) || null;
  if (!robos) { linVazia(alvo, 'O banco ainda não mede os robôs (chega com a M467).'); return 0; }
  if (!robos.length) { linVazia(alvo, 'Nenhuma medição ainda — ela acontece na próxima rodada da Oficina ou da Triagem.'); return 0; }
  let desligados = 0;
  /* (M473) Cada robô tem o SEU interruptor. Desligado por você: nada é enviado a
     ele, o que chegar fica guardado e sai sozinho quando você religar. Desligado
     NO GITHUB (sem ser por você) continua vermelho: é defeito, não escolha. */
  for (const r of robos) {
    const noGit = r.estado === 'active'; const sabe = r.estado !== 'desconhecido';
    const tem = 'pausado' in r; const pausado = !!r.pausado;
    if (sabe && !noGit) desligados++;
    const bloco = el('div', 'robo' + (pausado ? ' pausado' : (sabe && !noGit) ? ' quente' : ''));
    const cab = el('div', 'rampa-cab');
    const estado = pausado ? ['parado', 'Desligado por você'] : !sabe ? ['', 'sem medição'] : noGit ? ['ok', 'Ligado'] : ['parado', 'DESLIGADO no GitHub'];
    cab.append(el('b', null, PARA_QUE_TIT[r.workflow] || r.nome), el('span', 'sit ' + estado[0], estado[1]));
    bloco.appendChild(cab);
    bloco.appendChild(el('p', null, PARA_QUE[r.workflow] || r.nome));
    const rod = [];
    if (pausado) rod.push(`Desligado em ${quando(r.pausado_em)}: ${r.pausado_motivo || ''}`);
    else if (sabe && !noGit) rod.push(`Desligado no GitHub desde ${quando(r.mudou_em)} — religar em GitHub → Actions → Enable workflow`);
    if (Number(r.recusados_7d) > 0) rod.push(`${num(r.recusados_7d)} evento(s) guardado(s) — saem sozinhos quando ele voltar`);
    rod.push(r.fresco ? `estado medido ${quando(r.medido_em)}` : 'medição do GitHub velha');
    bloco.appendChild(el('p', 'motivo-fonte', rod.join(' · ')));
    if (tem) {
      const mudar = chave(el('details'), 'det:robo:' + r.workflow); mudar.appendChild(el('summary', null, pausado ? 'Religar…' : 'Desligar…'));
      const form = el('div', 'acao-caixa');
      const motivo = chave(el('input'), 'robo:' + r.workflow); motivo.type = 'text'; motivo.placeholder = (pausado ? 'Por que religar' : 'Por que desligar') + ' (mínimo 10 letras)';
      const tit = PARA_QUE_TIT[r.workflow] || r.nome;
      const b = el('button', 'btn ' + (pausado ? 'sec' : 'perigo'), pausado ? `Religar ${tit}` : `Desligar ${tit}`); const msg = el('p', 'aviso'); msg.hidden = true;
      b.addEventListener('click', async () => { b.disabled = true; try { const j = await rpc('company_os_ligar_robo', { p_workflow: r.workflow, p_ligado: pausado, p_motivo: motivo.value.trim() }); motivo.value = ''; await abrirCasa(); toast(`${tit}: ${pausado ? 'religado' : 'desligado'}.${j && Number(j.reenviados) ? ` ${j.reenviados} evento(s) guardado(s) reenviado(s).` : ''}`); } catch (err) { mostrar(msg, String(err.message || err), false); b.disabled = false; } });
      form.append(motivo, b, msg);
      if (!pausado) form.appendChild(el('p', 'dica', 'O que já está rodando termina. Daqui em diante nada é enviado a ele; o que chegar fica guardado.'));
      mudar.appendChild(form); bloco.appendChild(mudar);
    }
    alvo.appendChild(bloco);
  }
  return desligados;
}

/* (26/09, pedido do CEO) A rampa mostra O QUE FAZ — ligada e desligada —, não a
   ata da última mudança ("C3 resolvido.", parágrafo técnico): isso é histórico.
   O texto daqui vale até a M473 chegar; depois é o mesmo que vem do banco. */
const RAMPAS_TEXTO = {
  '7b': ['Aceite Técnico', 'Entrega técnica não volta para você. Com PR, o CI decide se aceita; sem PR, o CTO confere. Item técnico travado é decidido pelo CTO.', true],
  '7c': ['Aceite CEO', 'O que você já aprovou na entrada não volta para o seu aceite na saída: o CI aceita e você é informado.', true],
  freio_automatico: ['Stop por Custo Atingido', 'Para a casa quando o gasto do dia ou do mês passa do teto: nada novo é despachado até o gasto voltar para dentro. Desligada, o gasto só é medido e a casa segue.', false],
  plantao: ['Operações', 'Liga o trabalho automático: quando um item é liberado, o executor é acordado sozinho. Desligada, nada é despachado — os itens esperam na fila até ela voltar.', false],
};
function desenharRampas() {
  const pr = $('painel-rampas'); if (!pr) return; pr.replaceChildren();
  // (27/09, M554) o freio de gasto saiu por decisão do CEO — não há o que ligar
  const rampas = ((RETRATO.estrutura && RETRATO.estrutura.rampas) || []).filter((r) => r.nome !== 'freio_automatico');
  if (!rampas.length) { pr.appendChild(el('p', 'dica', 'Nenhuma rampa declarada.')); return; }
  const fixaDe = (r) => !!(r.fixa ?? (RAMPAS_TEXTO[r.nome] || [])[2]);
  const ordenadas = rampas.slice().sort((a, b) => Number(fixaDe(b)) - Number(fixaDe(a)));
  for (const r of ordenadas) {
    const [titL, explL] = RAMPAS_TEXTO[r.nome] || [r.nome, ''];
    const tit = r.rotulo || titL; const expl = explL || r.descricao; const fixa = fixaDe(r);
    const bloco = el('div', 'rampa' + (fixa ? ' fixa' : ''));
    const cab = el('div', 'rampa-cab'); cab.append(el('b', null, tit), el('span', 'sit ' + (r.ligada ? 'ok' : 'parado'), fixa ? 'Regra fixa' : r.ligada ? 'Ligada' : 'Desligada'));
    bloco.appendChild(cab);
    if (expl) bloco.appendChild(el('p', null, expl));
    if (fixa) { bloco.appendChild(el('p', 'motivo-fonte', 'Sempre ligada — regra da casa desde 21/09/2026, sem liga/desliga.')); pr.appendChild(bloco); continue; }
    bloco.appendChild(el('p', 'motivo-fonte', `${r.ligada ? 'Ligada' : 'Desligada'} desde ${quando(r.mudada_em)}`));
    const mudar = chave(el('details'), 'det:rampa:' + r.nome); mudar.appendChild(el('summary', null, r.ligada ? 'Desligar…' : 'Ligar…'));
    bloco.appendChild(mudar); pr.appendChild(bloco);
    const form = el('div', 'acao-caixa');
    const motivo = chave(el('input'), 'rampa:' + r.nome); motivo.type = 'text'; motivo.placeholder = (r.ligada ? 'Por que desligar' : 'Por que ligar') + ' (mínimo 10 letras)';
    const b = el('button', 'btn ' + (r.ligada ? 'perigo' : 'sec'), r.ligada ? `Desligar ${tit}` : `Ligar ${tit}`); const msg = el('p', 'aviso'); msg.hidden = true;
    b.addEventListener('click', async () => { b.disabled = true; try { await rpc('company_os_ligar_rampa', { p_nome: r.nome, p_ligada: !r.ligada, p_motivo: motivo.value.trim() }); motivo.value = ''; await abrirCasa(); toast(`${tit}: ${r.ligada ? 'desligado' : 'ligado'}.`); } catch (err) { mostrar(msg, String(err.message || err), false); b.disabled = false; } });
    form.append(motivo, b, msg); mudar.appendChild(form);
  }
}

const NOME_EVENTO = { 'company-os-liberado': 'Executor acordado', 'company-os-entrega-tecnica': 'Aceite Técnico acordado', 'company-os-entrega-aceita': 'Merge acordado',
  'company-os-pedido-novo': 'Triagem: pedido novo', 'company-os-quebrar': 'Triagem: dividir item', 'company-os-decidir-tecnico': 'CTO: decidir item técnico',
  'company-os-conferir-entrega': 'CTO: conferir entrega', 'company-os-ficha': 'Triagem: ficha de decisão' };

/* ── TABELA ESTILO EXCEL ──────────────────────────────────────────────────
   Pedido do CEO (26/09): "filtro nos títulos, estilo Excel". Cada título abre
   um menu: ordenar, buscar, marcar/desmarcar valores (com a contagem de cada).
   O estado fica por tabela e sobrevive à atualização automática; o total
   soma só o que está visível. Nenhum número novo: é recorte do que já veio. */
const TAB = {};                 // id da tabela → { filtros: {col: Set}, ordem: {col, dir} }
let POP = null;                 // o menu aberto
const txtCol = (c, l) => {
  const v = c.filtro ? c.filtro(l) : c.texto ? c.texto(l) : c.valor(l);
  return v == null || v === '' ? '(vazio)' : String(v);
};
function fecharFiltro() { if (POP) { POP.remove(); POP = null; } }
document.addEventListener('click', (e) => { if (POP && !POP.contains(e.target)) fecharFiltro(); });
window.addEventListener('resize', fecharFiltro);
function tabelaExcel(id, colunas, linhas, opcoes = {}) {
  const t = $(id); t.replaceChildren();
  const st = TAB[id] || (TAB[id] = { filtros: {}, ordem: null });
  let vis = linhas.filter((l) => colunas.every((c, k) => !st.filtros[k] || st.filtros[k].has(txtCol(c, l))));
  if (st.ordem && colunas[st.ordem.col]) {
    const c = colunas[st.ordem.col]; const d = st.ordem.dir;
    vis = vis.slice().sort((a, b) => {
      const x = c.valor(a), y = c.valor(b);
      if (x == null || x === '') return 1; if (y == null || y === '') return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true })) * d;
    });
  }
  const cab = el('tr');
  colunas.forEach((c, k) => {
    const th = el('th', c.n ? 'n' : '');
    const ordenada = st.ordem && st.ordem.col === k;
    const b = el('button', 'th-filtro' + (st.filtros[k] || ordenada ? ' ativo' : ''));
    b.type = 'button'; b.title = `Filtrar e ordenar por ${c.rot}`;
    b.append(el('span', null, c.rot), icone(ordenada ? (st.ordem.dir > 0 ? 'seta_cima' : 'seta_baixo') : 'filtro'));
    b.addEventListener('click', (e) => { e.stopPropagation(); if (POP && POP.dataset.dono === id + ':' + k) { fecharFiltro(); return; } abrirFiltro(b, id, k, colunas, linhas); });
    th.appendChild(b); cab.appendChild(th);
  });
  const thead = el('thead'); thead.appendChild(cab); t.appendChild(thead);
  const tb = el('tbody');
  for (const l of vis) {
    const r = el('tr');
    for (const c of colunas) {
      const td = el('td', c.n ? 'n' : '');
      const v = c.celula ? c.celula(l) : c.texto ? c.texto(l) : c.valor(l);
      if (v instanceof Node) td.appendChild(v); else td.textContent = v == null || v === '' ? '—' : String(v);
      r.appendChild(td);
    }
    tb.appendChild(r);
  }
  if (!vis.length) { const r = el('tr'); const td = el('td', 'vazio', 'Nada com estes filtros.'); td.colSpan = colunas.length; r.appendChild(td); tb.appendChild(r); }
  if (colunas.some((c) => c.somar)) {
    const r = el('tr', 'total');
    colunas.forEach((c, k) => {
      const td = el('td', c.n ? 'n' : '');
      if (k === 0) td.textContent = `Total: ${num(vis.length)}${vis.length !== linhas.length ? ' de ' + num(linhas.length) : ''} ${opcoes.unidade || 'linha(s)'}`;
      else if (c.somar) td.textContent = c.somar(vis.reduce((s, l) => s + (Number(c.valor(l)) || 0), 0));
      r.appendChild(td);
    });
    tb.appendChild(r);
  }
  t.appendChild(tb);
  const nf = Object.keys(st.filtros).length;
  const barra = opcoes.barra ? $(opcoes.barra) : null;
  if (barra) {
    barra.replaceChildren(); barra.hidden = !(nf || st.ordem);
    if (nf || st.ordem) {
      barra.append(icone('filtro'), el('span', null, `${num(vis.length)} de ${num(linhas.length)} ${opcoes.unidade || 'linha(s)'}${nf ? ` · ${nf} coluna(s) filtrada(s)` : ''}${st.ordem ? ` · ordenado por ${colunas[st.ordem.col].rot}` : ''}`));
      const lb = el('button', 'btn-texto', 'Limpar filtros desta tabela'); lb.type = 'button';
      lb.addEventListener('click', () => { TAB[id] = { filtros: {}, ordem: null }; render(); });
      barra.appendChild(lb);
    }
  }
  return vis;
}
function abrirFiltro(botao, id, k, colunas, linhas) {
  fecharFiltro();
  const st = TAB[id]; const c = colunas[k];
  const contagem = new Map();
  for (const l of linhas) { const v = txtCol(c, l); contagem.set(v, (contagem.get(v) || 0) + 1); }
  const valores = [...contagem.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const marcados = new Set(st.filtros[k] || valores);
  const p = el('div', 'filtro-pop'); p.dataset.dono = id + ':' + k; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', `Filtro de ${c.rot}`);
  const ord = el('div', 'filtro-ordem');
  for (const [rot, dir] of [[c.n ? 'Menor → maior' : 'A → Z', 1], [c.n ? 'Maior → menor' : 'Z → A', -1]]) {
    const b = el('button', 'filtro-item' + (st.ordem && st.ordem.col === k && st.ordem.dir === dir ? ' ativo' : '')); b.type = 'button';
    b.append(icone(dir > 0 ? 'seta_cima' : 'seta_baixo'), el('span', null, `Ordenar ${rot}`));
    b.addEventListener('click', () => { st.ordem = st.ordem && st.ordem.col === k && st.ordem.dir === dir ? null : { col: k, dir }; fecharFiltro(); render(); });
    ord.appendChild(b);
  }
  p.appendChild(ord);
  const busca = el('input'); busca.type = 'search'; busca.placeholder = 'Buscar…'; busca.setAttribute('aria-label', 'Buscar valor');
  p.appendChild(busca);
  const lista = el('div', 'filtro-lista');
  const todos = el('label', 'filtro-opcao todos'); const cbT = el('input'); cbT.type = 'checkbox';
  todos.append(cbT, el('span', null, '(Selecionar tudo)'));
  lista.appendChild(todos);
  const caixas = [];
  for (const v of valores) {
    const lb = el('label', 'filtro-opcao'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = marcados.has(v);
    cb.addEventListener('change', () => { if (cb.checked) marcados.add(v); else marcados.delete(v); sincronizar(); });
    lb.append(cb, el('span', null, v), el('small', null, num(contagem.get(v))));
    lista.appendChild(lb); caixas.push([v, lb, cb]);
  }
  const sincronizar = () => { const vis = caixas.filter(([, lb]) => !lb.hidden); cbT.checked = vis.every(([, , cb]) => cb.checked); cbT.indeterminate = !cbT.checked && vis.some(([, , cb]) => cb.checked); };
  cbT.addEventListener('change', () => { for (const [v, lb, cb] of caixas) if (!lb.hidden) { cb.checked = cbT.checked; if (cbT.checked) marcados.add(v); else marcados.delete(v); } sincronizar(); });
  busca.addEventListener('input', () => { const q = busca.value.trim().toLowerCase(); for (const [v, lb] of caixas) lb.hidden = !!q && !v.toLowerCase().includes(q); sincronizar(); });
  p.appendChild(lista);
  const pe = el('div', 'filtro-pe');
  const limpar = el('button', 'btn-texto', 'Limpar'); limpar.type = 'button';
  limpar.addEventListener('click', () => { delete st.filtros[k]; if (st.ordem && st.ordem.col === k) st.ordem = null; fecharFiltro(); render(); });
  const aplicar = el('button', 'btn', 'Aplicar'); aplicar.type = 'button';
  aplicar.addEventListener('click', () => {
    if (!marcados.size) { busca.focus(); busca.placeholder = 'Marque pelo menos um valor'; return; }
    if (marcados.size === valores.length) delete st.filtros[k]; else st.filtros[k] = new Set(marcados);
    fecharFiltro(); render();
  });
  pe.append(limpar, aplicar); p.appendChild(pe);
  busca.addEventListener('keydown', (e) => { if (e.key === 'Enter') aplicar.click(); });
  sincronizar();
  document.body.appendChild(p);
  const r = botao.getBoundingClientRect(); const larg = p.offsetWidth;
  p.style.top = (r.bottom + window.scrollY + 6) + 'px';
  p.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - larg - 8)) + 'px';
  POP = p; busca.focus();
}

/* ── A ESTEIRA DE TRABALHO ───────────────────────────────────────────────
   Pedido do CEO (26/09): "a visão geral dá a ideia de que não tem nada
   ocorrendo, quando tem 56 itens esperando; o monitor mostra outros números;
   está desconexo". Uma peça só, lida por Visão geral e Monitor, com os MESMOS
   números da página Itens (os itens do retrato, com o filtro de empresa e
   produto). E ela diz o que os números sozinhos escondiam: dos que estão na
   fila, quantos estão LIBERADOS e quantos estão SEGURADOS por decisão (e até
   quando); das entregas, quantas são suas e quantas estão com a régua — e há
   quanto tempo paradas. */
function esteira(alvo) {
  alvo.replaceChildren();
  const guard = F.estado; delete F.estado;
  const base = todosItens().filter(passa);
  if (guard) F.estado = guard;
  const agora = Date.now();
  const naFila = base.filter((i) => i.estado === 'ready');
  const segurados = naFila.filter((i) => i.nao_antes_de && new Date(i.nao_antes_de) > agora);
  const liberados = naFila.length - segurados.length;
  const sua = naFila.filter((i) => NA_CAIXA.get(i.id) === 'aguarda_alcada').length;
  const datas = new Map(); for (const i of segurados) { const d = dia(i.nao_antes_de); datas.set(d, (datas.get(d) || 0) + 1); }
  const dataComum = [...datas.entries()].sort((a, b) => b[1] - a[1])[0];
  const exec = base.filter((i) => i.estado === 'in_progress');
  const emAceite = base.filter((i) => i.estado === 'validation');
  const seus = emAceite.filter((i) => NA_CAIXA.get(i.id) === 'entrega_aguarda_aceite').length;
  const daRegua = emAceite.filter((i) => i.entrega_aberta && !NA_CAIXA.has(i.id));
  const reguaParada = daRegua.filter((i) => agora - new Date(i.atualizado || i.criado) > 2 * 3600e3).length;
  const travados = base.filter((i) => ['decision_required', 'blocked', 'failed'].includes(i.estado));
  const semana = base.filter((i) => i.estado === 'done' && i.concluido && agora - new Date(i.concluido) <= 7 * 864e5);
  const etapa = (n, rot, sub, tom, estado, alerta) => {
    const b = el('button', 'etapa' + (tom ? ' ' + tom : '')); b.type = 'button';
    b.append(el('span', 'etapa-rot', rot), el('span', 'etapa-n', num(n)));
    const s = el('span', 'etapa-sub'); for (const x of [].concat(sub).filter(Boolean)) s.appendChild(el('span', null, x)); b.appendChild(s);
    if (alerta) { const a = el('span', 'etapa-alerta'); a.append(icone('alerta'), el('span', null, alerta)); b.appendChild(a); }
    b.title = `Ver só "${rot}" em Itens`;
    b.addEventListener('click', () => { F.estado = estado; irPara('status'); render(); });
    alvo.appendChild(b);
  };
  etapa(naFila.length, 'Na fila', [`${num(liberados)} liberado(s)`, segurados.length ? `${num(segurados.length)} segurado(s)${dataComum ? ` — a maioria até ${dataComum[0]}` : ''}` : null, sua ? `${num(sua)} esperam a sua alçada` : null],
        liberados ? '' : 'calmo', 'ready', null);
  etapa(exec.length, 'Em execução', exec.length ? exec.map((i) => i.executor || '—').filter((v, n, a) => a.indexOf(v) === n) : ['executor ocioso'], exec.length ? 'anda' : 'calmo', 'in_progress', null);
  etapa(emAceite.length, 'Entregues, em aceite', [seus ? `${num(seus)} esperam o SEU aceite` : 'nenhuma espera você', daRegua.length ? `${num(daRegua.length)} com a régua (CI/CTO)` : null],
        reguaParada ? 'alerta' : emAceite.length ? 'espera' : 'calmo', 'validation', reguaParada ? `${num(reguaParada)} parada(s) há mais de 2 h na régua` : null);
  etapa(travados.length, 'Travados', travados.length ? ['precisam de decisão ou falharam'] : ['nenhum'], travados.length ? 'parado' : 'calmo', 'decision_required', null);
  etapa(semana.length, 'Concluídos em 7 dias', [`${num(semana.filter((i) => i.tem_prova).length)} com prova`], semana.length ? 'ok' : 'calmo', 'done', null);
  return { naFila: naFila.length, liberados, segurados: segurados.length, exec: exec.length, emAceite: emAceite.length, reguaParada };
}

/* ── CUSTO MÉDIO POR… (26/09, pedido do CEO) ──────────────────────────────
   Uma medida só — o custo real do mês, a mesma régua dos itens — aberta por
   agente, squad, cliente, produto e fila. Por agente vem do banco (M473: cada
   rodada leva a sua fatia); os outros são recortes dos itens já rateados. */
const NOME_AGENTE = { 'executor-actions': 'Executor (Oficina)', 'council-actions': 'Council (antes da separação por papel, 27/09)', 'histórico': 'Histórico (antes da medição por rodada)',
  // (27/09) cada papel grava a própria rodada
  triagem: 'Triagem', 'triagem-divisao': 'Triagem — divisão', 'cto-decisao': 'CTO — decisão do time', 'cto-conferencia': 'CTO — conferência de entrega',
  ficha: 'Ficha de decisão', 'cto-capacidade': 'CTO — relatório de capacidade', merge: 'Merge (conclusão)', 'aceite-ci': 'Aceite Técnico (CI)' };
let MEDIA_POR = 'squad';
// (29/09, CEO) o que o custo real tem e item nenhum carrega (triagem, council, CTO): sem ele, toda quebra por item
//   (fila, produto, cliente, squad, a tabela por item) soma abaixo do total. Sem filtro, entra como linha própria.
function semItemDo(cu) {
  const somaItens = (cu.itens || []).reduce((s, i) => s + Number(i.custo_real || 0), 0)
  const custo = Math.max(0, Number(cu.custo_real_total || 0) - somaItens)
  const rodadas = cu.triagem ? Number(cu.triagem.rodadas || 0) : (cu.por_agente || []).filter((a) => !Number(a.itens)).reduce((s, a) => s + Number(a.rodadas || 0), 0)
  return { custo, rodadas, somaItens, rotulo: 'Rodadas sem item (triagem, council, CTO)' }
}
function desenharMedias(cu, itensC, filtrado) {
  const alvo = $('medias-por'); if (!alvo) return;
  const sel = $('medias-seletor'); sel.replaceChildren();
  const dims = [['agente', 'Agente'], ['squad', 'Squad'], ['cliente', 'Cliente'], ['produto', 'Produto'], ['fila', 'Fila']];
  for (const [k, r] of dims) {
    const b = el('button', 'badge', r); b.type = 'button'; b.setAttribute('aria-pressed', String(MEDIA_POR === k));
    b.addEventListener('click', () => { MEDIA_POR = k; desenharMedias(cu, itensC, filtrado); }); sel.appendChild(b);
  }
  const porId = new Map(todosItens().map((i) => [i.id, i]));
  let linhasM;
  if (MEDIA_POR === 'agente') {
    linhasM = (cu.por_agente || []).map((a) => ({ grupo: NOME_AGENTE[a.agente] || a.agente, itens: Number(a.itens) || 0, rodadas: Number(a.rodadas) || 0, custo: Number(a.custo_real) || 0 }));
  } else {
    const chaveDe = { squad: (i) => i.squad || (porId.get(i.id) || {}).squad || '—', cliente: (i) => i.empresa || '—', produto: (i) => i.produto || '— sem produto —', fila: (i) => i.fila || '—' }[MEDIA_POR];
    const g = new Map();
    for (const i of itensC) { const k = chaveDe(i); const x = g.get(k) || { grupo: k, itens: 0, rodadas: 0, custo: 0 }; x.itens++; x.rodadas += Number(i.rodadas) || 0; x.custo += Number(i.custo_real) || 0; g.set(k, x); }
    linhasM = [...g.values()];
    const si = semItemDo(cu)
    if (!filtrado && si.custo >= 0.01) linhasM.push({ grupo: si.rotulo, itens: 0, rodadas: si.rodadas, custo: si.custo })
  }
  const rot = dims.find(([k]) => k === MEDIA_POR)[1];
  tabelaExcel('medias-por', [
    { rot, valor: (l) => l.grupo },
    { rot: 'Itens', n: 1, valor: (l) => l.itens, texto: (l) => num(l.itens), somar: num },
    { rot: 'Rodadas', n: 1, valor: (l) => l.rodadas, texto: (l) => num(l.rodadas), somar: num },
    { rot: 'Custo real', n: 1, valor: (l) => l.custo, texto: (l) => moeda(l.custo), somar: moeda },
    { rot: 'Médio por item', n: 1, valor: (l) => (l.itens ? l.custo / l.itens : 0), texto: (l) => (l.itens ? moeda(l.custo / l.itens) : '—') },
    { rot: 'Médio por rodada', n: 1, valor: (l) => (l.rodadas ? l.custo / l.rodadas : 0), texto: (l) => (l.rodadas ? moeda(l.custo / l.rodadas) : '—') },
  ], linhasM, { barra: 'barra-medias', unidade: 'grupo(s)' });
  const nota = $('medias-nota');
  nota.textContent = MEDIA_POR === 'agente'
    ? (cu.por_agente ? `Por agente não segue os filtros de cima. Inclui as rodadas sem item (Triagem, CTO, ficha): ${num(cu.triagem && cu.triagem.rodadas)} no período. A separação por papel vale a partir de 27/09; antes, tudo era "Council".` : 'O custo por agente chega com a M473.')
    : `${MEDIA_POR === 'cliente' ? 'Cliente = a empresa dona do item. ' : ''}${filtrado ? 'Segue os filtros de cima.' : ''}`;
}

/* ── JANELA DE DATA E HORA (27/09, CEO) ─────────────────────────────────────
   "Quanto custou de sábado 21h a domingo 10h?" O banco responde qualquer janela
   (M549); a tela guarda a janela escolhida e pede os números uma vez por janela. */
const JANELA = {};
const DADOS_JANELA = {};
const doisDig = (n) => String(n).padStart(2, '0');
const paraInput = (d) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}T${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`;
const inicioDoMes = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };
const inicioDoDia = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
function janelaDe(chaveJ, padrao) { if (!JANELA[chaveJ]) JANELA[chaveJ] = padrao(); return JANELA[chaveJ]; }
function rotuloJanela(j) {
  const f = (d) => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${f(j.de)} → ${f(j.ate)}`;
}
function barraJanela(alvoId, chaveJ, padrao, aoMudar, nota) {
  const alvo = $(alvoId); if (!alvo) return;
  const j = janelaDe(chaveJ, padrao);
  alvo.replaceChildren();
  const campo = (rot, v) => { const w = el('div'); const lb = el('label', null, rot); const i = el('input'); i.type = 'datetime-local'; i.value = paraInput(v); w.append(lb, i); return [w, i]; };
  const [wDe, iDe] = campo('De', j.de); const [wAte, iAte] = campo('Até', j.ate);
  const aplicar = (de, ate) => { if (!(de < ate)) { toast('O fim tem de vir depois do início.'); return; } JANELA[chaveJ] = { de, ate }; aoMudar(); };
  iDe.addEventListener('change', () => aplicar(new Date(iDe.value), new Date(iAte.value)));
  iAte.addEventListener('change', () => aplicar(new Date(iDe.value), new Date(iAte.value)));
  const at = el('div', 'atalhos');
  for (const [r, f] of [['Hoje', () => [inicioDoDia(), new Date()]], ['24 h', () => [new Date(Date.now() - 864e5), new Date()]],
                        ['7 dias', () => [new Date(Date.now() - 7 * 864e5), new Date()]], ['Este mês', () => [inicioDoMes(), new Date()]]]) {
    const b = el('button', 'badge', r); b.type = 'button'; b.addEventListener('click', () => { const [de, ate] = f(); aplicar(de, ate); }); at.appendChild(b);
  }
  alvo.append(wDe, wAte, at);
  if (nota) alvo.appendChild(el('span', 'nota', nota));
}
// pede à porta uma vez por janela; enquanto não chega, quem desenha usa o que tem e é chamado de novo
function dadosDaJanela(fn, chaveJ, aoChegar) {
  const j = JANELA[chaveJ]; if (!j) return null;
  const k = `${fn}|${j.de.toISOString()}|${j.ate.toISOString()}`;
  const c = DADOS_JANELA[k];
  if (c && c.pronto) return c;
  if (!c) {
    DADOS_JANELA[k] = { pronto: false };
    rpc(fn, { p_de: j.de.toISOString(), p_ate: j.ate.toISOString() })
      .then((d) => { DADOS_JANELA[k] = { pronto: true, dados: d || {} }; aoChegar(); })
      .catch((e) => { DADOS_JANELA[k] = { pronto: true, erro: String(e.message || e) }; aoChegar(); });
  }
  return null;
}

/* ── DESVIOS (M558, 27/09, CEO) ───────────────────────────────────────────────
   "coloca o percentual de cada item na linha e um botão de Análise que gera um report em md
   com a análise das causas raízes. E os 7 dias devem ser configuráveis: Total, último ano,
   último semestre, tri, mês, semana". O período muda a janela da porta; o % é do total de
   desvios da janela; a Análise é pedida ao banco, que junta o dossiê e acorda o CTO. */
const PERIODOS_DESVIO = [['semana', 'Semana', 7], ['mes', 'Mês', 30], ['tri', 'Trimestre', 91], ['semestre', 'Semestre', 182], ['ano', 'Ano', 365], ['total', 'Total', null]];
let PERIODO_DESVIO = 'semana';
let VIGIA_ANALISE = null;
function janelaDoPeriodo(k) {
  const p = PERIODOS_DESVIO.find((x) => x[0] === k) || PERIODOS_DESVIO[0];
  const ate = new Date(); const de = p[2] == null ? new Date('2020-01-01T00:00:00Z') : new Date(ate.getTime() - p[2] * 864e5);
  return { de, ate };
}
const pctTxt = (v) => (v == null ? '—' : String(v).replace('.', ',') + '%');
const ESTADO_ANALISE = { pedida: 'na fila do CTO', em_andamento: 'o CTO está escrevendo', pronta: 'pronta', falhou: 'falhou' };
function desenharDesvios() {
  const alvo = $('mon-desvios'); if (!alvo) return;
  const per = $('desvios-periodo'); per.replaceChildren();
  for (const [k, rot] of PERIODOS_DESVIO) {
    const b = el('button', 'badge', rot); b.type = 'button'; b.setAttribute('aria-pressed', String(PERIODO_DESVIO === k));
    b.addEventListener('click', () => { PERIODO_DESVIO = k; JANELA.desvios = janelaDoPeriodo(k); desenharDesvios(); });
    per.appendChild(b);
  }
  if (!JANELA.desvios) JANELA.desvios = janelaDoPeriodo(PERIODO_DESVIO);
  const jd = dadosDaJanela('company_os_meus_desvios', 'desvios', () => desenharDesvios());
  const rotP = (PERIODOS_DESVIO.find((x) => x[0] === PERIODO_DESVIO) || [])[1] || '';
  // antes da M558 (ou enquanto a porta não responde) vale o retrato de 7 dias, sem botão
  if (!jd || jd.erro || !jd.dados || !Array.isArray(jd.dados.lista)) {
    const dv = RETRATO.desvios || {};
    const tot = Object.values(dv.por_desvio || {}).reduce((a, b) => a + Number(b || 0), 0);
    const pares = Object.entries(dv.por_desvio || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, `${num(v)} · ${tot ? pctTxt(Math.round(1000 * v / tot) / 10) : '—'}`]);
    pares.push(['passos no caminho / total', `${num(dv.passos && dv.passos.no_caminho)} / ${num(dv.passos && dv.passos.total)}`]);
    pares.push(['itens com desvio', num(dv.itens && dv.itens.com_desvio)]);
    linhas(alvo, pares);
    $('sub-desvios').textContent = !jd ? 'carregando o período…' : 'últimos 7 dias · o período e a Análise chegam com a M558';
    $('mon-analises').replaceChildren();
    return;
  }
  const d = jd.dados;
  $('sub-desvios').textContent = `${rotP} · ${num(d.passos && d.passos.desvios)} desvio(s) em ${num(d.passos && d.passos.total)} passos · % = parte do total de desvios`;
  alvo.replaceChildren();
  for (const x of d.lista) {
    const l = el('div', 'linha desvio-linha');
    const nome = el('span', null, x.rotulo); if (!x.conhecido) nome.title = 'passo que o caminho não prevê e que ainda não tem nome';
    const val = el('span', 'd', `${num(x.n)} · ${pctTxt(x.pct_dos_desvios)}`); val.title = `${num(x.itens)} item(ns) · ${pctTxt(x.pct_dos_passos)} de todos os passos`;
    const b = el('button', 'btn-mini', 'Análise'); b.type = 'button'; b.title = 'Pedir ao CTO um relatório de causa raiz deste desvio, no período escolhido';
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await rpc('company_os_pedir_analise_desvio', { p_de_loc: x.de, p_para_loc: x.para, p_de: JANELA.desvios.de.toISOString(), p_ate: JANELA.desvios.ate.toISOString() });
        toast(r && r.repetido ? 'Esta análise já está com o CTO — o relatório aparece aqui embaixo.' : 'Análise pedida. O CTO escreve o relatório em alguns minutos; ele aparece aqui embaixo.');
        recarregarDesvios();
      } catch (e) { toast(String(e.message || e), false); b.disabled = false; }
    });
    l.append(nome, val, b); alvo.appendChild(l);
  }
  if (!d.lista.length) alvo.appendChild(el('p', 'vazio', 'Nenhum desvio no período.'));
  const resumo = el('div', 'linha total'); resumo.append(el('span', null, 'passos no caminho / total'), el('span', 'd', `${num(d.passos && d.passos.no_caminho)} / ${num(d.passos && d.passos.total)} · ${pctTxt(d.pct_passos_no_caminho)}`)); alvo.appendChild(resumo);
  const res2 = el('div', 'linha total'); res2.append(el('span', null, 'itens com desvio'), el('span', 'd', `${num(d.itens && d.itens.com_desvio)} de ${num(d.itens && d.itens.que_se_mexeram)} · ${pctTxt(d.pct_itens_com_desvio)}`)); alvo.appendChild(res2);
  desenharAnalises(d.analises || []);
}
function recarregarDesvios() {
  for (const k of Object.keys(DADOS_JANELA)) if (k.startsWith('company_os_meus_desvios|')) delete DADOS_JANELA[k];
  desenharDesvios();
}
function desenharAnalises(lista) {
  const a = $('mon-analises'); a.replaceChildren();
  if (!lista.length) return;
  a.appendChild(el('h3', null, 'Análises de causa raiz'));
  for (const x of lista.slice(0, 12)) {
    const l = el('div', 'linha analise ' + x.estado);
    const t = el('span', null, `${x.rotulo} · ${dia(x.periodo_de)} → ${dia(x.periodo_ate)}`);
    const est = el('span', 'd', x.estado === 'falhou' && x.erro ? `falhou: ${x.erro}` : `${ESTADO_ANALISE[x.estado] || x.estado} · ${quando(x.pronto_em || x.pedido_em)}`);
    l.append(t, est);
    if (x.estado === 'pronta') { const b = el('button', 'btn-mini', 'Ler'); b.type = 'button'; b.addEventListener('click', () => abrirAnalise(x.id)); l.appendChild(b); }
    a.appendChild(l);
  }
  // enquanto houver análise em curso, a lista se atualiza sozinha (a cada 30 s, só com o Monitor aberto)
  const emCurso = lista.some((x) => x.estado === 'pedida' || x.estado === 'em_andamento');
  if (emCurso && !VIGIA_ANALISE) VIGIA_ANALISE = setTimeout(() => { VIGIA_ANALISE = null; if (ABA === 'monitor') recarregarDesvios(); }, 30000);
}
// markdown → DOM, sem innerHTML: cabeçalhos, listas, negrito, código e parágrafos
function mdParaDom(md) {
  const raiz = el('div', 'md');
  const inline = (alvo, txt) => {
    for (const parte of String(txt).split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
      if (!parte) continue;
      if (/^\*\*[^*]+\*\*$/.test(parte)) alvo.appendChild(el('strong', null, parte.slice(2, -2)));
      else if (/^`[^`]+`$/.test(parte)) alvo.appendChild(el('code', null, parte.slice(1, -1)));
      else alvo.appendChild(document.createTextNode(parte));
    }
  };
  let lista = null; let par = null; let bloco = null;
  const fecha = () => { lista = null; par = null; };
  for (const linha of String(md || '').split('\n')) {
    if (/^```/.test(linha)) { if (bloco) { bloco = null; } else { fecha(); bloco = el('pre'); raiz.appendChild(bloco); } continue; }
    if (bloco) { bloco.appendChild(document.createTextNode(linha + '\n')); continue; }
    const h = linha.match(/^(#{1,4})\s+(.*)$/);
    if (h) { fecha(); const e = el('h' + Math.min(6, h[1].length + 1)); inline(e, h[2]); raiz.appendChild(e); continue; }
    const li = linha.match(/^\s*(?:[-*]|\d+[.)])\s+(.*)$/);
    if (li) { par = null; if (!lista) { lista = el(/^\s*\d/.test(linha) ? 'ol' : 'ul'); raiz.appendChild(lista); } const e = el('li'); inline(e, li[1]); lista.appendChild(e); continue; }
    if (!linha.trim()) { fecha(); continue; }
    lista = null;
    if (!par) { par = el('p'); raiz.appendChild(par); } else par.appendChild(document.createTextNode(' '));
    inline(par, linha.trim());
  }
  return raiz;
}
async function abrirAnalise(id) {
  let a;
  try { a = await rpc('company_os_minha_analise_desvio', { p_id: id }); } catch (e) { toast(String(e.message || e), false); return; }
  if (!a || !a.relatorio_md) { toast('O relatório ainda não está pronto.', false); return; }
  const fundo = el('div', 'leitor-fundo'); fundo.setAttribute('role', 'dialog'); fundo.setAttribute('aria-modal', 'true'); fundo.setAttribute('aria-label', 'Análise de causa raiz');
  const caixa = el('div', 'leitor');
  const cab = el('div', 'leitor-cab');
  cab.appendChild(el('span', 'leitor-tit', `${a.rotulo} · ${dia(a.periodo_de)} → ${dia(a.periodo_ate)}`));
  const baixar = el('button', 'btn sec', 'Baixar .md'); baixar.type = 'button';
  baixar.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([a.relatorio_md], { type: 'text/markdown;charset=utf-8' }));
    const l = document.createElement('a'); l.href = url; l.download = `analise-${String(a.rotulo).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${String(a.pronto_em || '').slice(0, 10)}.md`;
    document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
  const fechar = el('button', 'btn sec', 'Fechar'); fechar.type = 'button';
  const sair = () => { fundo.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') sair(); };
  fechar.addEventListener('click', sair); fundo.addEventListener('click', (e) => { if (e.target === fundo) sair(); });
  document.addEventListener('keydown', esc);
  cab.append(baixar, fechar);
  caixa.append(cab, mdParaDom(a.relatorio_md));
  fundo.appendChild(caixa); document.body.appendChild(fundo); fechar.focus();
}

/* ── COMPOSIÇÃO DOS MINUTOS DO GITHUB (M557, 27/09, CEO) ──────────────────────
   "mantém o de cima. em baixo, quebra em mais cards: CI, agentes... e o que mais precisar para
   compor o número de cima". O de cima é a fatura; aqui, o mesmo total medido run a run. */
const NOME_WORKFLOW = {
  'test-plano.yml': 'Plano de Testes', 'oficina-os.yml': 'Executor', 'council-os.yml': 'Council (Triagem e CTO)',
  'oficina-ci.yml': 'Aceite do CI', 'oficina-entrega.yml': 'Merge', 'portao-squad.yml': 'Portão da squad',
  'scan-segredos.yml': 'Scan de segredos', 'vigia-diario.yml': 'Vigia diário', 'backup-diario.yml': 'Backup',
  'serie-diaria.yml': 'Série diária', 'faxina-reservas.yml': 'Faxina de reservas', 'medir-actions.yml': 'Medidor de minutos', 'ping.yml': 'Ping',
};
// (27/09, CEO) "já temos GitHub nas rodadas dos agentes. Quero outra dessa para workflow, para CI, etc."
// Um card por origem, no MESMO formato e na MESMA fileira do card dos agentes (M557, medido run a run).
const CARD_ORIGEM = { ci: 'GitHub no CI', robos: 'GitHub nos robôs de aceite e merge', rotinas: 'GitHub nas vigias e rotinas', outros_repos: 'GitHub no site e outros repositórios', outros: 'GitHub em outros workflows' };
// (OS-188, 29/09, CEO) "abaixo dos minutos consumidos, o custo em fonte de igual tamanho; a composição
// some e só aparece no hover" — os minutos e o custo competiam por espaço com a explicação o tempo todo.
// Reaproveita a classe 'v' para o custo (mesma fonte do valor principal) e esconde a composição
// (percentual + a lista de workflows, quando existir) até o mouse passar sobre o card.
function kpiMinCusto(alvo, rot, minTxt, custoTxt, compTxt, cls) {
  const d = kpi(alvo, rot, minTxt, null, cls);
  d.classList.add('kpi-custo-hover');
  d.appendChild(el('div', 'v v-custo' + (String(custoTxt).length > 7 ? ' longo' : ''), custoTxt));
  const comp = el('div', 'composicao', compTxt);
  d.appendChild(comp);
  return comp;
}
function kpisGithubPorOrigem(k, daJanela) {
  const jg = dadosDaJanela('company_os_meus_minutos_github', 'custos', () => desenharCustos());
  if (!jg) return;   // a porta ainda não respondeu: o desenho volta quando ela chegar
  const g = jg.dados || {};
  if (jg.erro || !Array.isArray(g.categorias) || !g.coletado_ate) {
    kpi(k, daJanela ? 'GitHub no CI e nos robôs (janela)' : 'GitHub no CI e nos robôs', '—', jg.erro || !Array.isArray(g.categorias) ? 'medição por workflow chega com a M557' : 'o medidor ainda não gravou nenhuma execução (roda a cada 2 h)');
    return;
  }
  const total = Number(g.minutos) || 0;
  for (const cat of ['ci', 'robos', 'rotinas', 'outros_repos', 'outros']) {
    const c = g.categorias.find((x) => x.categoria === cat);
    if (!c && cat !== 'ci' && cat !== 'robos' && cat !== 'rotinas') continue;   // origem sem uso na janela não vira card
    const min = c ? Number(c.minutos) : 0;
    const comp = kpiMinCusto(k, CARD_ORIGEM[cat] + (daJanela ? ' (janela)' : ''), `${num(min)} min`, moeda(c ? c.brl : 0),
      `${total ? pctTxt(Math.round(1000 * min / total) / 10) : '—'} dos minutos pagos (além da franquia)`,
      cat === 'ci' && total && min / total > 0.5 ? 'atencao' : 'ok');
    if (c && (c.workflows || []).length) {
      const lw = el('div', 's lista-fixos');
      for (const w of c.workflows.slice(0, 6)) lw.appendChild(el('span', null, `${NOME_WORKFLOW[w.workflow] || w.nome || w.workflow}${cat === 'outros_repos' ? ' (' + w.repo + ')' : ''}: ${num(w.minutos)} min · ${num(w.runs)} execuç${Number(w.runs) === 1 ? 'ão' : 'ões'}`));
      comp.appendChild(lw);
    }
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
  const c = RETRATO.custos || {};
  // (27/09) a janela escolhida manda; até a porta responder (ou se ela ainda não existir) vale o mês do retrato
  barraJanela('janela-custos', 'custos', () => ({ de: inicioDoMes(), ate: new Date() }), () => desenharCustos());
  const jc = dadosDaJanela('company_os_meu_custeio', 'custos', () => desenharCustos());
  const daJanela = !!(jc && jc.dados && jc.dados.itens);
  const cu = daJanela ? jc.dados : (c.custeio || {});
  const rotJ = daJanela ? rotuloJanela(JANELA.custos) : 'mês corrente';
  if (jc && jc.erro) $('janela-custos').appendChild(el('span', 'nota', 'A janela de datas chega com a M549 — até lá, os números são do mês corrente.'));
  else if (!jc) $('janela-custos').appendChild(el('span', 'nota', 'carregando a janela…'));
  const filtrado = !!(F.empresa || F.produto || F.fila);
  const passaC = (i) => (!F.empresa || i.empresa === F.empresa) && (!F.produto || (i.produto || '— sem produto —') === F.produto) && (!F.fila || bate(F.fila, i.fila));
  const itensC = (cu.itens || []).filter(passaC);
  const realF = itensC.reduce((s, i) => s + Number(i.custo_real || 0), 0);
  const minutosF = itensC.reduce((s, i) => s + Number(i.minutos || 0), 0);
  const ac = cu.actions || {};
  const k = $('kpis-custos'); k.replaceChildren();
  const kdest = $('kpi-custo-real'); kdest.replaceChildren();
  // (26/09, CEO) o card diz QUAIS são os contratos e quanto cada um vale — a lista miúda cabe no próprio card
  const kf = kpi(k, daJanela ? 'Custos fixos na janela' : 'Custo fixo do mês', moeda(cu.fixos_brl), null);
  const lf = el('div', 's lista-fixos');
  for (const f of (cu.fixos || [])) lf.appendChild(el('span', null, `${f.item}: ${f.moeda === 'USD' ? 'US$ ' + Number(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' = ' : ''}${moeda(f.valor_brl)}/mês${f.na_janela_brl != null ? ' · na janela ' + moeda(f.na_janela_brl) : ''}`));
  if (Number(cu.cambio)) lf.appendChild(el('span', 'cambio', `câmbio ${Number(cu.cambio).toFixed(2).replace('.', ',')}`));
  kf.appendChild(lf);
  // (M621, pedido do CEO 662fe1ae) o card dos agentes lê a MESMA medição run a run dos outros cards (franquia uma vez só);
  // o medidor por rodada dava a franquia inteira aos agentes. Sem a M621 no banco, cai no número antigo.
  const gtAg = cu.github_todos && Array.isArray(cu.github_todos.categorias) ? cu.github_todos.categorias.find((x) => x.categoria === 'agentes') : null;
  if (gtAg) kpiMinCusto(k, daJanela ? 'GitHub nas rodadas dos agentes (janela)' : 'GitHub nas rodadas dos agentes', `${num(Number(gtAg.minutos))} min`, moeda(gtAg.brl),
    `${Number(cu.github_todos.minutos) ? pctTxt(Math.round(1000 * Number(gtAg.minutos) / Number(cu.github_todos.minutos)) / 10) : '—'} dos minutos pagos (além da franquia)`, Number(gtAg.brl) > 0 ? 'atencao' : 'ok');
  else kpiMinCusto(k, daJanela ? 'GitHub nas rodadas dos agentes (janela)' : 'GitHub nas rodadas dos agentes', `${num(Math.round(cu.minutos_total || 0))} min`, Number(ac.minutos_excedentes) > 0 ? moeda(ac.excedente_brl) : moeda(0),
    Number(ac.minutos_excedentes) > 0 ? `${num(Math.round(ac.minutos_excedentes))} min pagos além da franquia` : `franquia de ${num(ac.franquia)} min`, Number(ac.minutos_excedentes) > 0 ? 'atencao' : 'ok');
  kpisGithubPorOrigem(k, daJanela);
  // (M621) custo real = fixos + o GitHub PAGO de TODOS os workflows (rodadas, CI, robôs, vigias) — a conta do CEO fecha no card
  // (OS-186) este é o 2º card principal — sobe para junto do GitHub Actions, fora da fila de kpis
  const gt = cu.github_todos || null;
  const kr = kpi(kdest, daJanela ? 'Custo real na janela' : 'Custo real do mês', moeda(cu.custo_real_total), filtrado ? `${moeda(realF)} nos itens do filtro` : daJanela ? rotJ : cu.provisorio ? 'fixos + GitHub de todos os workflows · provisório até o mês fechar' : 'mês fechado');
  if (gt) {
    const lr = el('div', 's lista-fixos');
    lr.appendChild(el('span', null, `Fixos: ${moeda(cu.fixos_brl)}`));
    lr.appendChild(el('span', null, `GitHub pago (todos os workflows): ${moeda(gt.brl)} · ${num(Number(gt.minutos_pagos))} de ${num(Number(gt.minutos))} min além da franquia de ${num(Number(gt.franquia))}`));
    if (gt.coletado_ate) lr.appendChild(el('span', 'cambio', `GitHub medido até ${new Date(gt.coletado_ate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (o medidor grava a cada 2 h)`));
    kr.appendChild(lr);
  }
  // (27/09, CEO) o cartão abre, em fonte menor, o médio do Claude e do GitHub — minutos e dinheiro
  const km = kpi(k, 'Custo médio por item' + (filtrado ? ' (filtro)' : ''), itensC.length ? moeda(realF / itensC.length) : '—', `custo real dos itens ÷ ${num(itensC.length)} item(ns) · ${rotJ} · fixos e GitHub de todos os workflows rateados (M636)`);
  if (itensC.length) {
    const soma = (f) => itensC.reduce((t, i) => t + Number(i[f] || 0), 0) / itensC.length;
    const lm = el('div', 's lista-fixos');
    lm.appendChild(el('span', null, daJanela ? `Claude: ${moeda(soma('claude_brl'))} · ${num(Math.round(soma('claude_min')))} min por item` : 'Claude: por janela, com a M549'));
    lm.appendChild(el('span', null, `GitHub: ${num(Math.round(soma('minutos')))} min · ${moeda(soma('actions_brl'))} por item`));
    if (daJanela && cu.claude) lm.appendChild(el('span', 'cambio', `Claude nocional (não cobrado): US$ ${Number(cu.claude.usd_nocional || 0).toFixed(2)} na janela`));
    km.appendChild(lm);
  }
  // (29/09, CEO — OS-187) o que o custo real tem e item nenhum carrega: as rodadas de triagem, council e CTO.
  //   Sem este card, os cards por item/fila somavam ~R$ 389 abaixo do total e a conta não fechava na tela.
  const somaItens = (cu.itens || []).reduce((s, i) => s + Number(i.custo_real || 0), 0)
  const semItem = Math.max(0, Number(cu.custo_real_total || 0) - somaItens)
  if (!filtrado && Number(cu.custo_real_total)) {
    const ks = kpi(k, 'Rodadas sem item', moeda(semItem), `triagem, council, CTO… · itens ${moeda(somaItens)} + sem item ${moeda(semItem)} = custo real ${moeda(cu.custo_real_total)}`);
    const ag = (cu.por_agente || []).filter((a) => !Number(a.itens) && Number(a.custo_real) >= 0.01).sort((a, b) => Number(b.custo_real) - Number(a.custo_real));
    if (ag.length) { const la = el('div', 's lista-fixos'); for (const a of ag.slice(0, 6)) la.appendChild(el('span', null, `${a.agente}: ${moeda(a.custo_real)} · ${num(a.rodadas)} rodada(s)`)); ks.appendChild(la); }
  }
  kpi(k, 'Parado esperando você', moeda(c.gasto_parado_esperando_voce), 'consumo já feito em itens travados');

  // custo real por item
  $('sub-custeio').textContent = `${daJanela ? rotJ : cu.mes ? new Date(String(cu.mes).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : ''} · ${num(itensC.length)} item(ns)${filtrado ? ' (com filtro)' : ` · + ${moeda(semItem)} em rodadas sem item = ${moeda(cu.custo_real_total)}`}`;
  desenharMedias(cu, itensC, filtrado);
  const celEmpresa = (i) => { if (i.semItem) return document.createTextNode('—'); const f = document.createDocumentFragment(); f.append(tag(i.empresa, 'empresa', i.empresa), document.createTextNode(' / '), tag(i.produto || 'sem produto', 'produto', i.produto || '— sem produto —')); return f; };
  const nume = (k) => (i) => Number(i[k]) || 0;
  tabelaExcel('custeio-itens', [
    { rot: 'Item', valor: (i) => `${(todosItens().find((x) => x.id === i.id) || {}).codigo || ''} ${i.titulo}`, celula: (i) => { if (i.semItem) return el('span', null, i.titulo); const cod = (todosItens().find((x) => x.id === i.id) || {}).codigo; const b = el('button', 'btn-texto', (cod ? cod + ' · ' : '') + i.titulo); if (todosItens().some((x) => x.id === i.id)) b.addEventListener('click', () => abrirGaveta(i.id)); return b; } },
    { rot: 'Fila', valor: (i) => i.fila, celula: (i) => (i.semItem ? document.createTextNode('—') : tag(i.fila, 'fila', i.fila)) },
    { rot: 'Empresa / produto', valor: (i) => `${i.empresa} / ${i.produto || 'sem produto'}`, celula: celEmpresa },
    { rot: 'Rodadas', n: 1, valor: nume('rodadas'), texto: (i) => num(i.rodadas) },
    { rot: 'Fixos rateados', n: 1, valor: nume('fixos_rateados'), texto: (i) => (i.semItem ? '—' : moeda(i.fixos_rateados)), somar: moeda },
    { rot: 'Actions', n: 1, valor: nume('actions_brl'), texto: (i) => (i.semItem ? '—' : moeda(i.actions_brl)), somar: moeda },
    { rot: 'Custo real', n: 1, valor: nume('custo_real'), texto: (i) => moeda(i.custo_real), somar: moeda },
  ], (() => { const si = semItemDo(cu); return !filtrado && si.custo >= 0.01 ? [...itensC, { id: null, titulo: si.rotulo, fila: '—', empresa: '—', produto: '—', rodadas: si.rodadas, fixos_rateados: null, actions_brl: null, custo_real: si.custo, semItem: true }] : itensC })(), { barra: 'barra-custeio', unidade: 'linha(s)' });

  // por fila (custo real)
  const filas = (RETRATO.estrutura.filas || []).map((f) => f.nome);
  const t = $('custos-filas'); t.replaceChildren();
  const cab = el('tr'); for (const [h, n] of [['Fila', 0], ['Itens', 1], ['Rodadas', 1], ['Custo real', 1], ['Médio por item', 1]]) cab.appendChild(el('th', n ? 'n' : '', h)); t.appendChild(cab);
  for (const f of filas) {
    const dos = itensC.filter((i) => i.fila === f); if (!dos.length && F.fila && !bate(F.fila, f)) continue;
    const l = el('tr', 'clicavel' + (bate(F.fila, f) ? ' ativa' : ''));
    l.append(el('td', null, f), el('td', 'n', num(dos.length)), el('td', 'n', num(dos.reduce((s, i) => s + Number(i.rodadas || 0), 0))), el('td', 'n', moeda(dos.reduce((s, i) => s + Number(i.custo_real || 0), 0))), el('td', 'n', dos.length ? moeda(dos.reduce((s, i) => s + Number(i.custo_real || 0), 0) / dos.length) : '—'));
    l.addEventListener('click', () => alternar('fila', f)); t.appendChild(l);
  }
  // (29/09, OS-187) sem filtro, a tabela fecha no custo real: as rodadas sem item entram numa linha própria
  const rodSemItem = (cu.por_agente || []).filter((a) => !Number(a.itens)).reduce((s, a) => s + Number(a.rodadas || 0), 0)
  if (!filtrado && semItem > 0) { const ls = el('tr'); ls.append(el('td', null, 'Rodadas sem item (triagem, council, CTO)'), el('td', 'n', '—'), el('td', 'n', num(rodSemItem)), el('td', 'n', moeda(semItem)), el('td', 'n', '—')); t.appendChild(ls); }
  const tot = el('tr', 'total'); tot.append(el('td', null, 'Total'), el('td', 'n', num(itensC.length)), el('td', 'n', num(itensC.reduce((s, i) => s + Number(i.rodadas || 0), 0) + (!filtrado ? rodSemItem : 0))), el('td', 'n', moeda(realF + (!filtrado ? semItem : 0))), el('td', 'n', itensC.length ? moeda(realF / itensC.length) : '—')); t.appendChild(tot);
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
  pf.appendChild(el('p', 'motivo', `Total: ${moeda(cu.fixos_brl)}/mês. Actions: US$ ${Number(ac.preco_minuto_usd || 0).toFixed(3)}/min além de ${num(ac.franquia)} min. Desde a M636 os itens e as rodadas sem item rateiam o GitHub de TODOS os workflows (CI, robôs, vigias), do mesmo jeito que os fixos.`));
  const form = el('div', 'acao-caixa');
  const item = chave(el('input'), 'fixo:item'); item.type = 'text'; item.placeholder = 'Contrato (ex.: Vercel Pro)'; item.style.flex = '0 0 11rem';
  const valor = chave(el('input'), 'fixo:valor'); valor.type = 'number'; valor.min = '0'; valor.step = '0.01'; valor.placeholder = 'Valor/mês'; valor.style.flex = '0 0 7rem';
  const moedaSel = chave(el('select'), 'fixo:moeda'); for (const m of ['BRL', 'USD']) { const o = el('option', null, m); o.value = m; moedaSel.appendChild(o); } moedaSel.style.flex = '0 0 5rem';
  const motivo = chave(el('input'), 'fixo:motivo'); motivo.type = 'text'; motivo.placeholder = 'Motivo (mínimo 10 letras) — valor 0 tira do rateio';
  const b = el('button', 'btn sec', 'Declarar custo fixo'); const msg = el('p', 'aviso'); msg.hidden = true;
  b.addEventListener('click', async () => { b.disabled = true; try { await rpc('company_os_declarar_custo_fixo', { p_item: item.value.trim(), p_valor: Number(valor.value), p_moeda: moedaSel.value, p_motivo: motivo.value.trim() }); item.value = ''; valor.value = ''; motivo.value = ''; await abrirCasa(); toast('Custo fixo declarado.'); } catch (err) { mostrar(msg, String(err.message || err), false); b.disabled = false; } });
  form.append(item, valor, moedaSel, motivo, b, msg);
  const decl = chave(el('details'), 'det:fixos'); decl.appendChild(el('summary', null, 'Declarar ou mudar um custo fixo…')); decl.appendChild(form); pf.appendChild(decl);

  // rodadas recentes
  const lanc = ((daJanela ? cu.lancamentos : c.lancamentos) || []).filter((l) => (!F.empresa || l.empresa === F.empresa) && (!F.produto || (l.produto || '— sem produto —') === F.produto) && (!F.fila || bate(F.fila, l.fila)));
  $('sub-lanc').textContent = `${lanc.length} ${daJanela ? 'na janela (até 300)' : 'mais recentes'}${filtrado ? ' (com filtro)' : ''}`;
  tabelaExcel('lancamentos', [
    { rot: 'Quando', valor: (l) => l.quando, texto: (l) => quando(l.quando), filtro: (l) => dia(l.quando) },
    { rot: 'Item', valor: (l) => l.titulo },
    { rot: 'Fila', valor: (l) => l.fila, celula: (l) => tag(l.fila, 'fila', l.fila) },
    { rot: 'Executor', valor: (l) => (l.executor || '—').split(' · ')[0] },
    { rot: 'Minutos', n: 1, valor: (l) => (l.minutos == null ? null : Number(l.minutos)), texto: (l) => (l.minutos != null ? num(l.minutos) : '—'), somar: (v) => num(v) },
    { rot: 'Consumo', n: 1, valor: (l) => Number(l.valor) || 0, texto: (l) => moeda(l.valor), somar: moeda },
  ], lanc, { barra: 'barra-lanc', unidade: 'rodada(s)' });
}

/* ── ABA Report ───────────────────────────────────────────────────────────── */
for (const id of ['r-de', 'r-ate', 'r-fila', 'r-quem', 'r-nat', 'r-origem', 'r-tipo', 'r-base']) $(id).addEventListener('change', () => desenharReport());
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
    if ($('r-origem').value && i.origem !== $('r-origem').value) return false;
    if ($('r-tipo').value && i.tipo !== $('r-tipo').value) return false;
    return true;
  }).sort((a, b) => new Date(b[base]) - new Date(a[base]));
  const k = $('kpis-report'); k.replaceChildren();
  kpi(k, 'Itens no período', num(lista.length), `por ${$('r-base').selectedOptions[0].textContent.toLowerCase()}`);
  kpi(k, 'Concluídos', num(lista.filter((i) => i.estado === 'done').length), `${num(lista.filter((i) => i.estado === 'done' && i.tem_prova).length)} com prova`, 'ok');
  kpi(k, 'Parados / travados', num(lista.filter((i) => aberto(i) && pendente(i)).length), 'precisam de você', lista.some((i) => aberto(i) && pendente(i)) ? 'atencao' : '');
  kpi(k, 'Técnico × negócio', `${num(lista.filter((i) => i.natureza === 'técnico').length)} × ${num(lista.filter((i) => i.natureza === 'negócio').length)}`, 'itens por natureza');
  // (28/09) de onde veio o que está no período: as 3 maiores origens, o resto somado
  const porOrigem = Object.entries(lista.reduce((m, i) => { const o = i.origem || 'sistema'; m[o] = (m[o] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  kpi(k, 'De onde veio', porOrigem.length ? `${rotuloOrigem(porOrigem[0][0])}: ${num(porOrigem[0][1])}` : '—',
      porOrigem.slice(1, 4).map(([o, n]) => `${rotuloOrigem(o)} ${num(n)}`).join(' · ') || 'uma origem só');
  const custeio = new Map((((RETRATO.custos || {}).custeio || {}).itens || []).map((x) => [x.id, Number(x.custo_real || 0)]));
  const custoReal = (i) => custeio.has(i.id) ? custeio.get(i.id) : 0;
  kpi(k, 'Custo real (mês)', moeda(lista.reduce((s, i) => s + custoReal(i), 0)), 'rateado do que você paga · consumo: ' + moeda(lista.reduce((s, i) => s + Number(i.gasto || 0), 0)));
  kpi(k, 'Desvios', num(lista.reduce((s, i) => s + Number((i.caminho || {}).desvios || 0), 0)), `em ${num(lista.filter((i) => (i.caminho || {}).desvios > 0).length)} item(ns)`);

  tabelaExcel('tabela-report', [
    { rot: 'Data', valor: (i) => i[base], texto: (i) => quando(i[base]), filtro: (i) => dia(i[base]) },
    { rot: 'Item', valor: (i) => i.titulo, celula: (i) => { const b = el('button', 'btn-texto', i.titulo); b.addEventListener('click', () => abrirGaveta(i.id)); return b; } },
    { rot: 'Empresa / produto', valor: (i) => `${i.empresa} / ${i.produto || 'sem produto'}`,
      celula: (i) => { const f = document.createDocumentFragment(); f.append(tag(i.empresa, 'empresa', i.empresa), document.createTextNode(' / '), tag(i.produto || 'sem produto', 'produto', i.produto || '— sem produto —')); return f; } },
    { rot: 'Fila', valor: (i) => i.fila, celula: (i) => tag(i.fila, 'fila', i.fila) },
    { rot: 'Status', valor: (i) => rotuloEstado(i.estado) || i.estado, celula: (i) => tag(rotuloEstado(i.estado) || i.estado, 'estado', i.estado) },
    { rot: 'Quem abriu', valor: (i) => i.quem_abriu || '—', celula: (i) => tag(i.quem_abriu || '—', 'quem', i.quem_abriu) },
    { rot: 'Natureza', valor: (i) => i.natureza, celula: (i) => tagNatureza(i) },
    { rot: 'Cliente', valor: (i) => i.cliente || 'interno', celula: (i) => i.cliente ? tagCliente(i) : document.createTextNode('interno') },
    { rot: 'Origem', valor: (i) => rotuloOrigem(i.origem) + (i.origem_ref ? ` ${i.origem_ref}` : ''), celula: (i) => tagOrigem(i) },
    { rot: 'Tipo', valor: (i) => rotuloTipo(i.tipo), celula: (i) => tag(rotuloTipo(i.tipo), 'tipo', i.tipo) },
    { rot: 'Passos / desvios', n: 1, valor: (i) => Number((i.caminho || {}).desvios) || 0, texto: (i) => `${num((i.caminho || {}).passos_percorridos)} / ${num((i.caminho || {}).desvios)}` },
    { rot: 'Custo real', n: 1, valor: (i) => custoReal(i), texto: (i) => moeda(custoReal(i)), somar: moeda },
  ], lista, { barra: 'barra-report', unidade: 'item(ns)' });
}

/* ── A ATUALIZAÇÃO NÃO APAGA O QUE VOCÊ ESTÁ FAZENDO ─────────────────────────
   Pedido do CEO (26/09): "quando o site atualizar, o que eu estava escrevendo
   não pode sumir; um campo aberto que eu esteja lendo não pode fechar". A tela
   se redesenha a cada minuto (o retrato é refeito). Todo campo de texto e todo
   bloco que abre/fecha nasce com uma CHAVE estável (o item, o aviso, a rampa);
   antes de redesenhar a tela guarda valor, foco, cursor, o que está aberto e a
   rolagem — e devolve tudo depois. Quem limpa o campo é a ação que deu certo. */
const chave = (e, k) => { e.dataset.chave = k; return e; };
function guardarEstado() {
  const campos = {};
  for (const e of document.querySelectorAll('#app [data-chave]')) {
    campos[e.dataset.chave] = e.tagName === 'DETAILS' ? { aberto: e.open } : { valor: e.value };
  }
  const f = document.activeElement;
  const foco = f && f.dataset && f.dataset.chave ? { k: f.dataset.chave, s: f.selectionStart, e: f.selectionEnd } : null;
  return { campos, foco, y: window.scrollY, g: $('gaveta-corpo').scrollTop };
}
function restaurarEstado(st) {
  for (const e of document.querySelectorAll('#app [data-chave]')) {
    const c = st.campos[e.dataset.chave]; if (!c) continue;
    if (e.tagName === 'DETAILS') e.open = c.aberto;
    else if (c.valor != null && c.valor !== '' && e.value !== c.valor) e.value = c.valor;
  }
  if (st.foco) {
    const e = [...document.querySelectorAll('#app [data-chave]')].find((x) => x.dataset.chave === st.foco.k);
    if (e && document.activeElement !== e) { e.focus({ preventScroll: true }); try { if (st.foco.s != null) e.setSelectionRange(st.foco.s, st.foco.e); } catch { /* select/number não têm cursor */ } }
  }
  window.scrollTo(0, st.y);
  $('gaveta-corpo').scrollTop = st.g;
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
  const nAprov = (inbox.itens || []).filter((x) => !eAceite(x)).length; const nAceite = (inbox.itens || []).filter(eAceite).length;
  partes.push(nAprov ? [`${nAprov} aprovação(ões)`, ' e '] : ['nenhuma aprovação', ' e ']);
  partes.push(nAceite ? [`${nAceite} aceitação(ões)`, ' esperam por você'] : ['nenhuma aceitação', ' esperam por você']);
  partes.push(novos.length ? [`${novos.length} aviso(s)`, ' sem ciência'] : ['nenhum aviso', ' novo']);
  const est = esteira($('esteira-inicio'));
  partes.push([`${est.naFila} na fila`, ` (${est.liberados} liberado(s)${est.segurados ? `, ${est.segurados} segurado(s)` : ''})`]);
  partes.push(exec.length ? [`${exec.length} em execução`, ' agora'] : ['executor', ' ocioso']);
  partes.forEach(([b, t], n) => { if (n > 1) res.appendChild(document.createTextNode(' · ')); res.append(el('b', null, b), document.createTextNode(t)); });
  esq.appendChild(res);
  esq.prepend(el('p', 'dica data-hoje', new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })));
  sa.append(esq);

  const k = $('kpis-inicio'); k.replaceChildren();
  const aprovs = (inbox.itens || []).filter((x) => !eAceite(x)); const aceites = (inbox.itens || []).filter(eAceite);
  const antiga = (l) => Math.max(0, ...l.map((x) => Number(x.dias_esperando) || 0));
  kpi(k, 'Aprovações', num(aprovs.length), aprovs.length ? `pode ir? · a mais antiga ${esperaTexto(antiga(aprovs))}` : 'nada espera a sua alçada', aprovs.length ? (antiga(aprovs) >= 2 ? 'atencao' : 'alerta') : 'ok', () => irPara('aprov'), false, 'aprovar');
  kpi(k, 'Aceitações', num(aceites.length), aceites.length ? `ficou bom? · a mais antiga ${esperaTexto(antiga(aceites))}` : 'nenhuma entrega espera você', aceites.length ? (antiga(aceites) >= 2 ? 'atencao' : 'alerta') : 'ok', () => irPara('aceite'), false, 'aceite');
  kpi(k, 'Avisos sem ciência', num(novos.length), novos.length ? 'nada aqui pede decisão' : 'fila limpa', novos.length ? 'alerta' : 'ok', () => irPara('avisos'), false, 'sino');
  // (26/09) "Em execução" saiu dos números: o cartão Executor agora, logo abaixo, diz o mesmo com o item e a hora.
  kpi(k, 'Réguas verdes', `${num(vig.total - vig.vermelhos.length)}/${num(vig.total)}`, vig.vermelhos.length ? 'vermelha: ' + vig.vermelhos.join(', ') : 'todas verdes', vig.vermelhos.length ? 'atencao' : 'ok', () => irPara('monitor'), false, 'escudo');
  const fx = cons.faixa === 'estourado' ? 'atencao' : (cons.faixa === 'aviso_2' || cons.faixa === 'aviso_3') ? 'alerta' : cons.percentual == null ? '' : 'ok';
  const unidade = cons.unidade === 'USD' ? (n) => 'US$ ' + Number(n).toFixed(2).replace('.', ',') : (n) => num(n) + ' min';
  const kc = kpi(k, 'Consumo de Actions', cons.percentual == null ? '—' : `${String(cons.percentual).replace('.', ',')}%`, cons.usado == null ? 'sem medição' : `${unidade(cons.usado)} de ${unidade(cons.teto)}`, fx, () => irPara('custos'), false, 'medidor');
  if (cons.percentual != null) { const t = el('div', 'mini-trilho'); const sp = el('span'); sp.style.width = Math.min(100, Number(cons.percentual)) + '%'; t.appendChild(sp); kc.appendChild(t); }
  kpi(k, 'Custo real do mês', moeda(cu.custo_real_total), cu.provisorio ? 'fixos + GitHub · provisório' : 'mês fechado', '', () => irPara('custos'), false, 'dinheiro');

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
      () => { irPara(eAceite(x) ? 'aceite' : 'aprov'); setTimeout(() => { const c = $('caixa-' + x.id); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = c.querySelector('input'); if (inp) inp.focus({ preventScroll: true }); } }, 60); },
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

  // (26/09) o cartão "itens por situação" saiu: a esteira no topo diz o mesmo, com o que ele escondia.

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
  const estado = $('app').hidden ? null : guardarEstado();
  NA_CAIXA = new Map(((RETRATO.inbox && RETRATO.inbox.itens) || []).map((p) => [p.id, p.classe]));
  desenharChips(); montarSeletores();
  desenharAprov(); desenharStatus(); desenharOrg(); desenharPaths();
  desenharPedido(); desenharAvisos(); desenharMonitor(); desenharCustos(); desenharReport();
  desenharInicio(); desenharGaveta();
  mostrarAba();
  if (estado) restaurarEstado(estado);
}

aplicarTema(temaEscolhido());
boot();
