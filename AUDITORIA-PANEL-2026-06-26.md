# 🛠️ AUDITORÍA DEL PANEL REBELL — Informe final

**Fecha:** 27-jun-2026 · **Alcance:** 17 secciones + infra (Cloudflare Pages, Supabase, CSP, secretos).
**Tres pasadas combinadas:** Funcionalidad · Seguridad · Diseño.

---

## 1 · RESUMEN EJECUTIVO

La **casa está bien construida**: los cimientos (Supabase con RLS, proxy de pago server-side, persistencia de salón/ventas) son sólidos y **no hay ni un solo agujero de seguridad crítico abierto hoy**. Las secciones ancla (Carta, Empleados, Salón, Caja, TPV, Mapa) ya tienen el "wow" Apple-videojuego que quieres.

Lo **más grave** no es un fallo, es una **mentira de números**: cada sección de análisis se inventa sus propias cifras y **se contradicen en la misma pantalla** (el personal "12.400 €" está clavado a mano en 4 sitios; los gastos fijos tienen 3 cifras distintas). El TPV cobra de verdad, pero **lo que cobras no llega a cocina ni aparece en ningún informe** — son islas desconectadas. Y el Mapa tiene tu local hardcodeado, lo que **bloquea vender el SaaS a otro restaurante**.

Lo **más valioso a construir**: una **fuente única de datos** (un solo sitio de donde beben todos). Es barato (conectar tubos, no reescribir) y arregla medio producto de golpe. Encima de eso: TPV 100% real, coste de personal real, calculadora de gastos con IVA, y los dos asks-estrella nuevos (fichaje QR y Radar IA).

> **Metáfora:** tienes un restaurante precioso y bien cimentado, pero cada empleado lleva su propia libreta de cuentas y ninguna cuadra con la otra. No hay que rehacer el local — hay que poner **una sola caja registradora central** de la que todos lean.

---

## 2 · TABLA POR SECCIÓN

| Sección | Funcional | Diseño | Lo + urgente |
|---|---|---|---|
| **TPV** | parcial | canon ✅ | Comanda no llega al KDS + importe de mesa inventado + caja solo en local |
| **Caja diaria** | parcial | canon ✅ | Cuadre/arqueo real + subir a Supabase (hoy solo localStorage) |
| **Salón** | funcional | canon ✅ | `saveSalonDB` no transaccional puede dejar el local SIN mesas |
| **Carta (Platos)** | parcial | canon ✅ | Persistir ediciones (hoy se pierden al recargar) |
| **Empleados** | parcial | canon ✅ | Fuente única de plantilla (hoy 3 listas que no se conocen) |
| **Horarios** | parcial | parcial 🟡 | Coste/hora real desde salario (hoy 10 €/h plano) |
| **Coste personal** | maqueta | sin-tocar 🔴 | Calcular coste real = horas × salario (ask de Juan, 0% hoy) |
| **Gastos fijos** | parcial | parcial 🟡 | IVA real (hoy es un texto) + ser fuente única de Resumen |
| **Resumen** | maqueta | parcial 🟡 | P&L se contradice solo (héroe 30.556 € vs P&L 48.250 €) |
| **Resumen mensual** | maqueta | sin-tocar 🔴 | 117 líneas hardcodeadas que ni cuadran entre sí |
| **Ventas (calendario)** | parcial | parcial 🟡 | Leer ventas reales (hoy `Math.sin`) + hero + color por método |
| **Ventas TPV (libro)** | maqueta | canon ✅ | Leer la tabla `ventas` real (el TPV ya escribe, nadie lee) |
| **Mapa de rivales** | parcial | canon ✅ | Local "TU" hardcodeado = bloquea multi-tenant + Radar IA falso |
| **KDS** | maqueta | canon ✅ | Leer comandas reales del TPV + realtime (hoy inventa con timer) |
| **Food cost** | maqueta | parcial 🟡 | Usar la carta real + escandallo real (hoy platos que no existen) |
| **Compras** | maqueta | sin-tocar 🔴 | Formulario de alta + persistencia (hoy 100% estático) |
| **Almacén / Stock** | maqueta | canon ✅ | Cantidades reales + descuento al cobrar (hoy drenaje cosmético) |
| **Pedidos (delivery)** | maqueta | parcial 🟡 | Ingesta real vía agregador (Ordatic/Deliverect) + webhook HMAC |

> Leyenda — **Funcional:** funcional / parcial / maqueta · **Diseño:** canon / parcial / sin-tocar.

---

## 3 · TOP 10 PRIORIDADES (impacto descendente)

