# Auditoría de Arquitectura — FAT SMASH (28-jun)

> Comité de 37 agentes · 54 hallazgos en 8 dimensiones · verificación adversarial.

## Veredicto (sin azúcar)
Honesto, sin azúcar: un ingeniero top de Google/Apple/Anthropic NO se reiría del talento (el diseño es premium de verdad, los tipos son impecables —cero `any`, cero `@ts-ignore`—, la base de seguridad de Supabase está por encima de la media: RLS por local_id desde el JWT, secretos peligrosos FUERA del bundle, proxy server-side para Google Places). Pero SÍ se alarmaría al abrir la pestaña Application del navegador, porque hoy FAT SMASH no es un SaaS multi-tenant de producción: es una demo premium con tres heridas que sangran si la abres al público. Primero, los datos del negocio que el dueño VE (facturación, food cost, calendario) son INVENTADOS con `Math.sin()` en `data.ts` —ninguna sección lee de Supabase—, así que miles de negocios verían las mismas cifras falsas. Segundo, esos datos se cachean en localStorage con claves GLOBALES (`rebell-ventas-v1`, iguales para todos) y al cambiar de local el logout solo borra el perfil: un tablet de barra compartido mezcla ventas y empleados de un negocio con otro = fuga de datos entre clientes. Tercero, el pedido online por QR inserta la venta como `metodo='tarjeta'` SIN pasarela real, así que cualquiera con el slug genera ingresos fantasma en la caja y pedidos en cocina. Súmale: cero tests en algo que custodia dinero y nóminas, un bundle único de 2,83 MB que descarga el mapa 3D para abrir la Caja, design_comments abierta a todos los negocios entre sí (`using(true)`), y que el SQL que protege las nóminas vive en un copia-pega manual fuera de las migraciones. Conclusión: orgullosos de la PIEL, avergonzados del ESQUELETO. Con 2-3 semanas de trabajo enfocado pasa de "demo bonita que se rompe" a "producto del que presumir". Hoy, tal cual, NO se puede lanzar al público con datos reales.

**Nota global de orgullo: 5/10**

## 🚨 Riesgos que bloquean el lanzamiento
1. DATOS FALSOS: las cifras que ve el dueño (facturación, food cost, ventas por día) están INVENTADAS con Math.sin() en src/lib/data.ts y NINGUNA sección lee de Supabase (grep "from('" en src/sections = 0). Lanzar así = cada negocio ve los mismos números falsos. Hay que cablear la capa de datos real a Supabase antes de cobrar a nadie.

2. FUGA DE DATOS ENTRE NEGOCIOS: las ventas/cuentas/empleados se guardan en localStorage con claves GLOBALES iguales para todos (src/lib/ventas.ts:32 'rebell-ventas-v1') y el logout (SettingsPanel.tsx:338) solo borra 'rebell-profile'. Un tablet de barra compartido enseña al siguiente negocio los datos del anterior. Borrar TODAS las claves rebell-* en logout + prefijar por local_id.

3. COBRO FALSO EN PEDIDO ONLINE: crear_pedido_online (apply.sql) inserta la venta con metodo='tarjeta' SIN pasarela (la propia función avisa '⚠️ DEMO: el pago es simulado'). Cualquiera con el slug del local mete pedidos fantasma en cocina y caja. La venta solo debe insertarse desde un webhook de pago firmado (Stripe/MONEI).

4. RLS DE NÓMINAS FUERA DE LAS MIGRACIONES: las tablas más sensibles (empleados con líquido/nóminas, gastos, compras, accesos con IP) y su RLS solo existen en supabase/apply.sql ('pega en SQL Editor → Run'). Las migraciones versionadas solo cubren 5 tablas. Si no se aplicó (o se aplicó a medias) en prod, esas tablas podrían quedar SIN RLS y leerse con la anon key pública. Mover a migraciones + test de RLS en CI + verificar HOY en el dashboard que todas tienen RLS enabled.

5. design_comments ABIERTA A TODOS: tras 0003 las policies son 'using(true)' para authenticated (0003_secure_design_comments.sql:25-30). Cualquier negocio logueado lee, edita y BORRA las notas y capturas de pantalla de TODOS los demás. Scopear por local_id como ventas/comandas.

6. SIN ERROR BOUNDARY: un fallo en una sección tumba TODA la app a pantalla en blanco (grep ErrorBoundary = 0). En un TPV que cobra en hora punta, un crash total deja al camarero sin poder cobrar. Envolver renderSection en un <ErrorBoundary>.

7. CONTRASEÑA COMÚN HARDCODEADA: setup-admin.mjs:12 usa 'Rebell2026!' para los 4 usuarios incluido el rol 'central' que ve TODOS los locales, con email predecible. Generar password aleatoria por usuario y forzar cambio.

