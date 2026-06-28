# Consistencia de diseño + sistema de tokens — Plan de implementación

> **Para quien lo ejecute (agente o humano):** implementar tarea a taca, en orden. El proyecto NO tiene tests unitarios de UI → el "test" de cada tarea es **verificación visual real** (cargar la vista en navegador, medir con getComputedStyle, comparar). Cada tarea termina con commit firmado Fast Casual Corporate. Marca `- [ ]` → `- [x]` al cerrar.

**Goal:** Eliminar la deriva de consistencia visual del dashboard FAT SMASH llevando barras, radios, tipografías y colores a una ÚNICA fuente de verdad (tokens), de modo que cambiar un token cambie todo a la vez.

**Architecture:** Primero declarar los tokens base que FALTAN (causa raíz: ~15 hallazgos cuelgan de 3 tokens inexistentes). Luego barrido sistémico de hex/px sueltos → tokens. Luego bugs concretos. Cerrar con una red anti-deriva (stylelint) para que el problema no vuelva.

**Tech Stack:** React 19 + TypeScript + Vite · CSS con custom properties en `src/index.css` (:root + `.app`) · componentes reutilizables en `src/components/ui.tsx`.

## Constraints globales (verbatim del canon de Juan)
- Estética **premium Apple** ("como si Apple hiciera un videojuego"). Anti-slop.
- **Una sola fuente de verdad**: barras (`--bar-h`/`--bar-r`), radios, tipografía (`--fs-*`), color (tokens semánticos). PROHIBIDO px/hex/font sueltos a ojo.
- Multi-tenant: el acento es `var(--brand)`/`data-accent`; NUNCA `#ffbf10` a pelo.
- Tema claro Y oscuro deben funcionar (tokens que se invierten).
- Rejilla 4px. Motion: nada `transition: all`, decorativo nunca `infinite`, respeta `prefers-reduced-motion`.
- Verificar SIEMPRE en navegador real antes de decir "hecho". Commits firmados Fast Casual Corporate.
- Fuente del informe: `docs/AUDITORIA-CONSISTENCIA-28jun.md` (354 hallazgos, 64 agentes).

> **Ya arreglado, NO tocar:** `.br-track`/`.ped-leg-bar` (fallback 12px quitado) · `.gx-cat-track`/`.gx-cat-fill` (ya usan `var(--bar-r)`). El rediseño del Mapa y el comparador de fechas (28-jun) están hechos.

---

## FASE 0 — Tokens base que faltan (CAUSA RAÍZ · máxima prioridad, bajo riesgo)

> 3 declaraciones desbloquean ~15 ítems posteriores. Hacer esto ANTES que cualquier barrido.

### Tarea 0.1: Declarar `--accent-ink`
**Files:** Modify `src/index.css` (:root / `.app`, ~L100 y bloque de acentos L1566+)
- [ ] Declarar `--accent-ink: #1a1404;` en `.app` (tema oro/default) y por cada `data-accent`.
- [ ] Verificar que `var(--accent-ink, #1a1404)` ya no depende del fallback (DevTools: computed del token en `.app`).
- [ ] Commit.

### Tarea 0.2: Crear escala de radios de panel grande
**Files:** Modify `src/index.css` (:root, ~L100)
- [ ] Añadir `--card-r-lg: 22px;` (y opcional `--card-r-xl: 26px;`). Documentar al lado de `--card-r: 18px`.
- [ ] Commit.

### Tarea 0.3: Tokens semánticos/pill que faltan
**Files:** Modify `src/index.css` (:root)
- [ ] `--r-pill: 100px;` (unificar `999px` vs `100px`).
- [ ] `--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;` (lo usa el terminal del Mapa).
- [ ] Opcional: `--shadow-modal`, `--takeaway`, `--vs` (morado del comparar) si se van a usar en las fases siguientes.
- [ ] Documentar los tokens nuevos en `DESIGN-CANON.md`.
- [ ] Commit.

---

## FASE 1 — Barrido sistémico de color (theming claro + multi-tenant)

> Buscar/reemplazar con verificación. Tras cada barrido: cargar 3-4 vistas en oscuro Y claro y comprobar que nada cambió a peor.

### Tarea 1.1: tinta-sobre-oro → `var(--accent-ink)`
**Files:** Modify `src/index.css`
- [ ] Reemplazar los 33 `#1a1404` sueltos por `var(--accent-ink)`.
- [ ] Reemplazar los 13 `#1a1206` (zona `.pd-*`/online, misma intención) por `var(--accent-ink)`. **NO** tocar `#04130d` L1940 (tinta sobre botón VERDE).
- [ ] Verificar botones Cobrar/Añadir/Hecho, chips de mesa, Pedir/Online en ambos temas.
- [ ] Commit.

