# REBELL · Canon de Diseño

> **La biblia visual del producto.** Extraído del código real (`index.css` + `ui.tsx` + las 6 secciones
> ancla: Caja, Carta, Almacén, Mapa de Rivales, Salón, TPV). Sirve para que cualquier rediseño se
> **clave a la primera** y entre por los tokens, no a ojo. Si cambia una convención transversal, se
> actualiza AQUÍ.
>
> **Tesis rectora:** *"como si Apple hiciera un videojuego"* — **forma de Apple** (contenida, silenciosa,
> premium) con **física de juego** (spring, recompensa, count-ups, vida). Menos elementos, cada uno
> perfecto (norte Revolut / Opal / Netflix). Que NO huela a plantilla de IA.

---

## 0 · Las 4 reglas que mandan sobre todo

1. **Todo sale de tokens** (`:root` + `.app`). Nunca px a ojo, nunca un hex suelto. Cambiar el token
   reviste TODO el dashboard a la vez. → §1
2. **Una sola fuente de verdad por concepto.** Las cifras se pintan con `<Stat>`/`<StatRow>` (ui.tsx),
   las tarjetas con `<Card>`, las barras con `<BarRow>`. No se duplica el look inline. → §3
3. **Motion con disciplina:** solo `transform`/`opacity`, `ease-out` en entradas, press feedback
   `scale(.97)`, decorativo **one-shot nunca `infinite`**, respeta `prefers-reduced-motion`. → §2
4. **Dark-mode sagrado:** JAMÁS `box-shadow` de color de marca sobre fondo casi-negro (halo sucio).
   Profundidad con **gradiente limpio** y **anillo crispy**, sombra **neutra**. → §7

---

## 1 · Tokens (la fuente de verdad)

### Color
```
--bg:#08080a   --bg-2:#0d0d10   --surface:#141417   --surface-2:#1a1a1e
--line:rgba(255,255,255,.07)    --line-strong:rgba(255,255,255,.13)
--ink:#f5f5f7   --muted:rgba(255,255,255,.54)   --faint:rgba(255,255,255,.32)

MARCA (theming, cambia estas y se reviste todo):
--brand:#ffbf10  --brand-soft:#ffd45e  --brand-deep:#e8ab0c  --brand-rgb:255,191,16
(en .app derivan: --gold, --gold-soft, --gold-deep, --cash)

Semánticos:
--ok / --home:#34d399 (verde)   --warn:#f5b341 (ámbar)   --card:#4aa3ff (azul)
rojo peligro:#ff5c5c / #ff6b6b   tinta sobre oro:#1a1404
```
- **Texto sobre oro siempre `#1a1404`** (marrón cacao), nunca negro puro ni blanco.
- **Estados semánticos:** verde = bien/oportunidad, ámbar = aviso, rojo = crítico/rival peligroso, azul = tarjeta/dato.
- Las superficies translúcidas usan `color-mix(in srgb, var(--surface) 64%, transparent)`, no un hex opaco.

### Separador (la línea divisoria canónica)
```
--sep   = linear-gradient(180deg, transparent, brand .05 →14%, brand .62 @50%, brand .05 →86%, transparent)   (vertical)
--sep-h = el mismo en 90deg                                                                                    (horizontal)
tema claro: oro PROFUNDO rgba(176,124,8,…) @.66 (sobre blanco el oro brillante no se ve)
```
- **Toda línea que separa datos usa `var(--sep)`**, no un hairline plano. Es un **hairline DORADO** que
  **brilla en el centro y se desvanece en los extremos** (calco de la referencia de Juan, 24-jun). Sigue el
  `data-accent` vía `--brand-rgb`. Es un **FILL** (1px de ancho con gradiente), nunca un `box-shadow` → crispy,
  sin halo sucio. Aplicado hoy en `.rstat + .rstat::before` (StatRow) y `.ckd-cell + .ckd-cell::before` (tira
  de días de Caja). Visible en el **Canon** → Tokens → *Separador*.

