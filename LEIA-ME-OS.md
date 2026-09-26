# /os — Command Center do CEO

Tela estática (os.html, os.css, os.js, os-tema.js), sem biblioteca, sobre o retrato do Company OS
(`company_os_meu_retrato`).

Regras da tela:
- Tudo o que se clica FILTRA (badge, caixa do organograma, fila, empresa, produto, quem abriu).
  O filtro cruzado vive em `F` no os.js; `render()` refaz todas as abas.
- Filtro de Empresa e Produto no topo, válido para todas as abas.
- A sessão fica no localStorage (`fineapps.os.sessao`) e sobrevive ao refresh; "Sair" apaga.
- Páginas na lateral (v2, 26/09/2026): Visão geral · Aprovações · Avisos · Itens · Organograma · Caminhos ·
  Monitor · Custos · Report · Novo pedido. A página vai no endereço (`/os#aprov`): refresh e "voltar" funcionam.
- O detalhe de um item abre numa GAVETA à direita (no computador ela não trava a tela: clicar noutro
  cartão troca o detalhe). As ações de decisão (Aprovar/Questionar/Reprovar, Aceitar/Recusar) ficam no cartão.
- Tema claro / escuro / seguir o sistema: seletor no pé da lateral ou tecla T. Decidido antes da primeira
  pintura por `os-tema.js` (arquivo próprio: o CSP é `script-src 'self'`); guardado em `fineapps.os.tema`.
- Atalhos: 1–9 páginas · N novo pedido · R atualizar · T tema · Esc fecha gaveta/menu.
- Cores só por TOKEN (`:root` e `[data-theme="dark"]` no topo do os.css) — regra nova não escreve hexadecimal.
- Prévia local sem banco: o retrato real vira fixture e o Supabase é fingido no navegador de teste
  (harness do agente); nada disso é publicado.
- Nenhum número nasce aqui: o banco calcula (M377, M380, M384, M385); a tela recorta.

Vocabulário: Empresa (não "casa"), Executor (não "oficina"), Aprovações (não "mesa"),
Em execução (não "plantão"), Triagem (não "Council"), Monitor/réguas (não "vigilância/invariantes").

## Publicação (desde 20/09/2026)

O site vive no repositório **github.com/renatocorrea2908/fineapps-site**, ligado ao projeto
`fineapps-site` da Vercel: **um push em `main` publica**. O deploy manual pela CLI deixa de ser o caminho.
Esta pasta (`~/Claude/Dev/FineApps/site`) é um clone do repositório.