1. **🔧 Fuente única de datos + un solo "hoy".** Una capa `lib/store` (Empleados, Gastos, Inventario, Ventas) de la que todo derive. Es el cuello de botella de medio producto: sin esto, cada sección que toques vuelve a inventar su número.
2. **🔧 TPV 100% funcional.** Cerrar los 3 cortes: Comanda→KDS, cobro de mesa con importe REAL (hoy es un hash del id de mesa), y caja a Supabase. Es el corazón del producto y tu ask nº1.
3. **🔧+🆕 Coste de personal real.** Un roster único × horas reales (Horarios) × salario real. Tu ask "más barato" de cerrar una vez exista la fuente única.
4. **🔒 Portero al proxy `/api/places`.** Origin-check + rate-limit (barato y protege tu cartera de Google AHORA, antes de cualquier tráfico externo). Además: restringir la key de Google y el token de Mapbox por dominio.
5. **🔧+🆕 Gastos fijos: IVA real + fuente única.** La calculadora que pediste (base/cuota 4-10-21%, prorrateo por días reales) y que alimenta Resumen y Coste.
6. **🔧 Análisis conectado a `ventas` reales.** Que lo que cobras aparezca en el libro (Ventas TPV), en Resumen (P&L real) y en Mensual. Hoy son islas que se contradicen.
7. **🆕 Fichaje QR.** Tabla `fichajes` + token diario firmado (HMAC server-side) + Edge Function. Viable, alto valor, idea tuya. Depende de Fase 0 Supabase.
8. **🆕 Mapa: quitar local hardcodeado + Radar IA real.** El local fijo BLOQUEA vender a otro restaurante; el Radar de hoy no es IA. Construir Edge Function → Claude (resumen/sentimiento/alertas).
9. **🔒+🔧 Caja y cobro como fuente de verdad server-side.** Hoy el PIN, la secuencia de tickets y el total del día viven en localStorage sin firma (manipulables con DevTools). En Fase 0: validar PIN/rol server-side y registrar el cobro en Supabase.
10. **🎨 Subir las 5 secciones planas al canon.** Resumen, Resumen mensual, Gastos, Ventas y Coste personal con la MISMA receta (hero + StatRow + BarChart + tabla premium + recompensa). Quick-win urgente: quitar la animación `infinite` de Gastos (prohibida, calienta el móvil).

> **Patrón:** las prioridades 1, 2, 3, 5, 6 son **conectar tubos** (barato, alto impacto). La 7 y la 8 son **construcción nueva** (más caras, pero son tus asks-estrella). Empezar por el cimiento (1) multiplica el valor de todo lo demás. La 4 es lo único que urge **hoy** por seguridad.

---

## 4 · FUNCIONALIDAD

**Diagnóstico de fondo:** la infraestructura existe y es sólida. Lo que falla es que **muchas secciones leen mocks locales en vez de la base de datos donde el TPV ya escribe**, y hay **3 plantillas de empleados que no se conocen entre sí**. La mayoría del trabajo es **conectar tubos**, no reescribir. Dos excepciones son construcción de cero: **fichaje QR** y **Radar IA / redes / noticias** del Mapa.

- 🔧 **ARREGLAR LÓGICA ROTA** — ya existe el código, pero miente o no conecta.
- 🆕 **FEATURE NUEVA DEL PLAN** — no existe, hay que construirla.

### 0 · CIMIENTO COMPARTIDO (antes que casi todo)

Una sola pieza desbloquea media app. Sin esto, todo lo de abajo se vuelve a copiar a mano.

| # | Acción | Tipo | Impacto |
|---|---|---|---|
| 0.1 | **Capa `lib/store` con fuentes únicas:** `EMPLEADOS`, `GASTOS`, `INVENTARIO`, `VENTAS`. Todo lo demás (Coste, Resumen, Mensual, FoodCost) **deriva** por `useMemo`, igual que ya hace bien `wallet.ts`. | 🔧 | **ALTA** |
| 0.2 | **Unificar "hoy":** hoy hay DOS (`HOY`=21-jun demo vs `new Date()`=real en wallet/caja). Un solo helper. Bug de coherencia que rompe Caja vs calendario. | 🔧 | **ALTA** |
| 0.3 | **Que el TPV escriba a la fuente `VENTAS` compartida** (además del insert Supabase) para que Ventas TPV y calendario la lean. Cerrar el círculo del cobro. | 🔧 | **ALTA** |

> **Por qué primero:** el dato "12.400 € de personal" está clavado a mano en 4 sitios; "gastos fijos" tiene 3 cifras distintas. Mientras no exista una fuente única, cada sección que toques vuelve a inventar su número.

### 1 · TPV — los 3 asks críticos ("¿es 100% funcional?")