### Tipografía
- **Display/UI/números:** `Clash Grotesk` (conmutable a Inter/Roundo vía `.app[data-type]`).
- **Números siempre** `var(--font-num)` + `font-variant-numeric: tabular-nums` (clase `.tnum`) → nunca bailan.
- `--num-spacing:-1px` · `--num-weight:600` (en Inter: -1.5px / 700).
- Escala de cifra-héroe: `clamp()` SIEMPRE (móvil→desktop). Ej. total Caja `clamp(78px,15vw,188px)`.

### Forma · Sombra · Easing
```
Radios (TOKENS, fuente única — prohibido valor a ojo, lo veta stylelint):
  input/celda  --r-input 10  ·  chip/botón pequeño  --r-chip 12  ·  botón CTA  --btn-radius 14
  panel  --card-r 18  ·  panel grande/modal  --card-r-lg 22  ·  XL  --card-r-xl 26  ·  pastilla  --r-pill 100
  (radios compuestos —pestañas, notch, barras— son formas intencionales, no llevan token)
Sombra base (neutra): 0 2px 10px -4px rgba(0,0,0,.4), 0 22px 48px -30px rgba(0,0,0,.7)
                       + inset 0 1px 0 rgba(255,255,255,.04)  (luz cenital)
--ease / --ease-out: cubic-bezier(.23,1,.32,1)   ← entradas, settle (el de Juan)
--ease-in-out:       cubic-bezier(.77,0,.175,1)
--ease-spring:       cubic-bezier(.34,1.56,.64,1) ← overshoot, press, pops
```

### Atmósfera de página (siempre presente, z bajo)
- `.bg-aura`: 2 radiales (oro arriba-centro .08, azul esquina .05) + gradiente vertical bg-2→bg.
- `.grain`: ruido SVG, `opacity:.5`, `mix-blend:overlay`. Da textura sin ensuciar.

---

## 2 · Gramática de motion

| Regla | Valor |
|---|---|
| Propiedades animables | **solo** `transform` y `opacity` (nunca `transition: all`) |
| Duración UI | < 300ms (hover .15–.2s, press .12–.14s) |
| Entradas | `ease-out` (nunca ease-in), entran desde `.95+opacity` (nunca `scale(0)`) |
| Press feedback | `:active { transform: scale(.96–.97) }` (botones), `.9` (iconos/chips) |
| Spring (motion/react) | tarjetas `stiffness 300–460 / damping 26–34`; pops `520–620 / 15–20` |
| Stagger de entrada | 55–70ms por índice (kpi-tiles 50ms, marcadores 70ms) |
| Decorativo | **one-shot, jamás `infinite`** (excepto vida ambiental muy sutil: aura 7s, LED 1.4s) |
| Count-up | número sube de 0 al valor al aparecer (`<CountValue>` / `<Stat>`), 900ms ease-out cúbica |
| reduced-motion | bloque global `* { animation/transition .001ms }` + overrides por sección |

**Movimientos recurrentes** (el "sabor REBELL"):
- **Count-up + shine:** la cifra cuenta y un barrido de luz la cruza (`numshine`/`numGlow`).
- **Pop escalonado:** elementos entran `scale .5→1 + opacity`, spring, stagger.
- **Press spring:** todo lo clicable hunde con `scale` y `--ease-spring`.
- **Pulso semántico:** lo crítico late (opacity 1↔.42, 1.1–1.8s) — el único loop permitido, y solo en alertas.

---

## 3 · Componentes canónicos (`ui.tsx` — úsalos SIEMPRE)

