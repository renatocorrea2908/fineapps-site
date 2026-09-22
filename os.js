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
let ABA = 'cc';
let SUB = 'aprov';
let ABERTOS = new Set();        // itens com a tarefa aberta
const F = {};                   // filtro cruzado: empresa, produto, fila, estado, natureza, quem, tipo, prioridade, pendente, caminho

const $ = (id) => document.getElementById(id);
const num = (n) => new Intl.NumberFormat('pt-BR').format(Number(n) || 0);
const moeda = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const dia = (t) => (t ? new Date(t).toLocaleDateString('pt-BR') : '—');
const hhmm = (t) => (t ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');
const quando = (t) => (t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };

function mostrar(alvo, texto, bom) { alvo.textContent = texto; alvo.className = 'aviso ' + (bom ? 'bom' : 'ruim'); alvo.hidden = false; }

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
$('atualizar').addEventListener('click', () => abrirCasa().catch((e) => alert(e.message)));

/* ── abrir a casa ─────────────────────────────────────────────────────────── */
async function abrirCasa() {
  const retrato = await rpc('company_os_meu_retrato');
  if (!retrato || !retrato.estrutura) {
    mostrar($('erro-login'), 'Você entrou, mas esta conta não tem alçada declarada no Company OS. Nada aqui é da sua conta.', false);
    apagarSessao();
    $('entrada').hidden = false; $('app').hidden = true;
    return;
  }
  RETRATO = retrato;
  $('entrada').hidden = true; $('app').hidden = false;
  $('quem').textContent = `${SESSAO.user.email} · alçada executiva`;
  $('carimbo').textContent = `retrato de ${quando(retrato.gerado_em)} · atualiza a cada minuto`;
  montarSeletores();
  render();
  if (!RELOGIO) RELOGIO = setInterval(() => { abrirCasa().catch(() => {}); }, 60_000);
}

async function boot() {
  const s = lerSessao();
  if (!s) return;
  SESSAO = s;
  try {
    if (!SESSAO.expira_em || SESSAO.expira_em - 60_000 < Date.now()) await renovar();
    await abrirCasa();
  } catch { apagarSessao(); $('entrada').hidden = false; }
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
$('abas').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-aba]'); if (!b) return;
  ABA = b.dataset.aba; mostrarAba();
});
$('subabas').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-sub]'); if (!b) return;
  SUB = b.dataset.sub; mostrarAba();
});
function mostrarAba() {
  for (const b of $('abas').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.aba === ABA));
  for (const s of document.querySelectorAll('.aba')) s.hidden = s.dataset.aba !== ABA;
  for (const b of $('subabas').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.sub === SUB));
  for (const s of document.querySelectorAll('.sub[data-sub]')) s.hidden = s.dataset.sub !== SUB;
}

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
  const cx = el('article', 'item' + (pendente(i) && aberto(i) ? ' espera' : '') + (ABERTOS.has(i.id) ? ' aberto' : ''));
  const cab = el('button', 'item-cab'); cab.setAttribute('aria-expanded', String(ABERTOS.has(i.id)));
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
  cab.addEventListener('click', () => { if (ABERTOS.has(i.id)) ABERTOS.delete(i.id); else ABERTOS.add(i.id); render(); });
  cx.appendChild(cab);
  if (ABERTOS.has(i.id)) {
    cx.appendChild(el('div', 'descricao', i.descricao || '(este item não tem descrição registrada)'));
    if (i.ultima_falha) cx.appendChild(el('p', 'falha', `Última falha (${quando(i.ultima_falha_em)}): ${i.ultima_falha}`));
    if (opts.comPath !== false) cx.appendChild(desenharPath(i));
  }
  if (opts.rodape) cx.appendChild(opts.rodape);
  return cx;
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
  $('pill-aprov').className = 'pill' + (total ? ' vermelho' : '');
  $('sub-aprov').textContent = lista.length === 0
    ? (total ? 'Nada com os filtros atuais.' : 'Nada espera por você. A fila anda sozinha.')
    : `${lista.length} item(ns) não andam até você decidir. Em ordem de quem espera há mais tempo.`;
  const alvo = $('lista-aprov'); alvo.replaceChildren();
  if (!lista.length) alvo.appendChild(el('p', 'vazio', 'Aprovações limpas.'));
  for (const p of (lista.length ? lista : [])) {
    const i = porId.get(p.id);
    const cx = el('article', 'item espera');
    cx.appendChild(el('h4', null, p.titulo));
    const m = el('div', 'meta');
    m.appendChild(el('span', 'estado', (p.classe === 'travado' && p.contexto && p.contexto.escalado_pelo_cto) ? 'escalado pelo CTO — precisa da sua decisão' : (ROTULO_CLASSE[p.classe] || p.classe)));
    m.appendChild(el('span', null, `${p.dias_esperando} dia(s) esperando`));
    if (i) m.append(tag(i.empresa, 'empresa', i.empresa), tag(i.produto || 'sem produto', 'produto', i.produto || '— sem produto —'), tag('fila ' + i.fila, 'fila', i.fila), tag(i.natureza, 'natureza', i.natureza));
    m.appendChild(el('span', null, `impacto ${p.impacto || '—'}`));
    if (Number(p.custo_ja_gasto) > 0) m.appendChild(el('span', null, `já gastou ${moeda(p.custo_ja_gasto)}`));
    cx.append(m, el('p', 'porque', p.porque_voce));
    if (i && i.descricao) { const d = el('details'); d.append(el('summary', null, 'Ver o pedido inteiro'), el('div', 'descricao', i.descricao)); cx.appendChild(d); }
    if (p.classe === 'aguarda_alcada') cx.appendChild(caixaAcao(p, [['Aprovar', 'company_os_minha_aprovacao', 'p_observacao', { p_canal: 'tela-os' }]], 'Por que você está aprovando (mínimo 10 letras)'));
    if (p.classe === 'entrega_aguarda_aceite') {
      const ref = (p.contexto && p.contexto.referencia) || '';
      if (/^https?:\/\//.test(ref)) { const a = el('a', 'ligacao', 'Abrir a entrega (PR) em nova aba'); a.href = ref; a.target = '_blank'; a.rel = 'noopener noreferrer'; cx.appendChild(a); }
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
      m.append(el('span', 'estado', e.concluida ? 'em produção' : 'aceita pelo CI — concluindo'), el('span', null, quando(e.aceita_em)), tag(e.empresa, 'empresa', e.empresa), tag(e.produto || 'sem produto', 'produto', e.produto || '— sem produto —'), tag('fila ' + e.fila, 'fila', e.fila), el('span', null, e.alcada === 'technical' || e.alcada === 'none' ? 'técnico (7b)' : 'aprovado por você na entrada (7c)'));
      cx.appendChild(m);
      if (/^https?:\/\//.test(e.referencia || '')) { const a = el('a', 'ligacao', 'Ver a entrega (PR)'); a.href = e.referencia; a.target = '_blank'; a.rel = 'noopener noreferrer'; cx.appendChild(a); }
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
  $('lista-status').replaceChildren(el('p', 'dica', F.estado ? `${lista.length} item(ns) em "${rotuloEstado(F.estado)}" · clique no título para ler a tarefa` : `${lista.length} em aberto · clique num status para ver a composição · clique no título para ler a tarefa`));
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
  alvo.appendChild(el('p', 'dica', (F.fila || F.produto || F.pendente) ? `${lista.length} item(ns) na seleção · clique no título para ler a tarefa` : 'Clique numa caixa para ver a composição. Abaixo, tudo o que está em aberto.'));
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
    mostrar($('msg-pedido'), 'Pedido aberto e assinado por você. A Triagem classifica e roteia em instantes; ele aparece em Status assim que virar item.', true);
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
function kpi(alvo, rot, val, sub, cls, onClick, pressed) {
  const d = el(onClick ? 'button' : 'div', 'kpi' + (cls ? ' ' + cls : '') + (onClick ? ' clicavel' : ''));
  if (onClick) { d.addEventListener('click', onClick); d.setAttribute('aria-pressed', String(!!pressed)); }
  d.append(el('div', 'r', rot), el('div', 'v', val)); if (sub) d.appendChild(el('div', 's', sub));
  alvo.appendChild(d);
}
function linhas(alvo, pares) {
  alvo.replaceChildren();
  for (const [k, v, onClick, pressed] of pares) {
    const l = el('div', 'linha' + (onClick ? ' clicavel' : '')); l.append(el('span', null, k), el('span', 'd', v));
    if (onClick) { l.addEventListener('click', onClick); if (pressed) l.style.background = 'var(--marca-tinta)'; }
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
  kpi(k, 'Em execução agora', num((p.em_execucao || []).length), (p.em_execucao || []).map((i) => i.executor).join(', ') || 'executor ocioso', (p.em_execucao || []).length ? 'ok' : '', () => { ABA = 'cc'; SUB = 'status'; F.estado = 'in_progress'; mostrarAba(); render(); });
  kpi(k, 'Esperando a vez', num((p.na_fila || []).length), (p.na_fila || []).some((i) => i.ultima_falha) ? 'há item que já falhou' : 'na fila', '', () => { ABA = 'cc'; SUB = 'status'; F.estado = 'ready'; mostrarAba(); render(); });
  kpi(k, 'Parados há mais de 2h', num(parados), 'sem executor, sem despacho', parados ? 'atencao' : 'ok');
  kpi(k, 'Pedidos sem triagem', num(semTriagem), 'há mais de 2h', semTriagem ? 'atencao' : 'ok');
  const os29 = inv.find((i) => i.id === 'OS29'); const rampaParada = (os29 && os29.detalhes && os29.detalhes.parados || []).length;
  kpi(k, 'Rampa 7b parada', num(rampaParada), 'técnico há mais de 2h sem CI/CTO', rampaParada ? 'atencao' : 'ok');
  kpi(k, 'Último despacho', p.ultimo_despacho ? hhmm(p.ultimo_despacho) : '—', p.ultimo_despacho ? dia(p.ultimo_despacho) : 'o banco ainda não acordou o executor');

  $('sub-reguas').textContent = vig.vermelhos.length === 0 ? 'todas verdes — o CI lê estas mesmas réguas contra a produção a cada push' : `${vig.vermelhos.length} vermelha(s): os números do painel podem não valer nada até ficarem verdes`;
  const rg = $('reguas'); rg.replaceChildren();
  for (const i of inv) {
    const d = el('div', 'regua' + (i.passou ? '' : ' v'));
    d.append(el('span', 'cod', i.id));
    const t = el('div'); t.appendChild(el('div', 'txt', i.descricao));
    if (!i.passou) { const dt = el('details'); dt.append(el('summary', null, 'detalhes'), el('pre', null, JSON.stringify(i.detalhes, null, 2))); t.appendChild(dt); }
    d.appendChild(t); rg.appendChild(d);
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
  if (!rampas.length) { pr.appendChild(el('p', 'motivo', 'Nenhuma rampa declarada.')); return; }
  for (const r of rampas) {
    const [tit, expl] = RAMPAS_TEXTO[r.nome] || [r.nome, ''];
    const cab = el('div', 'atual'); const luz = el('span', 'luz' + (r.ligada ? ' on' : '')); cab.append(luz, document.createTextNode(`${tit}: ${r.ligada ? 'LIGADA' : 'desligada'}`));
    pr.append(cab, el('p', 'motivo', expl), el('p', 'motivo', `${r.motivo} — ${quando(r.mudada_em)}`));
    const form = el('div', 'acao-caixa');
    const motivo = el('input'); motivo.type = 'text'; motivo.placeholder = (r.ligada ? 'Por que desligar' : 'Por que ligar') + ' (mínimo 10 letras)';
    const b = el('button', 'btn ' + (r.ligada ? 'perigo' : 'sec'), r.ligada ? 'Desligar rampa' : 'Ligar rampa'); const msg = el('p', 'aviso'); msg.hidden = true;
    b.addEventListener('click', async () => { b.disabled = true; try { await rpc('company_os_ligar_rampa', { p_nome: r.nome, p_ligada: !r.ligada, p_motivo: motivo.value.trim() }); await abrirCasa(); } catch (err) { mostrar(msg, String(err.message || err), false); b.disabled = false; } });
    form.append(motivo, b, msg); pr.appendChild(form);
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
    const l = el('tr', 'clicavel'); if (bate(F.fila, f)) l.style.background = 'var(--marca-tinta)';
    l.append(el('td', null, f), el('td', 'n', num(dos.length)), el('td', 'n', num(dos.reduce((s, i) => s + Number(i.rodadas || 0), 0))), el('td', 'n', moeda(dos.reduce((s, i) => s + Number(i.consumo || 0), 0))), el('td', 'n', moeda(dos.reduce((s, i) => s + Number(i.custo_real || 0), 0))));
    l.addEventListener('click', () => alternar('fila', f)); t.appendChild(l);
  }
  const tot = el('tr', 'total'); tot.append(el('td', null, 'Total'), el('td', 'n', num(itensC.length)), el('td', 'n', num(itensC.reduce((s, i) => s + Number(i.rodadas || 0), 0))), el('td', 'n', moeda(consumoF)), el('td', 'n', moeda(realF))); t.appendChild(tot);

  // custos fixos (declaração executiva)
  const pf = $('painel-fixos'); pf.replaceChildren();
  for (const f of (cu.fixos || [])) {
    const linha = el('div', 'atual'); linha.textContent = `${f.item}: ${f.moeda === 'USD' ? 'US$ ' + Number(f.valor).toFixed(2) + ' = ' : ''}${moeda(f.valor_brl)}/mês`;
    pf.append(linha, el('p', 'motivo', f.motivo));
  }
  pf.appendChild(el('p', 'motivo', `Total: ${moeda(cu.fixos_brl)}/mês. Actions: US$ ${Number(ac.preco_minuto_usd || 0).toFixed(3)}/min além de ${num(ac.franquia)} min. Só os minutos das rodadas do executor entram por tarefa; CI de PR e vigias ficam fora.`));
  const form = el('div', 'acao-caixa');
  const item = el('input'); item.type = 'text'; item.placeholder = 'Contrato (ex.: Vercel Pro)'; item.style.flex = '0 0 11rem';
  const valor = el('input'); valor.type = 'number'; valor.min = '0'; valor.step = '0.01'; valor.placeholder = 'Valor/mês'; valor.style.flex = '0 0 7rem';
  const moedaSel = el('select'); for (const m of ['BRL', 'USD']) { const o = el('option', null, m); o.value = m; moedaSel.appendChild(o); } moedaSel.style.flex = '0 0 5rem';
  const motivo = el('input'); motivo.type = 'text'; motivo.placeholder = 'Motivo (mínimo 10 letras) — valor 0 tira do rateio';
  const b = el('button', 'btn sec', 'Declarar custo fixo'); const msg = el('p', 'aviso'); msg.hidden = true;
  b.addEventListener('click', async () => { b.disabled = true; try { await rpc('company_os_declarar_custo_fixo', { p_item: item.value.trim(), p_valor: Number(valor.value), p_moeda: moedaSel.value, p_motivo: motivo.value.trim() }); await abrirCasa(); } catch (err) { mostrar(msg, String(err.message || err), false); b.disabled = false; } });
  form.append(item, valor, moedaSel, motivo, b, msg); pf.appendChild(form);

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
    const tdT = el('td'); const bt = el('button', 'btn-texto', i.titulo); bt.style.padding = '0'; bt.style.textAlign = 'left'; bt.addEventListener('click', () => { ABERTOS.add(i.id); ABA = 'cc'; SUB = 'status'; F.estado = i.estado; mostrarAba(); render(); }); tdT.appendChild(bt);
    r.append(el('td', null, quando(i[base])), tdT, tdE, tdF, tdS, tdQ, tdN, el('td', 'n', `${num((i.caminho || {}).passos_percorridos)} / ${num((i.caminho || {}).desvios)}`), el('td', 'n', moeda(custoReal(i))));
    t.appendChild(r);
  }
  const tot = el('tr', 'total'); const tdt = el('td', null, `Total: ${num(lista.length)} item(ns)`); tdt.colSpan = 8; tot.append(tdt, el('td', 'n', moeda(lista.reduce((s, i) => s + custoReal(i), 0)))); t.appendChild(tot);
}

/* ── render geral ─────────────────────────────────────────────────────────── */
function render() {
  if (!RETRATO) return;
  desenharChips(); montarSeletores();
  desenharAprov(); desenharStatus(); desenharOrg(); desenharPaths();
  desenharPedido(); desenharMonitor(); desenharCustos(); desenharReport();
  mostrarAba();
}

boot();