**Veredicto: NO es 100%.** Vende, cobra y registra venta de verdad, pero la cadena tiene 3 cortes:

| # | Gap | Tipo | Severidad |
|---|---|---|---|
| 1.1 | **La Comanda no llega al KDS.** El TPV inserta en `comandas` (`persistComanda`) pero el KDS lee un mock con timer → cocina nunca recibe el pedido. | 🔧 | **ALTA** |
| 1.2 | **Cobro de mesa con importe inventado.** Al cobrar una mesa, el importe es `cobroAmount()` = hash del id de la mesa (`salon.ts:26`), no el ticket real. (El ticket del carrito sí usa el total real.) | 🔧 | **ALTA** |
| 1.3 | **Caja/cartera solo en localStorage.** No sube a Supabase → se pierde entre dispositivos y no es auditable. | 🔧 | **ALTA** |
| 1.4 | **Método de pago hardcodeado a 'tarjeta'.** No hay efectivo/tarjeta/split ni calculadora de cambio. El modelo BD ya admite los 3 métodos. | 🆕 | **ALTA** |
| 1.5 | **Cobrar/comanda NO exige caja abierta** (el badge es decorativo). | 🔧 | **ALTA** |
| 1.6 | **Persistencia fire-and-forget:** si Supabase falla, la venta se pierde en silencio (try/catch vacío). Falta cola/outbox + reintento. | 🔧 | **ALTA** |
| 1.7 | Mesa no se libera/ocupa en el Salón al cobrar el ticket (solo el flujo de moneditas lo hace). | 🔧 | media |
| 1.8 | IVA fijo 10% — ignora `p.iva` por producto que ya existe en el modelo. | 🔧 | media |
| 1.9 | Numerar el ticket **al emitir**, no al elegir destino (hoy quema números si no se vende). | 🔧 | baja |

> Diseño del TPV: **ya es canon, no tocar.** Solo micro-craft al añadir el selector de pago (badge tono + calculadora de cambio reusando el lenguaje de CierreReward).

### 2 · EMPLEADOS — fichaje QR + coste real

La cadena Empleados → Horarios → Coste está **totalmente rota: 3 plantillas distintas** que no se conocen.

| # | Acción | Tipo | Severidad |
|---|---|---|---|
| 2.1 | **Fuente única de plantilla** (`lib/empleados.ts` / store 0.1): un solo roster con salario por persona que alimente Empleados + Horarios + Coste. **Prerrequisito de todo lo demás aquí.** | 🔧 | **ALTA** |
| 2.2 | **Coste de personal REAL = horas (Horarios) × coste/hora (derivado del salario de Empleados).** Hoy Horarios usa 10 €/h plano y Coste es una tabla estática. Es el ask de Juan, hoy 0% cubierto. | 🔧+🆕 | **ALTA** |
| 2.3 | **FICHAJE QR (idea de Juan): no existe nada.** Construir de cero (ver detalle abajo). | 🆕 | **ALTA** |
| 2.4 | KPIs de cabecera derivados en vivo (nº, suma de coste, salario medio) con count-up — hoy son strings literales que no se mueven al editar. | 🔧 | media |
| 2.5 | Coste de empresa que se recalcula al editar el sueldo (hoy `coste` y `liquido` quedan incoherentes para siempre). | 🔧 | media |
| 2.6 | Persistencia de la plantilla (sueldos/IBAN/SS son PII → Supabase con RLS, **nunca** localStorage). Alta/baja de empleados. | 🆕 | media |

**Fichaje QR — viabilidad y qué falta:** es **viable y la idea es buena**. Hoy 0% construido. Hay que construir:

1. **Tabla `fichajes`** (Supabase): `id, local_id, empleado_id, tipo(entrada/salida), ts`, con RLS por `local_id`.
2. **Token QR diario firmado** que genera el TPV: válido **solo ese día** (HMAC tiempo-constante con secret server-side + fecha). Fail-closed.
3. **Edge Function `fichar`** que valida el token (rol/local de `app_metadata`), registra entrada/salida, idempotente. **El PIN/validación nunca en cliente.**
4. **Empleado escanea con su cuenta** → la Edge Function ata `auth.uid()` ↔ `empleado_id` del local.
5. **Cierre del círculo:** las horas fichadas reales alimentan Coste personal (planificado vs real).

> Depende de Fase 0 Supabase (auth + Edge Functions). Riesgo: el token debe ser server-side y de un solo día; si no, cualquiera ficha por otro.

### 3 · GASTOS FIJOS — la calculadora del ask

`Gastos.tsx` es la **única calculadora viva** del producto, pero el IVA es decorativo y no alimenta a nadie.