| Componente | Qué es | Look medible |
|---|---|---|
| **`<Stat value unit label>`** + **`<StatRow>`** | **EL criterio único de cifra.** Valor grande + unidad dorada pequeña + label. | `.rstat-val` `clamp(42px,4.8vw,58px)` w700 #fff; unidad `i` `.4em` w600 oro; separadas por **línea fina vertical dorada** (`+ .rstat::before` 1px `var(--sep)`), **sin recuadro**. Count-up integrado. |
| **`<Card pad>`** | Tarjeta base (`.panel-card`). | surface 64% translúcida, border `--line`, radio 18px, sombra neutra + inset. **Spotlight dorado al hover** (`::after` radial 220px que sigue el cursor `--mx/--my`, opacity .6). |
| **`<SectionHeader title subtitle right>`** | Cabecera de toda sección. | h1 `var(--font-display)` `clamp(24px,2.2vw,40px)` w600; p `--muted`. Acciones a la derecha. |
| **`<KpiTile label value unit delta foot trend>`** | KPI con tendencia. | Gradiente `surface-2→surface`, border-strong, glossy top 48%, label con cuadradito dorado, número `clamp(34px,3.6vw,70px)`, foot ▲/▼ verde/ámbar. Entra `kpiIn .52s` con stagger. |
| **`<BarRow label value max color amount>`** | Barra de proporción. | grid `96px 1fr auto`, track 14px `rgba(255,255,255,.07)` radio 100px, fill gradiente por color (`c-gold/blue/green/amber/red`). |
| **`<BarChart data>`** | Barras verticales (días/meses). | columnas flex, barra `max 38px` radio `7px 7px 3px 3px`, **última `.hot`** (blanco→oro + glow). |
| **`<DataTable columns rows>`** | Tabla/libro. | th uppercase faint 11.5px, border-collapse, font `clamp(12.5px,1.05vw,17px)`. Primera col no-wrap (en móvil sí). |
| **`<Donut value label sub tone>`** | Anillo % (food cost, ocupación). | r34 sw8, track `rgba(255,255,255,.08)`, arco por tone, `linecap round`, número centro `clamp(19px,4vw,26px)`. |
| **`<Badge tone>`** | Pastilla de estado. | pill, `t-gold/green/blue/amber/red/muted`, fondo 12–14% + border 24–26% del color. |
| **`<CountValue value>`** | Envuelve cualquier cifra ya formateada (es-ES) → count-up + sonido suave throttled. | 900ms, clava el texto original al final. |

**Grid responsive canónico** (`<Grid cols>` → `.p-grid`): 1 col → `560px` 2 cols → `1024px` `var(--cols)`.
Gap `clamp(12px,1.2vw,24px)`. **Breakpoints del sistema: 560 / 680 / 760 / 900 / 1024 / 1280.**

---

## 4 · Patrones transversales (las "jugadas" que hacen que parezca REBELL)

1. **Cifra-héroe:** número GIGANTE `font-num` tabular + unidad/€ **pequeña dorada en superíndice** + label
   uppercase debajo. Brilla (text-shadow blanco+oro), no es gris. Count-up al entrar.
2. **Datos en líneas finas, no en recuadros.** Cifras sueltas separadas por hairline vertical (`.rstat`),
   filas con `border-top: 1px var(--line)`. Prohibido el mar de pastillas flotantes (AI-slop).
3. **Chaflán angular (lenguaje táctico):** `clip-path: polygon(... esquina cortada 13–17px ...)` en paneles
   HUD/inteligencia. Rompe el rectángulo corporativo → cockpit sci-fi.
4. **Nodo hexagonal / retícula:** hexágono (`clip-path` 6 lados) bajo marcadores y como "objetivo táctico";
   lock-on de esquinas. Lenguaje Watch Dogs.
5. **Glassmorphism medido:** `backdrop-filter: blur(7–22px) saturate(1.3–1.5)` sobre fondo translúcido
   oscuro (island, popovers, HUD, inspector). Nunca sobre fondo claro.
6. **Color dinámico por entidad:** `--type`/`--accent`/`--tone`/`--role`/`--heat` inyectado inline →
   el borde, el glow y los fills se tiñen solos (categoría de plato, tipo de almacén, calor de mesa,
   nivel de stock, amenaza de rival). UNA clase, N colores.
7. **Foto + scrim + cifra:** imagen `object-fit:cover`, velo gradiente arriba (legibilidad), cifra que
   flota encima con text-shadow. (Carta, Almacén, Caja-cocina.)
