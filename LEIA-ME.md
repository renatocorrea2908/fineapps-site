# Site institucional — FineApps Sistemas Ltda.

Site estático, sem framework e sem dependências. Cinco páginas HTML, uma folha de estilo e um
arquivo de configuração. Abre direto no navegador com duplo clique, para conferência antes de
publicar.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Página inicial — empresa, produtos, princípios de tratamento de dados, contatos |
| `privacidade.html` | Política de Privacidade, com as três situações e as tabelas de bases legais |
| `direitos.html` | Como exercer direitos de titular, com prazos e a quem dirigir cada pedido |
| `seguranca.html` | Versão pública das práticas de segurança |
| `termos-stratum.html` | Termos de Uso do Stratum |
| `termos-valora.html` | Termos de Uso do Valora |
| `style.css` | Folha de estilo única |
| `vercel.json` | Cabeçalhos de segurança HTTP |

## O que os cabeçalhos de segurança fazem

Não é firula. A empresa publica uma página descrevendo suas práticas de segurança — o site que
hospeda essa página precisa ser coerente com ela. Um cliente corporativo em processo de avaliação
roda ferramentas automatizadas de verificação, e cabeçalho ausente aparece no relatório.

| Cabeçalho | Efeito |
|---|---|
| `Strict-Transport-Security` | Força HTTPS no navegador, inclusive em subdomínios |
| `X-Content-Type-Options` | Impede que o navegador adivinhe tipos de arquivo |
| `X-Frame-Options` | Impede que o site seja embutido em outro, evitando *clickjacking* |
| `Referrer-Policy` | Limita o que é enviado ao navegar para fora |
| `Permissions-Policy` | Desliga câmera, microfone e geolocalização — o site não usa nada disso |
| `Content-Security-Policy` | Bloqueia execução de script; o site é HTML e CSS puros |

A política de conteúdo bloqueia JavaScript por completo. **Se algum dia for adicionado script ao
site, este arquivo precisa ser ajustado, senão o script não executa.**

## Publicar na Vercel

### Pela interface

1. `vercel.com/new`
2. **Import** do repositório, se o site estiver versionado — ou arraste a pasta para o campo de
   *deploy* direto
3. Framework Preset: **Other**
4. Root Directory: a pasta `site`, se ela estiver dentro de um repositório maior
5. **Deploy**

Não há build. A Vercel serve os arquivos como estão.

### Pelo terminal

Dentro da pasta `site`:

```bash
npx vercel --prod
```

Na primeira execução ele pede login e algumas confirmações. Nas seguintes, publica direto.

## Ligar o domínio

1. No projeto, **Settings → Domains**
2. **Add** → `fineapps.com.br`
3. Adicione também `www.fineapps.com.br`, com redirecionamento para o principal
4. A Vercel indica os registros DNS a criar

**Atenção — o DNS está na Cloudflare.** Crie os registros indicados pela Vercel lá, e mantenha o
*proxy* **desligado** (nuvem cinza) nos registros do site. Com o proxy ligado, os dois serviços
tentam emitir certificado e a validação entra em conflito.

**Os registros MX do e-mail não podem ser tocados.** Eles são independentes dos registros do site
e continuam apontando para o Email Routing.

## Antes de publicar — conferir

- [ ] Os três e-mails funcionando: enviar mensagem de teste para cada um
- [ ] Abrir as cinco páginas no celular
- [ ] Ler a Política de Privacidade inteira, com atenção às tabelas de bases legais
- [ ] Confirmar com a advogada os Termos do Stratum, dada a contratação online
- [ ] Conferir se `fineapps.com.br` e `www` respondem, depois do apontamento

## Manutenção

Os documentos publicados aqui derivam das minutas em `Dev/FineApps/`. **Alterou a minuta, altere
a página** — e vice-versa. Divergência entre o que está publicado e o que foi assinado é problema
sério: o texto público é o que vale perante quem aderiu online.

A data de vigência aparece logo abaixo do título de cada documento. Toda alteração relevante
exige atualizar essa data e comunicar quem já contratou, com trinta dias de antecedência, na
forma prevista nos próprios Termos.
