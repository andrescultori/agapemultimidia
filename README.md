# agapemultimidia

Site e landing pages do Ágape Multimidia.

## Estrutura

```
black/            LP Black November 2026 → agapemultimidia.com.br/black/
  index.html      página única (HTML + CSS + JS, sem build)
  assets/         logo, favicon, foto do topo, imagem de compartilhamento e fontes (Archivo e Roboto, locais)
```

A estrutura espelha o endereço final: o conteúdo de `black/` precisa ficar em `/black/` na raiz do domínio.

## Publicar a LP Black November na HostGator (manual)

1. No cPanel, abra o **Gerenciador de Arquivos** (ou use FTP) e entre em `public_html`.
2. Crie a pasta `black` (se não existir) e envie **todo o conteúdo** da pasta `black/` deste repositório para dentro dela.
3. Confira que ficou assim: `public_html/black/index.html` e `public_html/black/assets/...`.
4. Abra `https://agapemultimidia.com.br/black/` (de preferência em janela anônima).

Observação: o servidor entrega a pasta `black` antes do WordPress, então o restante do site não muda. Não pode existir uma página do WordPress com o endereço `/black`.

## Testar localmente

```bash
python3 -m http.server 8765
# abra http://127.0.0.1:8765/black/
```

## Pendências da LP

- Definir o que a página `/black` mostra depois do fim da oferta (30/11/2026).
- Pixels de rastreamento (Meta, Google) e link de política de privacidade: não incluídos por decisão; entram juntos, se o cliente pedir.

## Documentação

`CLAUDE.md` (contexto e regras), `DESIGN.md` (identidade e tokens), `SECURITY.md` (dados e acessos), `GUIDELINES.md` (branches e publicação).