8. **Marco que vive:** borde cónico que orbita (`@property --ang`, hero Caja), aura radial que respira
   (panel mapa 7s), spotlight que sigue el cursor (panel-card). Vida ambiental sutil, no fuegos artificiales.
9. **Recompensa one-shot:** al completar una acción importante (cobrar, cerrar caja) → count-up final +
   check dorado con spring + sonido escalado + confeti sutil. El "wow" de videojuego.
10. **Corner ticks + kicker:** esquinitas de 11px y un kicker uppercase `letter-spacing .14–.22em` en oro
    arriba del bloque. Detalle de "instrumento de precisión".

---

## 5 · Léxico por sección (la personalidad de cada pestaña)

- **CAJA — hero cinematográfico inmersivo.** Ocupa la pestaña entera sin bordes; fondo de cocinas en bucle
  (ken-burns + aberración cromática + grano + brasas + parpadeo de fuego); el total del día GIGANTE
  (`clamp(78px,15vw,188px)`, brilla siguiendo la forma del texto) flota encima con paneles glass.
  Cuadre grande debajo (verde ✓ / ámbar aviso). Es la PÁGINA, no una tarjeta.
- **CARTA — coverflow selector de personajes (Pokémon/FIFA).** Cartas 3D `clamp(330px,28vw,430px)` ×
  `clamp(480px,64vh,588px)`, radio 28px, `perspective:2000px`, tilt ±14°, la enfocada a `scale 1` brillante
  y las laterales a `.82 brightness .62`. Stat overlay tipo tarjeta bancaria (ventas/mes, número 46px con
  glow) arriba-derecha; botón editar (lápiz 40px glass) arriba-izquierda; **flip 3D** a la cara de edición.
  Pestaña con notch curvo abajo. Color por categoría (`--type`).
- **ALMACÉN — HUD de inventario.** Tarjetas de producto fondo `#050505`, borde oro, **% gigante**
  `clamp(42px,6vw,64px)` con glow por `--tone` (verde/ámbar/rojo) + **barra de nivel que DRENA en vivo**
  (`width 2.2s linear`). Crítico parpadea rojo (`apcCrit`). Tarjeta-almacén con foto + ocupación.
- **SALÓN — editor de planta sobre lienzo.** Canvas 74vh con grid radial punteado (26px) y zoom-to-fit
  (`.45s ease-out`). Mesas arrastrables (`transform` en vivo, snap 1px), superficie cromo gradiente, sillas
  como puntos 13px, formas redonda/cuadrada/rect/L (`clip-path`). **Modo servicio = heat-map**: la mesa se
  tiñe verde→rojo según el tiempo ocupada (`--heat`), "por cobrar" pulsa rojo. Inspector flotante glass.
- **TPV — bipartito con combo sonoro.** Catálogo (grid `minmax(172px,1fr)`) | ticket sticky 350px. Tarjeta
  producto cromo `#0e0e11` color por categoría, badge cantidad dorado con pop. Total count-up, **botón COBRAR**
  gradiente dorado (`gold-soft→gold→gold-deep`) tinta `#1a1404` con inset cromado. Teclado invisible (Enter
  cobra), ka-ching escalado por importe, combo musical al añadir.
- **MAPA DE RIVALES — HUD táctico Watch Dogs sobre mapa 3D.** HUD chaflán glass arriba-izq (título +
  stats + LED live rojo) que se **ensambla** (`.armed`); slider de radio abajo-centro; overlay de arranque
  "◢ INICIANDO OPERACIÓN". Vuelo de entrada cinematográfico (`flyTo` curve 1.42, pitch 60). Marcadores
  `.m3-card` con nodo hexagonal + tallo, pop escalonado, **modo denso** automático (colapsan a pastilla,
  nombre→tooltip) para que en Madrid no se tape todo. Líneas conectoras con **cometa dorado** + magnetize
  anti-overlap. Comparador "VS" con barras GSAP. Panel lateral de inteligencia (chaflanes, auras que respiran,
  amenazas que laten).