### Tarea 1.2: verde semántico → `var(--ok)`
**Files:** Modify `src/index.css`, `src/sections/Coste.tsx` (L13-16), `src/sections/Almacen.tsx` (L56 `toneColor`), `src/sections/MapaIncidencia.tsx` (informe PNG `#7CEF5A`)
- [ ] `#34d399` (×28) → `var(--ok)`; rgba(52,211,153,…) → `color-mix(in srgb, var(--ok) X%, transparent)`.
- [ ] Hex de verde en JS (Coste `G_VERDE`, Almacen `#7CEF5A`) → leer del token o constante única.
- [ ] Verificar panel de pago + Almacén + Coste en tema CLARO (donde `--ok` pasa a `#1aa86a`).
- [ ] Commit.

### Tarea 1.3: marca → `var(--brand)`
**Files:** Modify `src/index.css` (`.btab-i.on` L4110, `.cdh-clear:hover` L4334, `.alm-card`, `.cromo-rating`)
- [ ] `#ffbf10` a pelo → `var(--brand)` (respeta `data-accent` multi-tenant).
- [ ] Verificar cambiando el acento en el editor de diseño (Canon) que TODO sigue al acento.
- [ ] Commit.

---

## FASE 2 — Barras y radios sueltos → tokens

### Tarea 2.1: la única barra rebelde
**Files:** Modify `src/index.css` (`.alm-ie-track` L4050)
- [ ] `height: var(--bar-h); border-radius: var(--bar-r);` (quita `12px`/`100px` a ojo).
- [ ] Verificar barra de Almacén con el slider "Grosor de barras" del Canon → debe responder.
- [ ] Commit.

### Tarea 2.2: el editor de barras controla también `--bar-r`
**Files:** Modify `src/sections/Canon.tsx`, `src/lib/designTokens.ts`
- [ ] Añadir slider "Redondez de barras" que aplica `--bar-r`; arreglar la barra-muestra (usa 100 fijo).
- [ ] Verificar que mover el slider cambia TODAS las barras a la vez.
- [ ] Commit.

### Tarea 2.3: radios de panel a token
**Files:** Modify `src/index.css` (modales 20/22/24/26/28 → `--card-r-lg`; ~12 paneles `18px` → `--card-r`), `src/sections/Empleados.tsx`/CSS (`.emp-face` 22px), Pedidos/Pedir (radios sueltos), `.ck-plato`/`.ck-alert` 17px → `--card-r`, `.ck-alert-pill` 15px → `--btn-radius`
- [ ] Barrido con cuidado en radios COMPUESTOS (`.cmp-head`, `.ord-modal::before`): mantener la forma, solo tokenizar el valor base.
- [ ] **NO tocar** `11px` de `.day-row`/`.ck-cuadre`/`.ckd-cell` (caen en rango chip 9-14).
- [ ] Verificar modales (pago, cierre Z, mesa TPV, comparador) y fichas en ambos temas.
- [ ] Commit por sub-bloque (modales / paneles / Caja) para revisar por separado.

### Tarea 2.4: pills `999px` → `var(--r-pill)`
**Files:** Modify `src/index.css` (los 6 `999px`)
- [ ] Unificar a `var(--r-pill)`.
- [ ] Commit.

---

## FASE 3 — Tipografía a la escala `--fs-*`

### Tarea 3.1: módulo Cartera del día (el peor)
**Files:** Modify `src/index.css` (`.wh-*`/`.whp-*`, L190-228)
- [ ] Mapear ~12 `font-size` px a `--fs-*`. Matar el `13.5px` decimal. `23px → --fs-lg` (no xl).
- [ ] Unificar los labels gemelos (`.wh-lbl`/`.whp-lbl`) a un mismo tamaño.
- [ ] Verificar la cartera de la cabecera y su popover.
- [ ] Commit.

### Tarea 3.2: números-héroe a `var(--num-weight)`
**Files:** Modify `src/sections/FoodCost.tsx`/CSS (`.fc-wi-num` weight 800), `src/index.css` (`.section-head h1` fallback 800 → `var(--title-weight, 600)`)
- [ ] Que todas las cifras-héroe usen `var(--num-weight)` (responden al editor tipográfico).
- [ ] Commit.

---

## FASE 4 — Bugs concretos (rápidos, alto impacto visual)

### Tarea 4.1: Kds — reglas duplicadas en conflicto (CRÍTICA)
**Files:** Modify `src/index.css` (`.kds-ticket.warn`/`.late` L2250-2251 vs L2271-2272)
- [ ] Eliminar el bloque duplicado; dejar UN rojo (token). Verificar tickets KDS en alerta/tarde.
- [ ] Commit.

### Tarea 4.2: Salón — leyenda contradice el color real de las mesas
**Files:** Modify `src/index.css` (`.sl-dot.*`) para casar con `ESTADO_COLOR` de `src/lib/salon.ts`
- [ ] Que el punto de la leyenda use EXACTAMENTE el color del estado (libre/ocupada/cobrar). Idealmente leer de un token compartido.
- [ ] Verificar Salón en servicio: leyenda == calor de mesa.
- [ ] Commit.