| # | Acción | Tipo | Severidad |
|---|---|---|---|
| 3.1 | **IVA real:** separar base imponible y cuota (4/10/21%) por concepto. Hoy el IVA es un **string** que solo se pinta. El ask pide "calculadora con IVA". | 🔧+🆕 | **ALTA** |
| 3.2 | **Exponer total de gastos como fuente única** (store 0.1) que consuman Resumen y Coste/Mensual. Hoy: 11.712 € (Resumen) ≠ 2.240 € (Mensual) ≠ 3.240 € (real). 3 cifras para lo mismo. | 🔧 | **ALTA** |
| 3.3 | **Prorrateo por días reales del mes** (28/30/31), no `/30` fijo. El patrón ya existe en `data.ts`. | 🔧 | media |
| 3.4 | Persistencia (localStorage ya, Supabase con RLS después — dato financiero del tenant). | 🆕 | media |
| 3.5 | Alta/baja de conceptos + periodicidad (mensual/trimestral/anual). Guarda contra división por cero (hoy NaN si todo a 0). | 🆕 | media |

### 4 · MAPA DE RIVALES — lo que falta del plan

**Base sólida y real:** mapa 3D, rivales reales de Google Places (proxy server-side), reseñas Google reales, comparador VS, filtrado por radio real. Falta la **capa server-side cara** (construcción nueva).

| # | Acción | Tipo | Severidad |
|---|---|---|---|
| 4.1 | **Local "TU" hardcodeado** a Homeburger Bertamiráns → todo tenant vería ese local. **Bloqueante multi-tenant** para vender el SaaS. | 🔧 | **ALTA** |
| 4.2 | **Radar IA: no existe IA real.** El "Radar" actual es scoring determinista local. Construir Edge Function → Claude (resumen + sentimiento + alertas por rival), con aviso de coste y rate-limit. | 🆕 | **ALTA** |
| 4.3 | **Monitor de redes (IG/TikTok/FB)** server-side cacheado en Supabase + cron. Hoy las "señales sociales" son strings hardcodeados. | 🆕 | media |
| 4.4 | **Monitor de noticias** (News API) por rival/zona. Ausente. | 🆕 | media |
| 4.5 | **Ficha de rival completa:** horario, teléfono, web, fotos, enlace a Maps. Hoy el `fieldMask` ni los pide. Reusar el flip de Carta, no un modal. | 🆕 | media |
| 4.6 | **Reseñas reales de Glovo/Uber/Just Eat:** hoy inventadas deterministas. APIs cerradas → vía agregador o scraping legal. Mientras: **etiquetar fuente por reseña** (●Google real vs ○muestra). | 🔧+🆕 | media |
| 4.7 | Persistencia / "seguir a un rival": historial de rating, alertas que sobreviven a la recarga. Hoy todo efímero. | 🆕 | media |
| 4.8 | **Seguridad operativa:** token Mapbox restringido por dominio + rate-limit en `/api/places`. | 🔧 | media |

### 5 · ANÁLISIS — conectar a `ventas` reales

El TPV escribe a `ventas` en Supabase, pero **ningún panel de análisis lo lee** → lo que cobras no aparece en los informes.

| # | Acción | Tipo | Severidad |
|---|---|---|---|
| 5.1 | **Ventas TPV (libro): leer de `ventas` real** (vía RLS), no del array mock. El TPV ya alimenta esa tabla; nadie la lee. | 🔧 | **ALTA** |
| 5.2 | **Resumen: cuenta de resultados REAL** = ventas − food cost − personal − gastos fijos. Hoy todo hardcodeado y **se contradice en la misma pantalla** (héroe 30.556 € vs P&L 48.250 €). | 🔧 | **ALTA** |
| 5.3 | **Resumen mensual: calcular histórico** desde `salesForMonth`/`salesForYear` (ya existen, Ventas las usa, Mensual no). Cruzar con Compras/Gastos/Coste. Hoy 117 líneas hardcodeadas. | 🔧 | **ALTA** |
| 5.4 | **Ventas (calendario): leer de `ventas`** con fallback a mock, en vez de `Math.sin`. Coherencia de "hoy" con Caja. | 🔧 | media |
| 5.5 | El **selector de fecha de Resumen debe recalcular TODO** (P&L, KPIs, margen), no solo el héroe y 2 gráficas. Comparativa vs periodo anterior real (no el +9,0% fijo). | 🔧 | media |
| 5.6 | Buscador en Ventas TPV (el nav lo promete y no existe) + filtro por método/tipo de doc. | 🆕 | media |
| 5.7 | **Caja: cuadre/arqueo REAL** (efectivo contado vs esperado), libro de cierres persistido, eliminar el toggle "Simular descuadre". | 🔧+🆕 | media |
| 5.8 | Persistir base/IVA/líneas en el cobro para que el libro sea fiscalmente reconstruible. Anulación/rectificación en vez de borrado. | 🆕 | media |