---

## 6 · Receta para rediseñar una sección (worked example: **Ventas TPV**)

> Cómo aplico el canon cuando me digas "Ventas TPV está muy normal, súbela de nivel". (Hoy es un
> `<DataTable>` plano — un libro de ventas. El problema: cero jerarquía, cero recompensa, cero "wow".)

**Diagnóstico → qué le falta:** una cifra-héroe, vida, y lenguaje propio. Es Finanzas, no Inteligencia →
el norte NO es el HUD táctico del Mapa, es el **hero limpio tipo Revolut** (anillo + datos al lado) + la
**recompensa** del TPV.

**Propuesta calcada al canon (lo clavaría así):**
1. **Cabecera-héroe** (`<SectionHeader>` + bloque hero): total facturado del periodo como **cifra-héroe**
   `font-num clamp(48px…)` con count-up + shine; al lado un `<StatRow>` con Nº tickets · ticket medio ·
   base · IVA (líneas finas, sin recuadros). Un mini `<BarChart>` de los últimos 14 días con la barra de
   hoy `.hot`.
2. **El libro** sigue siendo `<DataTable>` (no reinventar) pero: filas con hover spotlight, número de ticket
   en `font-num` con kicker, total por fila en oro, badge de método (`<Badge tone>`: efectivo=gold,
   tarjeta=blue, domicilio=green). Entrada con stagger 55ms.
3. **Detalle de ticket = flip/drawer** reusando el lenguaje de la cara trasera de Carta o el inspector glass
   del Salón (no un modal genérico).
4. **Exportar CSV** = botón pill secundario en `right` de la cabecera; al exportar, micro-recompensa
   (check dorado one-shot), nunca un alert.
5. **Color/tokens:** todo del sistema. Acento oro, semánticos por método. Responsive 560/900. reduced-motion.

→ Resultado: deja de ser "una tabla" y pasa a ser "el libro de caja premium de REBELL", coherente con Caja
y TPV sin copiarlos.

**Patrón para una sección NUEVA (4 pasos):** `nav.tsx` (item + icono en `PATHS`) → `registry.tsx`
(id→componente) → `src/sections/X.tsx` (construida con `ui.tsx`) → datos en `lib/data.ts`. Verificar en
navegador (Playwright) claro/oscuro + móvil antes de dar por hecho.

---

## 7 · Anti-patrones (lo que delata "olor a IA" — PROHIBIDO)

- ❌ Mar de **pastillas flotantes** con borde y texto de bajo contraste → filas/columnas con hairline.
- ❌ **Halo/glow de color de marca difuminado** sobre casi-negro (halo sucio) → anillo crispy + gradiente.
- ❌ Texturas baratas (rayas/scanlines/fluted) en superficie premium → fondo limpio o vignette radial.
- ❌ `transition: all` · animar `width/height/top/left` en vez de `transform`.
- ❌ Todo centrado con **mares de aire muerto** → usar el espacio (2 col / lista al lado) o apretar.
- ❌ Número gigante con **texto secundario diminuto descuadrado** al lado → escala tipográfica coherente,
  baselines alineados (usa `<Stat>` y se acabó el problema).
- ❌ `scale(0)` de origen, ease-in en entradas, decorativo `infinite`, sombra dorada sobre negro.
- ❌ Fuentes genéricas (Arial/Roboto/Inter-por-defecto), morados sobre blanco, layout de plantilla.

---

## 8 · Checklist antes de decir "hecho" (talcual)
- [ ] Construido con tokens + componentes de `ui.tsx` (no px a ojo, no look duplicado).
- [ ] Motion: solo transform/opacity, ease-out entradas, press feedback, one-shot, reduced-motion.
- [ ] Dark-mode sin halo sucio; sombras neutras; anillos crispy.
- [ ] **Cargué la vista real, saqué captura, comparé** contra la referencia/ficha. Claro + oscuro + móvil.
- [ ] Si faltó acceso para verlo, lo PEDÍ (no inventé).