8. TOTALES DE DINERO MAL CON HISTÓRICO: los totales del mes se calculan en el navegador sobre máximo .limit(400) ventas (ventas.ts:77) y compras/empleados/gastos se traen ENTEROS sin límite. Pasadas ~2 semanas el 'total del mes' deja de cuadrar (solo suma las últimas 400). Agregar en SQL (GROUP BY) + paginación keyset.

---

# Auditoría FAT SMASH — Informe del Comité (Arquitecto Principal)

## Resumen ejecutivo (para Juan, en simple)

Imagina un coche con una **carrocería de Ferrari** (el diseño, que está genuinamente bien hecho) montada sobre un **chasis de prototipo de feria** (cómo guarda y protege los datos). Por fuera es un "wow". Por dentro, hoy, **no está listo para llevar pasajeros de verdad**.

Lo BUENO (y es mucho, conste): el diseño premium es real, el código TypeScript es de los más limpios que se ven (cero atajos sucios), y —lo que más te preocupaba— con "inspeccionar elemento" **NO se ven las llaves maestras**: la clave secreta del servidor, la de Google y la contraseña NO están en el navegador. Eso es buen criterio.

Lo MALO (y es grave para lanzar): **tres heridas** que sangran si abres la app al público.

1. **Los números que ves son inventados.** La facturación, el food cost y el calendario de ventas se generan con una fórmula matemática (`Math.sin`), no salen de tu base de datos. Verificado: ninguna pantalla lee de Supabase. Si lanzas a miles de negocios, **todos ven las mismas cifras falsas**.
2. **Los datos se mezclan entre negocios.** Se guardan en el navegador con una etiqueta común para todos. Al "cambiar de local", solo se borra tu nombre, no los datos. Un tablet de barra compartido **le enseña al siguiente negocio las ventas y empleados del anterior**.
3. **El pedido online cobra de mentira.** Mete la venta como "pagada con tarjeta" sin que haya pasarela. Cualquiera con el enlace de tu local **te llena la cocina y la caja de pedidos fantasma**.

Veredicto en una frase: **orgullosos de la piel, avergonzados del esqueleto.** Arreglable en 2-3 semanas. Hoy, no se lanza.

**Nota global de orgullo: 5/10** (diseño y tipos de 8; datos, robustez y multi-tenant de 3-4).

---

## Estado por dimensión

| Dimensión | Nota | Estado en una línea |
|---|---|---|
| Arquitectura Frontend | 4/10 | Bonita y ordenada, pero la fuente de datos es localStorage global (de prototipo, no de SaaS). |
| Tamaño de bundle y build | 4/10 | Un solo archivo de 2,83 MB; el mapa 3D (62% del peso) carga aunque abras la Caja. |
| Rendimiento en ejecución | 5/10 | Premium bien hecho, pero relojes de 1s repintan secciones enteras y el Mapa recalcula sin parar. |
| Backend / Supabase | 6/10 | Seguridad de base SÓLIDA, pero el SQL de las nóminas vive fuera de las migraciones + pago simulado. |
| Escalabilidad de datos | 5/10 | Cimientos correctos (local_id + RLS + índices), pero totales mal con histórico y selects sin límite. |
| Exposición en cliente (DevTools) | 7/10 | Lo mejor: NO hay secretos peligrosos en el navegador. Grietas: design_comments y token Mapbox. |
| Stack y dependencias | 5/10 | Moderno y sin CVEs, pero 3 librerías de mapas instaladas y solo 1 usada; bundle sin trocear. |
| Iteración y mantenibilidad | 5/10 | Tipos excelentes, pero CERO tests en algo que maneja dinero + patrón copiado a mano 14 veces. |

---

## Hallazgos por severidad (todos verificados contra el código real)

### 🔴 ALTA — bloquean el lanzamiento