### 6 · CADENA DE PRODUCTO (Carta / Food cost / Compras / Almacén / KDS / Pedidos)

| # | Acción | Tipo | Severidad |
|---|---|---|---|
| 6.1 | **KDS: leer las `comandas` reales del TPV** + realtime (channel por `local_id`) + persistir avance de estado. Hoy inventa comandas con timer. (Misma raíz que 1.1.) | 🔧+🆕 | **ALTA** |
| 6.2 | **Food cost: usar `products.ts` como fuente** (hoy lista paralela con platos que NO existen en la carta) + escandallo real (ingredientes × coste de inventario). | 🔧+🆕 | media |
| 6.3 | **Carta: persistir ediciones** (hoy se pierden al recargar) y ser fuente única real compartida con TPV. Activar IVA y mods editables. | 🔧 | media |
| 6.4 | **Almacén/Stock: modelo de cantidad/capacidad real** (hoy el drenaje es cosmético) + descuento al cobrar (escandallo) + persistencia. | 🔧+🆕 | media |
| 6.5 | **Compras: formulario de alta** (proveedor/base/IVA/fecha) + persistencia + alimentar Food cost/Resumen. Hoy 100% estático. | 🆕 | media |
| 6.6 | **Pedidos (delivery): ingesta real vía agregador** (Ordatic/Deliverect): Edge Function + webhook HMAC fail-closed + idempotencia. Cola viva + persistencia. | 🆕 | media |

---

## 5 · SEGURIDAD

**Veredicto global:** base **sólida y bien diseñada**. Las reglas de oro se cumplen (autorización en `app_metadata`, service_role fuera del cliente, RLS default-deny, CSP estricta en scripts, proxy de pago server-side). **No hay ningún agujero CRÍTICO abierto hoy en el código.** Los hallazgos son **operativos / deuda pre-lanzamiento**.

> **Aviso de contexto:** la persistencia hoy es casi toda `localStorage` (sin backend real; Supabase Fase 0 pendiente). Por eso muchos riesgos son **futuros** (al conectar el backend), no explotables ahora.

### 🔴 CRÍTICA
*Nada en el código actual.* No hay secretos filtrados, ni service_role en cliente, ni XSS explotable, ni RLS que permita cruzar tenants en las tablas de negocio (`ventas`/`comandas`). **La cimentación está bien puesta.**

### 🟠 ALTA — (deuda pre-lanzamiento; cerrar antes de exponer al exterior / Fase 0)

**A1 · Proxy `/api/places` sin rate-limit ni validación de origen → te queman la cuota de Google (€).**
`functions/api/places.js:43`. El endpoint es **público y anónimo**. Hace bien casi todo (valida lat/lng, key server-side, timeout 8s, cache edge), **pero** no comprueba `Origin`/`Referer` ni limita por IP. Un bucle externo variando coords salta la cache y dispara `searchNearby` contra **el billing de Juan**. **FIX:** (1) rechazar si `Origin` no es tu dominio — fail-closed; (2) rate-limit por IP con Cloudflare KV; (3) restringir la API key de Google por referrer/IP. *Metáfora: hoy el mostrador atiende a quien sea las veces que quiera; pones portero + límite de pedidos por persona.*

**A2 · PIN del gerente validado solo en el cliente.**
`src/lib/caja.ts:10` + `src/sections/Tpv.tsx:256`. El PIN (`'1234'`) viaja en el bundle y se compara en el navegador. Es el único gate para abrir/cerrar caja. Bypass trivial con DevTools. **Demo aceptable HOY** (está comentado como tal). **NO puede ir a producción así.** **FIX (Fase 0):** validar PIN/rol server-side (Edge Function) que firme un *token de turno*; el cliente nunca conoce el PIN.

**A3 · Estado de caja / secuencia de tickets / total del día solo en `localStorage` (manipulable, no auditable).**
`src/lib/caja.ts:20-48`, `src/lib/wallet.ts:24-84`. Sin firma. Un usuario puede editar las claves de localStorage y **falsear ventas, abrir caja sin PIN o resetear el contador**. Es facturación del local en claro. **FIX (Fase 0):** la verdad (cierre, total, secuencia) vive en Supabase con RLS + Edge Function; localStorage solo caché.

### 🟡 MEDIA — (cerrar en Fase 0, antes de clientes reales)

