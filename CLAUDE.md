# CLAUDE.md

Site e landing pages do Ágape Multimidia. LP Black November 2026 em `black/` (HTML + CSS + JS, sem build), publicada manualmente na HostGator em `/black/`. Detalhes no `README.md`.

## Skills installed

Project scope (travels with the repo):

| Skill | Source | Use |
|---|---|---|
| impeccable (v0.1.23 bundle) | https://github.com/pbakaus/impeccable (Apache-2.0) | Design audit, polish, critique on the LP. Run `/impeccable init` once to set the design context. First run downloads its engine binary (checksum-verified). |

Already available (no install):

| Skill | Use |
|---|---|
| `/security-review` (built in) | Before each merge |
| token-budget | Model routing and context hygiene |
| lgpd-web | Before adding Meta/Google pixels: cookie notice, PT-BR privacy notice |
| design-critique + accessibility-review | Gate before delivery |
| seo-ai-visibility | SEO pass before publishing (og:image still pending) |
| webapp-testing | Playwright check at mobile widths |

Deliberately not installed: style skills (hallmark/taste-skill), security-audit, supabase, vercel, claude-seo.