| # | Hallazgo | Archivo | Impacto (en simple) | Fix |
|---|---|---|---|---|
| 1 | Las pantallas NO leen de Supabase: datos inventados | `src/lib/data.ts:16` (`VENTAS_MES = 42000`, `Math.sin` línea 45); `grep "from('"` en `src/sections` = **0** | El dueño ve cifras falsas, idénticas para todos los negocios. La estética es real; los datos no. | Capa de datos por entidad (hooks `useVentas`/`useGastos`) que lea de Supabase con RLS por local_id; mocks solo tras `isDemoMode()`. |
| 2 | Fuga de datos entre negocios vía localStorage global | `src/lib/ventas.ts:32` (`KEY='rebell-ventas-v1'`); logout en `SettingsPanel.tsx:338` solo borra `rebell-profile` | Un tablet compartido enseña ventas/empleados del negocio anterior al siguiente. | En logout borrar TODAS las claves `rebell-*`; prefijar cada clave con `local_id`; fuente de verdad = Supabase, localStorage solo caché. |
| 3 | Pedido online inserta la venta como COBRADA sin cobro | `supabase/functions/pedido/index.ts:14` ("⚠️ DEMO pago simulado"); `apply.sql` `crear_pedido_online` inserta `metodo='tarjeta'` | Cualquiera con el slug genera ingresos fantasma en caja y pedidos en cocina. | Insertar la venta SOLO desde webhook de pago firmado (Stripe/MONEI PaymentIntent, HMAC tiempo constante, fail-closed, idempotente). |
| 4 | RLS de tablas sensibles (nóminas, gastos, accesos) fuera de migraciones | `supabase/apply.sql` ("pega en SQL Editor → Run") vs `migrations/` solo 0001/0002/0003 | Si no se aplicó en prod, esas tablas podrían quedar SIN cerradura y leerse con la clave pública. | Mover todo a migraciones numeradas + `supabase db push` + test de RLS en CI (loguear como local A, leer datos de B, esperar 0 filas). |
| 5 | Sin Error Boundary: un fallo tumba toda la app | `src/components/Shell.tsx` (renderSection); `grep ErrorBoundary` = **0** | En plena hora punta, un dato nulo deja al camarero con pantalla en blanco, sin cobrar. | Envolver `renderSection(active)` en `<ErrorBoundary>` (react-error-boundary, ~3KB) con fallback premium y reintento. |
| 6 | Contraseña común hardcodeada para todos los locales | `supabase/setup-admin.mjs:12` (`PASSWORD='Rebell2026!'`) | La misma llave para los 4 usuarios, incluido el rol 'central' que ve TODOS los negocios; email predecible. | Password aleatoria por usuario, forzar cambio en 1er login, nunca clave compartida para 'central'. |
| 7 | Totales de dinero mal con histórico (suma sobre 400 filas) | `src/lib/ventas.ts:77` (`.limit(400)`), `compras.ts:79`/`equipo.ts:133`/`gastos.ts:82` traen **todo sin límite** | Pasadas ~2 semanas el "total del mes" deja de cuadrar (solo suma las últimas 400). Error de dinero invisible. | Agregaciones en SQL (`GROUP BY` día/mes/proveedor vía RPC) + paginación keyset; el navegador pinta cifras ya sumadas. |
| 8 | Bundle único de 2,83 MB; el mapa 3D carga siempre | `dist/assets/index-*.js` = **2.839.112 bytes**; `registry.tsx:13` importa `MapaIncidencia` (mapbox-gl) estático | Para abrir la Caja, el móvil del bar descarga el motor de mapas 3D entero. Varios segundos en blanco en 4G. | `React.lazy` por sección + `<Suspense>` (igual que ya se hace con /pedir) + `manualChunks` en vite para aislar mapbox/gsap/motion. |

### 🟠 MEDIA — arreglar pronto tras lanzar (o antes si da tiempo)