**M1 · `design_comments`: RLS abierta a TODO `authenticated`, sin scoping por local.**
`0003_secure_design_comments.sql:23-30`. 0003 ya cerró el agujero crítico (quitó `anon`). Pero las 4 políticas usan `using(true)/with check(true)` → cualquier logueado lee/edita/borra TODAS las notas. Rompe el aislamiento multi-tenant. **Atenuante:** tabla interna sin PII. **FIX:** solo `service_role`, o scoping `local = jwt_local_id()`.

**M2 · Cobro / importes calculados en cliente y aceptados sin validar server-side.**
`src/lib/salon.ts:26-30` (`cobroAmount` = hash inventado), `Tpv.tsx:28` (`metodo:'tarjeta'` hardcodeado). El importe que entra en caja se calcula 100% en cliente (en Salón, literalmente un hash del id de mesa). **FIX (Fase 0):** el cobro se registra server-side; el total se deriva de las líneas reales vía Edge Function / RLS.

**M3 · Token de Mapbox sin restringir por dominio (verificación operativa).**
`MapaIncidencia.tsx:91`. El `pk.…` es público por diseño, **solo si** está restringido por URL en el panel de Mapbox. **FIX:** acción operativa (no código) → restringirlo. *Necesito que Juan confirme si ya está hecho; no lo puedo ver desde el repo.*

**M4 · `saveSalonDB` no transaccional: `delete` antes de `insert` puede dejar el local SIN mesas.**
`src/lib/salon.ts:143-161`. Si el insert falla, el plano queda vacío en BD. **Agravante:** el CHECK de `forma` solo admite `cuadrada/rect/redonda` → guardar una mesa en forma `'ele'` **garantiza** el fallo → **pérdida total del plano del tenant**. **FIX:** `upsert onConflict` o RPC transaccional + ampliar el CHECK con `'ele'` + columnas que hoy se pierden (`rot`, `estado`, `since`, `reservaFin`).

**M5 · Acciones de gestión sin gate de rol (intra-tenant).**
`Salon.tsx:625` (editar plano), `:355-359` (borrar mesa). No comprueba `app_metadata.role`; la RLS de `mesas` scopa por `local_id` pero **sin `jwt_rol()`** → cualquier usuario del local puede reescribir el plano. **Atenuante:** riesgo intra-tenant. **FIX (Fase 0):** guard de rol gerente en cliente **y** en RLS.

### 🟢 BAJA — (vigilancia / al conectar backend)

| # | Archivo | Hallazgo | Acción |
|---|---------|----------|--------|
| B1 | `places.js:116-122` + `places.ts:35-51` | PII de terceros (autores de reseñas Google) cacheada en localStorage 12h sin cifrar | Consentimiento/retención cuando pase a Supabase |
| B2 | `Pedidos.tsx:48-57` | PII de clientes **demo** hardcodeada en el bundle | Datos falsos o backend protegido antes de conectar nada real |
| B3 | `VentasTpv.tsx:83-98`, `Ventas.tsx:90` | **CSV injection** latente: no neutraliza celdas que empiezan por `= + - @` | Inofensivo hoy (celdas numéricas). Prefijar `'` antes de meter texto de usuario |
| B4 | `public/_headers` | CSP: `script-src 'self'` sólido. Matiz: `style-src` sí lleva `'unsafe-inline'` (común, bajo riesgo) | Al añadir Stripe/agregador: no relajar `script-src`, solo añadir el dominio concreto |
| B5 | `Almacen.tsx:152`, `Platos.tsx` | Inputs de texto sin límite/saneo | No-XSS hoy (React escapa); validar/limitar al persistir |

### ✅ Lo que está BIEN (NO tocar — verificado)

- **Secretos:** `.gitignore` cubre todos los `.env*`/tokens; **ninguno trackeado ni en la historia de git**.
- **service_role:** no aparece en cliente — solo en comentarios que advierten de no ponerla ahí. La única key de cliente es la `anon`.
- **RLS `0001_init.sql`:** default-deny, lee rol/local de `app_metadata` vía `auth.jwt()`, helpers con `set search_path = ''`, `ventas`/`comandas` con `with check(local_id = jwt_local_id())` → imposible insertar en otro local. Modélica.
- **XSS:** los 4 `innerHTML` dinámicos son seguros (strings estáticos o números formateados con `.toFixed()`); el único dato de terceros pasa por `escapeHTML`.
- **CSP de scripts estricta** + `frame-ancestors 'none'` + HSTS. **Login:** la contraseña demo se precarga solo en `import.meta.env.DEV` → no se filtra al bundle de prod.