### Tarea 4.3: Resumen — token fantasma `var(--text)`
**Files:** Modify `src/sections/Resumen.tsx` (`.rs-h2`) o `src/index.css`
- [ ] `var(--text)` solo existe en `[data-theme=light] .sidebar` → en oscuro el título de "Cuenta de resultados" queda sin color fiable. Cambiar a `var(--ink)`.
- [ ] Verificar en oscuro.
- [ ] Commit.

### Tarea 4.4: motion — `transition: all`
**Files:** Modify `src/index.css` (`.pd-track-dot` L4704)
- [ ] Lista explícita: `background, border-color, color, box-shadow`.
- [ ] Revisar `panel-card:hover borderBreath infinite` (L1117): confirmar excepción o quitar `infinite`.
- [ ] Commit.

---

## FASE 5 — Componentes reutilizables (cierra el círculo de modularidad)

### Tarea 5.1: `Stat` con todos los tonos
**Files:** Modify `src/components/ui.tsx` (L164) + CSS `.rstat-val.t-*`
- [ ] Ampliar `tone?: Tone` (6 tonos como Donut/Badge) → evita inline cuando una cifra es roja/ámbar.
- [ ] Commit.

### Tarea 5.2: Donut track a clase/token
**Files:** Modify `src/components/ui.tsx` (L279 `stroke="rgba(255,255,255,.08)"`)
- [ ] Clase `.donut-track` (o token `--ring-track`) con variante dark/light en CSS.
- [ ] Commit.

### Tarea 5.3: DayBreakdown (Caja) consume el Donut canónico
**Files:** Modify `src/sections/Caja.tsx` (L21-81) y `src/components/ui.tsx`
- [ ] Mínimo: alinear r=34/sw=8/track .08 al canon. Ideal: extender `<Donut>` a N-segmentos+hover y consumirlo (mata la matemática de arco duplicada).
- [ ] Verificar el donut de Caja idéntico al del resto.
- [ ] Commit.

---

## FASE 6 — Red anti-deriva (para que NO vuelva)

### Tarea 6.1: stylelint como gate
**Files:** Create `.stylelintrc.json`, Modify `package.json` (script `lint:css` + en CI)
- [ ] Regla `declaration-property-value-disallowed-list` que prohíba px en `border-radius`/`height` de barras y hex en `color`/`background` de roles tokenizados.
- [ ] Que el build/PR falle si reaparece un valor a ojo.
- [ ] Commit.

### Tarea 6.2: (opcional, mayor) partir el monolito
**Files:** `src/index.css` (4892 líneas) → `tokens.css` + `components.css` + por sección
- [ ] Solo si hay tiempo; reduce que los autores copien "un valor cercano". Hacer con cuidado y verificación visual completa.

---

## FASE 7 — Limpieza de CSS muerto (deuda del rediseño de hoy)

### Tarea 7.1: barrer CSS huérfano de cromos/anclaje
**Files:** Modify `src/index.css`
- [ ] Eliminar `.cromo-deck`/`.cromo*`/`@keyframes cromoFlash` (~L4325-4412), `.cmp-layer`/`.cmp-leads`/`.cmp-anchor`/`.cmp-card.cmp-3d*`/`.cmp-magnet` (~L3720-3753), `.cmp-head-send`, `.cmp-mode`, `.cmp-scrim`, y la regla `.mapa-3d:not(.ready) .cmp-anchor`.
- [ ] Verificar que el Mapa (tarjetas `.cmp-big`) sigue intacto (no comparten clase).
- [ ] Commit.

### Tarea 7.2: limpiar CSS zombi del comparador viejo
**Files:** Modify `src/index.css`
- [ ] Quitar `.ckc-delta`/`.ckc-dnum`/`.ckc-dlbl` (ya reemplazados por `.ckc-deltas`/`.ckc-drow`/`.ckc-dlbl2`). Comentario `(12px)` huérfano en `.br-track`.
- [ ] Commit.

---

## Backlog de FEATURES (fuera del barrido de consistencia · priorizar por ROI)
- **F2/F4 (P0):** Backend Fase 0 (Supabase) → desbloquea pedido-online-QR (cobro real: MONEI/Stripe Connect, 1 cuenta por local). Bloqueado en Juan.
- **F3 (P1):** slider `--card-r`/`--card-r-lg` en el editor "Sistema de diseño".
- **F5 (P1):** visor factura/ticket en Ventas TPV + detalle de día en Compras/Ventas (responsable + auto-rellenado).
- **F6 (P2 · filtro):** norte ROI — cada feature debe ahorrar/ganar € (calculadora ROI, food-cost por céntimo, empleados improductivos).

## Orden recomendado de ataque
**FASE 0 → 1 → 2 → 4 → 3 → 5 → 7 → 6.** (Tokens base primero; bugs concretos (Fase 4) se pueden colar tras la Fase 1 para victorias rápidas visibles; la red anti-deriva al final, cuando ya no quedan valores a ojo que la hagan fallar.)