| # | Hallazgo | Archivo | Impacto | Fix |
|---|---|---|---|---|
| 9 | design_comments abierta a todos los negocios | `migrations/0003:25-30` (`using(true)`) | Cualquier negocio logueado lee/edita/BORRA notas y capturas de pantalla de los demás. | Migración 0004: scopear por `local_id = jwt_local_id()` o restringir a rol 'central'. |
| 10 | Edge Function 'acceso' confía en el JWT sin verificar firma en código | `functions/acceso/index.ts:31` (`JSON.parse(atob(token.split('.')[1]))`) | Si `verify_jwt` estuviera apagado (no hay config.toml versionado), se podría falsificar el local_id. | Crear `config.toml` con `verify_jwt=true`; mejor, validar con `supabase.auth.getUser(token)` dentro. |
| 11 | check_rate borra TODA la tabla rate_hits en cada llamada | `apply.sql:242` (`delete from rate_hits where ts < ...`) | El anti-spam de pedidos online se atasca y falla justo en hora punta a escala. | Contar sin borrar (where ts > ...) + limpiar con pg_cron; mejor, rate-limit en Cloudflare/Redis. |
| 12 | Edge 'pedido' 100% pública, slugs enumerables | `functions/pedido/index.ts:36` (CORS `*`, solo rate-limit por IP) | Con rotación de IPs se sondean todos los locales y se llenan cocinas de basura. | Firmar el QR de mesa con HMAC (slug+mesa) y validar; respuesta genérica; Turnstile en /pedir. |
| 13 | Relojes de 1s repintan secciones enteras | `Tpv.tsx:379`, `Salon.tsx:147` (`setInterval(...,1000)`) | El terminal de barra repinta toda la pantalla cada segundo aunque no cambie nada: calor, batería, micro-tirones. | Aislar el reloj en un `<RelojMesas>` con su propio estado; no arrancar en modo edición ni con `document.hidden`. |
| 14 | Mapa recalcula 12+ derivaciones cada segundo sin memoizar | `MapaIncidencia.tsx:968-1006` + `setClock` cada 1s (`:379`) | La sección más vistosa es la que más trabaja en balde; compite con WebGL. Ahí se nota el "va lento". | `useMemo` en enRango/zona/rivalesAmenaza; reloj a sub-componente; refrescar HH:MM cada 30-60s. |
| 15 | CSS global monolítico (4778 líneas, 3225 selectores) | `src/index.css` | Tocar un estilo da miedo: no sabes qué otra pantalla usa esa clase. Cambios lentos y frágiles. | Migración gradual SIN tocar el look a CSS Modules o `@scope`, empezando por Mapa/Tpv/Salon. |
| 16 | Cero tests en un SaaS que maneja dinero y nóminas | repo (`find *.test/*.spec` = **0**) | Si alguien toca una fórmula de IVA o cuadre, nadie se entera hasta que un cliente ve la cifra mal. | Vitest sobre la lógica pura de dinero (IVA, cuadre de caja, food cost, wallet); gate en build. |
| 17 | Escrituras "fire-and-forget" tragan errores en silencio | `gastos.ts:97` y 6 sitios más (`.then(() => {})`) — **7 confirmados** | Un negocio "guarda" un cambio, cierra la app, y al día siguiente el dato volvió atrás. Pérdida silenciosa. | Centralizar escritura en una fábrica con `await`+`.catch` que revierta el cambio optimista y avise. |
| 18 | 23 MB de imágenes/vídeo sin optimizar | `public/img` = **14M**, `public/video` = **8.9M** (avatar león 1.7MB) | El avatar de 80px pesa más que la lógica de una sección; la intro se come los datos del móvil. | WebP/AVIF (1.7MB→~120KB sin pérdida visible); recodificar el vídeo; `preload='none'`. |
| 19 | Patrón store+bus copiado a mano en 14 módulos | `gastos.ts:44-119` y replicado en 13 libs más | Cada entidad nueva = copiar 80 líneas; un error en un string ('rebell:gasto' vs 'rebell:gastos') no actualiza la UI sin aviso. | Fábrica `createStore<T>` con `useSyncExternalStore` (React 19); los 14 módulos pasan a ~15 líneas. |

### 🟡 BAJA — limpieza / pulido

| # | Hallazgo | Archivo | Fix |
|---|---|---|---|
| 20 | 3 librerías de mapas instaladas, solo 1 usada | `package.json` (maplibre-gl, leaflet); imports JS de maplibre/leaflet = **0** verificado | `npm rm maplibre-gl leaflet @types/leaflet` + borrar CSS huérfano. |
| 21 | Singletons de módulo no se reinician al cambiar de usuario | `ventas.ts:47`, `equipo.ts:95`, `gastos.ts:57` (`let x = load()` al importar) | Exportar `resetStores()` y llamarlo en `onAuthStateChange` cuando `session===null`. |
| 22 | CSP permite estilos inline (`style-src 'unsafe-inline'`) | `public/_headers:8` | Menor (los scripts SÍ están a 'self'). Migrar estilos inline a custom properties a medio plazo. |
| 23 | Sin router: el botón Atrás sale de la app, no hay deep-links | `Shell.tsx` (useState + localStorage 'rebell-active') | Adoptar react-router; el MAP de registry pasa a rutas; habilita code-splitting por ruta. |
| 24 | Tailwind importado pero casi sin usar (~26 utilidades) | `index.css:1` + CSS de salida 415KB | Decidir UNO: o se usa Tailwind de verdad, o se quita (1h convertir las 26 a CSS propio). |

---

## Lo que está BIEN hecho (para que conste y no se rompa)

- **Sin secretos peligrosos en el navegador**: service_role, clave de Google y password NO están en el bundle (verificado). La password solo se pre-rellena bajo `import.meta.env.DEV`, que Vite elimina en prod.
- **Proxy server-side para Google Places** con check de origen y rate-limit: patrón correcto, replicarlo para Mapbox.
- **RLS por local_id leído del JWT (`app_metadata`, no `user_metadata`)**, helpers con `search_path` fijo, SECURITY DEFINER con grants mínimos: criterio de seguridad real.
- **TypeScript estricto, cero `any`, cero `@ts-ignore`, stylelint anti-deriva, typecheck gateado en build.**
- **Pedido online atómico con advisory lock** (la numeración por local no se pisa).
- **Sin sourcemaps en prod** (nadie reconstruye el fuente desde DevTools).