### 🎯 Orden de acción de seguridad
1. **Antes de CUALQUIER tráfico externo (barato):** A1 (Origin-check + rate-limit `/api/places`) + M3 (token Mapbox) + restringir key Google por dominio.
2. **Fase 0 (auth real):** A2 (PIN server-side) → A3 (caja/ventas en Supabase) → M1 (scoping `design_comments`) → M2 (cobro validado server-side) → M5 (gate de rol en RLS).
3. **Robustez:** M4 (upsert transaccional + CHECK `'ele'`).
4. **Limpieza:** B1-B5.

> **Resumen en una frase:** la casa está bien construida; falta **echar el cerrojo a las puertas que aún no dan a la calle** (PIN y cobro server-side, scoping multi-tenant) y **poner portero al único mostrador ya abierto al exterior** (el proxy de Places).

---

## 6 · DISEÑO

### Estado de cada sección

| Sección | Estado | Veredicto |
|---|---|---|
| Carta, Empleados, Salón, Caja, TPV, Mapa, Ventas TPV, Almacén | **canon** ✅ | Secciones ancla. No tocar (su problema, si lo hay, es de DATOS, no estético). |
| Pedidos | **parcial** 🟡 | Componentes canónicos, pero falta cifra-héroe, vida y recompensa. |
| Food cost | **parcial** 🟡 | Componentes canónicos pero "dashboard plano", sin héroe ni escandallo. |
| Gastos fijos | **parcial** 🟡 | CSS bespoke + animación `infinite` PROHIBIDA. Migrar a ui.tsx. |
| Ventas (calendario) | **parcial** 🟡 | Falta hero, BarChart, color por método, motion de entrada. |
| Horarios | **parcial** 🟡 | Buena base, falta héroe + recompensa. |
| Resumen | **parcial** 🟡 | Hero bespoke, P&L triplicado, BarChart de juguete (existe SalesChart). |
| Compras | **sin-tocar** 🔴 | Dashboard de plantilla. Cero léxico REBELL. |
| Resumen mensual | **sin-tocar** 🔴 | Tabla estática plana. Sin hero, sin motion. |
| Coste personal | **sin-tocar** 🔴 | 100% estática. Sin hero, sin interactividad. |

> De **las 6 que pediste explícitamente** (Resumen, Resumen mensual, Gastos, Ventas, Ventas TPV, Coste personal): **Ventas TPV YA es canon** (el brief se equivocaba); las otras 5 tienen plan abajo.

### La receta canónica común (el "molde")

Todas se suben con la **MISMA receta** — no hay que inventar nada por sección:

1. **CIFRA-HÉROE** arriba: número gigante tabular con `<CountValue>` (count-up 0→valor) + barrido de luz al entrar.
2. **`<StatRow>` al lado:** 3-5 `<Stat>` en líneas finas separadas por el hairline dorado — NUNCA pastillas sueltas.
3. **Mini `<BarChart>`** de serie temporal con la barra de HOY en `.hot`.
4. **Tabla/lista premium:** `<DataTable>` + hover spotlight + números `.tnum` + stagger 55ms + color por entidad.
5. **Detalle = drawer/flip glass** (inspector del Salón / cara trasera de Carta), NUNCA modal genérico.
6. **Recompensa one-shot** (check dorado spring + sonido + count-up) en la acción clave. Nunca `alert`.
7. **Léxico de instrumento:** kicker uppercase oro + corner-ticks.

> Reglas duras: solo `transform`/`opacity`; ease-out en entradas; press `scale(.97)`; decorativo **one-shot, jamás `infinite`**; sombras neutras (nunca halo dorado sobre negro); `prefers-reduced-motion`; todo desde tokens.

### Plan por sección (priorizado por impacto visual)

**🥇 PRIORIDAD 1 — Resumen** (la cara del producto, el puesto de mando):
1. Matar el P&L triplicado → **1 gráfico estrella tipo WATERFALL/cascada**: facturación en oro, cada coste restando con su barra + %, y el **Neto destacado abajo en oro con count-up**.
2. Migrar el hero bespoke `.rs-hero` → `<Stat>`/`<StatRow>` con hairline dorado.
3. **Sustituir el `<BarChart>` de juguete por `SalesChart.tsx`** (¡ya existe! gratis).
4. Shine al hero + delta con spring.
5. Kicker + corner-ticks + stagger 55ms.

**🥈 PRIORIDAD 2 — Gastos fijos** (quick-win + viola una regla dura):
1. **ELIMINAR la animación `infinite`** `.gx-pie::after` → one-shot. (Calienta el móvil.)
2. Tirar el CSS bespoke `gx-*` → `<KpiTile>` + `<BarRow>` de ui.tsx (~30 líneas menos).
3. Total = cifra-héroe con `<CountValue>` + shine.
4. Conceptos en líneas con hairline dorado + hover spotlight + press `scale(.97)`.
5. Recompensa one-shot al editar/añadir un gasto.

