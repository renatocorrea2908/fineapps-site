# /os — Command Center do CEO

Tela estática (os.html, os.css, os.js), sem biblioteca, sobre o retrato do Company OS
(`company_os_meu_retrato`). Publicada pela CLI da Vercel: `npx vercel deploy --prod --yes`.

Regras da tela:
- Tudo o que se clica FILTRA (badge, caixa do organograma, fila, empresa, produto, quem abriu).
  O filtro cruzado vive em `F` no os.js; `render()` refaz todas as abas.
- Filtro de Empresa e Produto no topo, válido para todas as abas.
- A sessão fica no localStorage (`fineapps.os.sessao`) e sobrevive ao refresh; "Sair" apaga.
- Abas: Command Center (Aprovações, Status, Filas/organograma, Paths) · Novo pedido · Monitor · Custos · Report.
- Nenhum número nasce aqui: o banco calcula (M377, M380, M384, M385); a tela recorta.

Vocabulário: Empresa (não "casa"), Executor (não "oficina"), Aprovações (não "mesa"),
Em execução (não "plantão"), Triagem (não "Council"), Monitor/réguas (não "vigilância/invariantes").
