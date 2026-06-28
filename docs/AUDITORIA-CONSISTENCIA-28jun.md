# Auditoría de consistencia FAT SMASH — 28-jun-2026

> Macro-investigación con 64 agentes · 354 hallazgos brutos · 27 confirmados (de críticos/altos).
> Severidad: 9 críticas · 88 altas · 144 medias · 113 bajas.
> Plan de ataque ejecutable → docs/superpowers/plans/2026-06-29-consistencia-tokens-fatsmash.md

Tengo el estado real verificado. Confirmo lo pendiente de seguridad y features rápidamente con la memoria, y compongo el informe.

Ya tengo lo necesario. Los hallazgos de barras (br-track, gx-cat) ya están arreglados; el resto sigue vivo. Compongo el informe.

---

# INFORME ÚNICO — FAT SMASH · qué atacar mañana (28-jun)

Estado verificado en código real. **Ya arreglado y NO tocar:** `.br-track`/`.ped-leg-bar` (fallback 12px quitado), `.gx-cat-track`/`.gx-cat-fill` (ya usan `var(--bar-r)`). Todo lo demás de abajo sigue vivo.

## TOP-10 (atacar en este orden)

| # | Qué | Archivo | Arreglo en 1 línea |
|---|---|---|---|
| 1 | **`--accent-ink` no existe en el tema oro** (default). Funciona solo de chiripa por el fallback `,#1a1404`. | index.css L100 / L1566+ | Declarar `--accent-ink:#1a1404` en `.app` (y/o `.app[data-accent='gold']`). |
| 2 | **51× `#1a1404` tinta-sobre-oro hardcodeada** (33 sueltas reales) → no sigue al theming. | index.css | Reemplazar los 33 sueltos por `var(--accent-ink)`. |
| 3 | **Falta token `--card-r-lg`** para "card grande" → cada panel inventa 20/22/24/26. | index.css L100 | Crear `--card-r-lg:22px` (+ opc. `--card-r-xl:26px`). Base es la causa raíz de 3 ítems de radios. |
| 4 | **~12 paneles con `border-radius:18px` a ojo** = valor de `--card-r` pero sin token. | index.css | `18px → var(--card-r)` en paneles rectangulares. |
| 5 | **Modales con 20/22/24/26/28px sueltos** (`.pay-panel`, `.caja-modal`, `.cierre-card`, `.cmp-card`, `.tpv-mesa-panel`…). | index.css | `→ var(--card-r-lg)`; ojo radios compuestos (`.cmp-head`, `.ord-modal::before`). |
| 6 | **Cluster wallet `.wh-/.whp-` con ~12 `font-size` px** (incl. `13.5px` decimal, dos labels gemelos 9 vs 10px). | index.css L190-228 | Mapear a `--fs-*`; unificar `.wh-lbl`/`.whp-lbl`; matar `13.5px`. **23px→`--fs-lg`** (no xl). |
| 7 | **`.alm-ie-track` ignora AMBOS tokens** (`height:12px` + `radius:100px`). Única barra que no bebe de `--bar-h`. | index.css L4050 | `height:var(--bar-h); border-radius:var(--bar-r)`. |
| 8 | **Verde `#34d399` hardcodeado 28×** → no se reviste en tema claro (`--ok`/`--home`=#1aa86a). | index.css | `#34d399→var(--ok)`; rgba→`color-mix`. Panel pago el más visible. |
| 9 | **`.pay-confirm` fuera del sistema de botones** (`padding:14px;radius:14px`). | index.css L1940 | `padding:var(--btn-py) var(--btn-px);border-radius:var(--btn-radius);font-size:var(--btn-fs)`. |
| 10 | **`transition: all` en `.pd-track-dot`** — prohibido por canon de motion. | index.css L4704 | Lista explícita: `background, border-color, color, box-shadow`. |

---

## (A) Consistencia de diseño · visual/tipografía/barras/radios

**P0**
- **A1 · Modales con radio a ojo (20/22/24/26/28).** index.css. Mismo rol (overlay glass) con 6 valores. → `var(--card-r-lg)` (ver TOP-3/5).
- **A2 · Wallet pintada entera con px** (TOP-6). index.css L190-228. `13.5px` no existe en la escala; dos labels gemelos a distinto tamaño.

**P1**
- **A3 · 12 paneles `18px` a ojo** = `--card-r` sin token (TOP-4).
- **A4 · `.alm-ie-track` ignora `--bar-h` y `--bar-r`** (TOP-7).
- **A5 · `.ck-plato`/`.ck-alert` radio `17px`** (huérfano, fuera de escala). → `var(--card-r)`. `.ck-alert-pill 15px`→`var(--btn-radius)`. **NO tocar** los `11px` de `.day-row`/`.ck-cuadre`/`.ckd-cell` (caen dentro del rango chip 9-14 del canon).
- **A6 · `.cmp-3d .cmp-track height:8px`** pisa `--bar-h`. Si es a propósito (barra fina en 3D), documentar excepción o `calc(var(--bar-h)*.4)`.
- **A7 · `999px` vs `100px`** para pill (6 vs 72). Unificar los 6 `999px` a `100px` (o crear `--r-pill`).

**P2**
- **A8 · DayBreakdown donut (Caja.tsx) diverge del canon** (r=30/sw=9.5 vs r=34/sw=8). Drift visible solo de cerca; ver bloque B.
- **A9 · `.day-split` usa borde `dashed`** fuera del lenguaje de separador. → `var(--sep)` o `1px solid var(--line)`.
- **A10 · `.bc-bar` vs `.wf-bar`** base 3px vs 4px sin motivo. Unificar a `7px 7px 3px 3px`.
- **A11 · `.ck-cuadre` borde `1.5px`** (todo lo demás 1px). → 1px.

**P3**
- **A12 · `.section-head h1` fallback peso 800** (canon = 600). → `var(--title-weight, 600)`.
- **A13 · `.bar-row` grid `150px`** vs canon `96px` (L1172). Decidir uno y tokenizar (`--barrow-label-w`) + actualizar DESIGN-CANON.md.
- **A14 · `.ck-total` clamp `48-104px`** vs canon `78-188px`. Resolver código↔canon (single source).
- **A15 · `panel-card:hover` `borderBreath … infinite`** (L1117). Canon prohíbe `infinite` decorativo; está comentado como intencional → confirmar y anotar excepción o quitar `infinite`.

---

## (B) Tokens y modularidad · single-source

**P0**
- **B1 · `--accent-ink` indefinido en tema oro** (TOP-1). La autorización del color de todo el dashboard depende de un fallback. Declararlo en base.
- **B2 · Falta `--card-r-lg`** (TOP-3). Sin él, el escalón "card grande 20-26" no tiene gobierno → raíz de A1/A3.

**P1**
- **B3 · `#1a1404` ×33 sueltos** + `#1a1206`×13 (zona `.pd-*`, misma intención tinta-sobre-brand) + `#4a2e00`×2. Unificar a `var(--accent-ink)`. **NO** tocar `#04130d` L1940 (tinta sobre botón VERDE, intención distinta).
- **B4 · `#34d399` ×28 a pelo** (TOP-8). Existe `--ok`/`--home`. Aplicar sistémico, no solo panel pago.
- **B5 · `#ffbf10` marca a pelo** en `.btab-i.on` (L4110), `.cdh-clear:hover` (L4334), `.alm-card{--accent}`, `.cromo-rating i`. Rompe data-accent multi-tenant. → `var(--brand)`.
- **B6 · DayBreakdown duplica `<Donut>`** (Caja.tsx L33/42/52). Mejor: extender `<Donut>` para N-segmentos+hover y consumirlo; mínimo: alinear r=34/sw=8/track .08.

**P2**
- **B7 · `Stat` solo soporta gold/green** mientras Donut/Badge soportan los 6 tonos (ui.tsx L164). Una cifra-héroe roja/ámbar obliga a inline. → ampliar `tone?: Tone` + clases `.rstat-val.t-*`.
- **B8 · Track del Donut con color inline en JSX** (ui.tsx L279 `stroke="rgba(255,255,255,.08)"`). → clase `.donut-track` (o token `--ring-track`); junta dark+light en CSS.
- **B9 · Sombras: `--shadow` usado 8× vs ~145-187 `box-shadow` a ojo.** Crear `--shadow-pop` y `--shadow-modal`, migrar los 5-6 modales casi-iguales. Dejar glows/insets inline.
- **B10 · Morado del Comparar (`#c4b5fd`/`rgba(167,139,250)`) sin token.** No se adapta a tema. → token `--vs` o reusar `--card`.
- **B11 · Naranja "Para llevar" (`#ff7e36`/`#ff9a5c`/`#f5701a`) ×~13 sin token.** → `--takeaway` + `color-mix`.

**P3**
- **B12 · Fuente mono del Mapa repetida literal** (`.mh-term`/`.msw-term`). → `--font-mono`.
- **B13 · `BarChart height=130` y `--den` defaults a ojo** (ui.tsx). 130 no es múltiplo de 4. → token `--chart-h` o 128/132.
- **B14 · Superficies hex opacas** (`#0e0e11`, `#101014`, `#050505`, `#0b0b0d`) no siguen `--surface`/tema claro. Migrar a `color-mix` sobre `--surface` (foto-cards HUD muy oscuras → token `--surface-hud`).
- **B15 · Documentar tokens nuevos en DESIGN-CANON.md** (`--card-r-lg`, `--r-pill`, escala chip) — el canon legitima rangos pero no los tokeniza (raíz de gobierno).

---

## (C) Seguridad

> Sin hallazgos nuevos en este pase de UI. Estado según memoria del proyecto (`rebell-seguridad-auditoria.md`):

**P0 (PENDIENTE de Juan, no de código)**
- **C1 · Rotaciones operativas:** contraseñas, `service_role`, token Cloudflare, keys. Pasadas 1-2 ya hechas (contraseña-en-bundle, migración 0003 `design_comments` anon-cerrado, cabeceras+CSP, proxy Places).
**P2**
- **C2 · Pasadas 3-5** de la auditoría (a criterio de Juan antes de lanzar).
- **C3 · Antes de exponer pago real** (MONEI/Stripe Connect, 1 cuenta conectada por local): firma HMAC tiempo constante, fail-closed, idempotencia `onConflict`, rol en `app_metadata`. Ver `rebell-pasarelas-pago.md`.

---

## (D) Complejidad/optimización + CSS/JS muerto

**P1**
- **D1 · `index.css` = 4892 líneas, monolito.** Agrava todo A/B (autores copian un valor "cercano" en vez de buscar el token). → extraer `tokens.css` + `components.css` + 1 por sección y **stylelint** `declaration-property-value-allowed-list` que prohíba px/hex en props tokenizadas. Hace IMPOSIBLE reintroducir un radio a ojo.

**P2**
- **D2 · `transition: all` en `.pd-track-dot`** (TOP-10, L4704): coste de render + viola motion. → lista explícita.
- **D3 · Matemática de arco duplicada** (Donut canónico vs DayBreakdown). Riesgo de divergencia al tocar tokens (ver B6).

**P3**
- **D4 · Comentario `(12px)` huérfano** en `.br-track` (induce a error tras el fix). Limpiar.
- **D5 · Histograma de radios:** 28 valores distintos en px. Tras crear tokens (`--r-input` 10, `--r-chip` 12, `--btn-radius` 14), barrer y reducir a 3 escalones.

---

## (E) UX y flujos

**P2**
- **E1 · Emojis como iconos** (`☀ ☾ 💵 💳 ⚖ 🍔 📦 ✓` en Caja.tsx) — lista negra anti-slop; render varía por plataforma. → SVG del mismo trazo (ya hay `warnIcon`/`okIcon`/`i-cash`/`i-card`).
- **E2 · `.ck-statrow` override de tamaño del `<Stat>`** (clamp 42-58 → 28-40). Intencional pero ad-hoc. → variante formal `<StatRow size="sm">`.

**P3**
- **E3 · Paddings fuera de rejilla 4px** (`.ck-alert-pill 17px 32px`, `.ck-plato 21px 24px 22px`). Cuantizar o tokens `--space-*`.

---

## (F) Faltan features

> Del backlog de memoria, lo gordo pendiente:

**P0**
- **F1 · Mapa #4/#5: rediseño** (2049 líneas) + **comparador de fechas** — los 2 gordos que quedaron del sprint 28-jun (`rebell-sesion-28jun-diseno.md`).
- **F2 · Backend Fase 0** (Supabase cimientos) — bloquea pedido-online-QR e importar funcionalidad del socio. Bloqueado en Juan.

**P1**
- **F3 · Slider `--card-r` en el editor "Sistema de diseño"** (hoy no existe; cambiar radios de panel exige editar CSS a mano). Cierra el círculo de B2/B3.
- **F4 · Pedido online por QR** (self-order mesa→cocina): recibo+email plantados, falta cobro real (F2).
- **F5 · Visor factura/ticket en Ventas TPV** + detalle de día en Compras/Ventas (con responsable + auto-rellenado) — `rebell-backlog-27jun-tarde.md`.

**P2**
- **F6 · Norte ROI:** cada feature debe ahorrar/ganar € (calculadora ROI, food-cost por céntimo, empleados improductivos). Filtro para priorizar F1-F5.

---

## Causa raíz (3 fixes resuelven ~15 ítems)

1. **Declarar tokens base que faltan** (`--accent-ink`, `--card-r-lg`, opc. `--r-pill`/`--r-chip`/`--shadow-modal`/`--takeaway`/`--vs`/`--font-mono`) → desbloquea A1/A3/A5/A7, B1/B2/B3/B9/B10/B11/B12.
2. **Barrido sistémico de hex** (`#1a1404`→`--accent-ink`, `#34d399`→`--ok`, `#ffbf10`→`--brand`) → B3/B4/B5 + theming claro/multi-tenant.
3. **stylelint + split del monolito** (D1) → impide que el problema vuelva.

**Empezar por TOP-1, 2, 3** (tokens base): son la raíz, bajo riesgo, y habilitan el resto del barrido.

💡 **Ideas locas**
- **Juez anti-deriva en CI:** test que falla el build si aparece un px/hex en propiedad tokenizada (stylelint como gate de PR). El problema no vuelve nunca.
- **Editor "Sistema de diseño" completo:** sliders para `--card-r`, `--card-r-lg`, radios de chip y sombras → Juan retematiza toda la app en vivo y ve el "cambiar 1 token cambia TODO" funcionando de verdad.
- **Modo "auditoría visual":** overlay que pinta en rojo cada elemento cuyo radio/tamaño NO sale de un token (debug visual de consistencia en 1 clic).