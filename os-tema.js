/* Command Center — o tema, decidido ANTES da primeira pintura.
   Três estados: 'claro', 'escuro' ou 'sistema' (segue o macOS/Windows e muda
   junto quando o sistema muda). Fica no navegador de quem vê; nada vai ao banco.
   Arquivo separado porque o CSP de /os é script-src 'self' (nada inline) e o
   os.js só carrega no fim do body — tarde demais para não piscar branco. */
'use strict';
(function () {
  var CHAVE = 'fineapps.os.tema';
  var escolha = 'sistema';
  try { escolha = localStorage.getItem(CHAVE) || 'sistema'; } catch (e) { /* sem storage: segue o sistema */ }
  var escuro = escolha === 'escuro' || (escolha === 'sistema' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', escuro ? 'dark' : 'light');
  document.documentElement.setAttribute('data-tema-escolha', escolha);
})();
