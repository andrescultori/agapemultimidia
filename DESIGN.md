# Ágape Multimidia — Design

## Brand
- Minimalist, dark, direct. Reference the client liked: ianworcman.com.br/consultoria1hora.
- Logo: round mixer-faders icon, `pro/assets/logo.png` and `black/assets/logo.png` (also the favicon).
- One identity is meant to span the site, landing pages, course platform and lesson covers.

## Tokens
Three palettes are in use. Values are taken from the shipped files.

### Black November LP (`black/index.html`)
| Token | Value | Use |
|---|---|---|
| bg | `#0A0A0A` | page background |
| band | `#15171A` | alternate section bands, footer |
| surface | `#1C1F23` | cards |
| border | `#262A30` / `#2C3036` / `#2A2A2A` | card and band borders |
| text | `#FFFFFF` | headings, body |
| muted | `#B8B8B8` | secondary text |
| accent (`--ac`) | `#FFD21F` | CTAs, prices, eyebrows |
| on-accent | `#0A0A0A` | text on yellow |

### Sales page (`pro/index.html`, blue)
Same layout and components as the Black LP; only the accent changes.
| Token | Value | Use |
|---|---|---|
| bg, band, surface, border, muted | as in the Black LP (`#0A0A0A`, `#15171A`, `#1C1F23`, `#2C3036`, `#B8B8B8`) | unchanged |
| accent fill (`--ac`) | `#4066F8` | buttons, badges, top strip, card borders |
| accent text (`--at`) | `#8FA8FF` | eyebrows, prices, check icons, FAQ "+" |
| on-accent | `#FFFFFF` | text on blue fills (4.69:1) |
| glow | `#14204D` | gradient in the offer card |

Why not `#436BFF` for fills: white on `#436BFF` is only 4.39:1 (needs 4.5). `#436BFF` stays the brand blue for covers and large shapes.

### Admin panel (`admin/index.html`)
Uses the brand palette below (graphite `#121418`, surface `#1A1D23`, primary `#436BFF`, tint `#8FA8FF`), errors `#FF6B6B`, success `#4ADE80`.

### Site and lesson covers (brand palette)
| Token | Value | Use |
|---|---|---|
| graphite | `#121418` | background |
| surface | `#1A1D23` | cards |
| deep | `#0D0F12` | illustration fills |
| border | `#2A2E37` | borders |
| text | `#F2F4F8` | text |
| muted | `#A6ADBB` | secondary text |
| primary (Avançado) | `#436BFF`, tint `#8FA8FF` | brand blue |
| Básico | `#1ebb5c` | Básico module covers |
| Comece Por Aqui | `#FFD21F`, tint `#FFE680` | intro covers |
| live/error | `#FF4D4D` | "AO VIVO", errors |

## Typography
- Display: Archivo 700/800. Body: Roboto 400/500/700. Self-hosted woff2.
- LP scale: h1 `clamp(2.25rem,5.2vw,4rem)`, h2 `clamp(1.75rem,3.6vw,2.75rem)`, body 16–20px, eyebrow 13px uppercase with 0.14em tracking.

## Layout
- Max width 1200px, 24px side padding, sections spaced with `clamp(40px,6vw,80px)`.
- Mobile first; grids use `repeat(auto-fit,minmax(min(100%,Npx),1fr))`. No horizontal scroll down to 320px.
- Mobile has a sticky bottom CTA (`.stk`).

## Components (in `black/index.html` and `pro/index.html`)
- `.btn` (accent CTA, min-height 56px), `.btn-dk` (dark on accent), `.btn-sm`.
- `.card`, `.band`, `.sec` (section), `.hd` (section header), `.eyebrow`, `.h2`, `.faq` (details/summary).
- Reveal-on-scroll classes `.rv*`, enabled only when JS adds `.js`; respects `prefers-reduced-motion`.

## Lesson covers
- 320×480 (also rendered at 640×960), generated with Remotion. Layout: header (logo + "Transmissão Pro 2.0" + pill), optional module title, illustration card, label line, title, optional subtitle.
- 183 delivered: 37 Básico, 143 Avançado, 3 Comece Por Aqui. Source is outside this repo (see CLAUDE.md TODO).

## Copy
- Language: pt-BR. Voice: direct, practical, no hype beyond the offer itself.
- Course name is "Transmissão Pro 2.0" (not "Transmissão ao Vivo Pro 2.0").
- CTA on `/pro/`: "QUERO COMPRAR AGORA" (all buttons) and "Quero meu desconto" (mid-page). Black LP used "Quero por 12x R$ 8,26", "Garantir meu desconto agora".
- No urgency wording or dates on `/pro/` (the price is permanent).

## Accessibility
- Target WCAG AA: visible focus (`:focus-visible` on buttons and FAQ), touch targets ≥ 44px, reduced-motion support.
- Audit 2026-11-13: footer link height, landmarks and reveal fallback were fixed in PR #5; `/pro/` passed axe with 0 violations at 1280, 390 and 320 px on 2026-11-26. Remaining: eyebrow text is 13px (passes contrast, small).
