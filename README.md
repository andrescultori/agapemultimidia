# agapemultimidia

Site, páginas de venda e painel do cliente do Ágape Multimidia.

## Estrutura

```
pro/        Página de venda da Transmissão Pro 2.0 (azul)  → /pro/   (a home e /cursos redirecionam para cá por enquanto)
black/      LP Black November 2026 (amarela), mantida como está → /black/
admin/      Painel do cliente (login por código no e-mail)  → /admin/
api/        Funções do painel e GET /api/settings (estilo Node; rodam na Vercel ou no Worker)
shared/     site-settings.js: preenche a página com os valores publicados no painel
db/         schema.sql e app-role.sql (Supabase/Postgres, schema próprio agape_admin)
src/        worker.js e adapter.js (Cloudflare Worker)
scripts/    dev-server, build do Cloudflare, teste do Worker
test/       testes do backend (npm test)
hostgator/  regras de redirecionamento para o .htaccess (obsoletas depois da migração)
```

A estrutura espelha o endereço final: o conteúdo de `pro/` fica em `/pro/` na raiz do domínio, e assim por diante.

## Onde está no ar

| Ambiente | Endereço | Como atualiza |
|---|---|---|
| Vercel (projeto `agapemultimidia`, time AMS) | `agapemultimidia.vercel.app` e um endereço de prévia por PR | Automático: merge em `main` publica; cada PR gera prévia |
| Domínio oficial (HostGator) | `agapemultimidia.com.br` | Manual, até a migração de DNS (ver abaixo) |
| Cloudflare Workers (destino) | ainda não publicado | Passo a passo em `ADMIN.md` |

Mesclar um PR publica na Vercel, **não** na HostGator. Enquanto o domínio estiver na HostGator, o que está em `main` só chega ao domínio oficial depois do envio manual.

### Enviar para a HostGator (manual, enquanto o domínio estiver lá)

1. No cPanel, abra o **Gerenciador de Arquivos** (ou FTP) e entre em `public_html`.
2. Envie a pasta `pro/` (e `black/`, se mudou) para `public_html/pro/` e `public_html/black/`, substituindo os arquivos.
3. Cole `hostgator/root-redirect.htaccess` no **topo** de `public_html/.htaccess`, acima do bloco do WordPress.
4. Abra `/pro/` em janela anônima, no computador e no celular.

Atenção: o painel (`/admin/`) e a API (`/api/*`) **não funcionam na HostGator**; só na Vercel ou no Cloudflare. Na HostGator os valores ficam como estão no HTML.

## Testar localmente

```bash
npm install
npm run dev          # http://127.0.0.1:8765/pro/ e /admin/ (banco em memória; o código de login aparece no terminal)
npm test             # testes do backend
npm run test:worker  # o mesmo fluxo no ambiente real do Cloudflare Workers
```

Só as páginas, sem o painel: `python3 -m http.server 8765` e abra `/pro/` ou `/black/`.

## Pendências

- O que `/black` mostra depois do fim da oferta (30/11/2026): decisão do cliente.
- Imagem do topo azul de `/pro/` e imagem de compartilhamento (`pro/assets/og-pro.jpg`): aguardando o cliente.
- Migração para o Cloudflare e decisão sobre o painel: ver `ADMIN.md` e `CLAUDE.md`.
- Pixels de rastreamento e política de privacidade: não incluídos por decisão; entram juntos, se o cliente pedir.

## Documentação

`CLAUDE.md` (contexto e regras), `DESIGN.md` (identidade e tokens), `SECURITY.md` (dados, acessos e riscos), `GUIDELINES.md` (branches e publicação), `ADMIN.md` (painel, instalação, migração).