**🥉 PRIORIDAD 3 — Ventas (calendario):**
1. **HERO de facturación del año** GIGANTE + count-up + shine, con StatRow al lado.
2. Mini `<BarChart>` de los 12 meses con la barra del mes actual `.hot`.
3. **Heat por MÉTODO en el punto del día:** efectivo verde / tarjeta azul / domicilio = color (no solo opacidad). El calendario "habla".
4. Motion de entrada: pop escalonado `scale(.95→1)` + stagger.
5. Día clicable → drawer/flip de detalle con sus tickets reales.
6. Recompensa one-shot al exportar.

**Coste personal** (sin-tocar → canon): cifra-héroe del coste del periodo + `<StatRow>` + toggle día/semana/mes (reusar el segmented de Empleados) + tabla por empleado con badge de rol + BarChart con barra del periodo vivo + Donuts con valores **derivados** (no fijos) + recompensa si el % s/ventas baja del 28%.

**Resumen mensual** (sin-tocar → canon): cabecera-hero con cifra gigante (margen/ventas YTD) + tabla P&L premium con margen por fila en **color semántico real** (verde sube / ámbar cae) + fila TOTAL/MEDIA + comparativa mes a mes como mini `<BarChart>` vivo + selector de año.

**Compras** (sin-tocar → el más "de plantilla"): cabecera-héroe "Compras del mes" + mini `<BarChart>` por día + libro de albaranes premium (`<DataTable>` + proveedor con `--accent`) + detalle de factura = drawer glass + Donut por proveedor semántico (verde=pagado/ámbar=pendiente).

### Notas clave (lo mínimo)
- **5 secciones a tocar** de verdad (6 con Compras). Ventas TPV ya estaba bien.
- **Patrón único** → barato y coherente, no hay que inventar nada por sección.
- **Quick-win inmediato:** la animación `infinite` de Gastos está PROHIBIDA → arreglar ya.
- **Gratis:** Resumen puede usar `SalesChart.tsx` que YA existe.
- **Aviso honesto:** el diseño sube el "wow", pero **el dato sigue siendo falso debajo**. El plan visual y el funcional (Supabase Fase 0) **van de la mano**: una cifra-héroe preciosa con un número inventado sigue siendo mentira. Recomiendo tocar diseño y datos de cada sección en la misma pasada.

---

## 💡 Ideas locas

- **"Modo cierre cinematográfico":** al cerrar el día, Resumen reproduce un recap animado (count-ups encadenados ventas→costes→neto) con el rugido de león, como el resumen post-partida de FIFA.
- **Tema "ascenso de nivel":** cuando el neto supera el objetivo, el waterfall del P&L se vuelve dorado y dispara confeti contenido — gamificar la rentabilidad.
- **"Caja a prueba de balas":** el PIN no abre nada en cliente — el navegador solo manda el intento a una Edge Function que firma un token de turno (HMAC, caduca al cierre). Auditoría de caja imposible de falsear.
- **Centinela anti-abuso:** un cron lee los logs de `/api/places`, detecta picos raros y manda push *"alguien está sondeando tu mapa"* — seguridad que se *ve* como feature.

---

📁 **Archivos clave (rutas absolutas):**
- Canon de diseño: `/Users/juanb./Desktop/VARIOS/APPS CLAUDE/NUEVO REBELL/rebell-app/DESIGN-CANON.md`
- Componentes UI: `/Users/juanb./Desktop/VARIOS/APPS CLAUDE/NUEVO REBELL/rebell-app/src/components/ui.tsx`
- Gráfico premium ya existente: `/Users/juanb./Desktop/VARIOS/APPS CLAUDE/NUEVO REBELL/rebell-app/src/components/SalesChart.tsx`
- Proxy de pago: `/Users/juanb./Desktop/VARIOS/APPS CLAUDE/NUEVO REBELL/rebell-app/functions/api/places.js`
- Caja / Wallet: `/Users/juanb./Desktop/VARIOS/APPS CLAUDE/NUEVO REBELL/rebell-app/src/lib/caja.ts` · `.../src/lib/wallet.ts`
- Salón: `/Users/juanb./Desktop/VARIOS/APPS CLAUDE/NUEVO REBELL/rebell-app/src/lib/salon.ts`
- RLS: `/Users/juanb./Desktop/VARIOS/APPS CLAUDE/NUEVO REBELL/rebell-app/supabase/migrations/0001_init.sql` · `.../0003_secure_design_comments.sql`
