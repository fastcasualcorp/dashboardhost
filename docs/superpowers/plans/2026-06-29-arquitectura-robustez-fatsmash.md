# Plan de robustez/arquitectura FAT SMASH (post-auditoría 28-jun)

## ✅ PASO 0 — acordado con Juan (arrancar por aquí, antes del resto del plan)

1. **"Modo demo vs real" con un interruptor:** los datos inventados solo en modo DEMO (escaparate para vender); el cliente real SIEMPRE lee de su base de datos. Mata el bloqueante #1 (datos falsos) sin perder la demo bonita. Hoy ya existe `isDemoMode()`/`setDemoMode()` → ampliarlo para que las secciones lean de Supabase cuando NO es demo.
2. **Arrancar el plan #1 (datos reales):** es la madre de todo. Montar la PRIMERA entidad de verdad — **Caja leyendo de Supabase con aislamiento por negocio (`local_id` + RLS)** — como plantilla para replicar en el resto de secciones.

# Plan de acción por fases — FAT SMASH

> **REGLA DE ORO DE TODO EL PLAN: NINGUNA tarea degrada la estética premium.** Todo es "fontanería" por debajo (cómo se cargan, guardan y protegen los datos). El diseño, los colores, las animaciones y el motion se quedan EXACTAMENTE igual. Donde haya esqueletos de carga nuevos (lazy), respetan los tokens actuales. Verificación visual con Playwright antes/después en cada fase para probar que la piel no se ha movido un píxel.

---

## FASE 0 — BLOQUEO DE LANZAMIENTO (esta semana, antes de enseñarlo a nadie)
*Seguridad y verdad de los datos. Sin esto, no se abre al público.*

| Tarea | Archivo / acción | Impacto | Esfuerzo |
|---|---|---|---|
| **Verificar HOY que prod tiene RLS** | Dashboard Supabase → comprobar que TODAS las tablas de negocio tienen "RLS enabled". Si falta, aplicar `apply.sql`. | Confirma que las nóminas/finanzas no están abiertas con la clave pública. | S |
| **Cerrar design_comments** | Migración `0004`: cambiar `using(true)` por `local_id = jwt_local_id()` (o restringir a rol 'central'). | Tapa la única grieta real de aislamiento entre negocios. | S |
| **Quitar la contraseña común** | `setup-admin.mjs:12`: password aleatoria por usuario + forzar cambio; email del 'central' no adivinable. | Elimina el "inspeccionar y entrar como admin de todos". | S |
| **Apagar el pedido online de cobro falso** | No exponer slugs reales hasta tener pasarela; o desactivar la ruta /pedir en prod. | Evita pedidos fantasma e ingresos falsos en caja. | S |
| **config.toml versionado** | Crear `supabase/config.toml`: `verify_jwt=true` para 'acceso', `false` (a propósito) para 'pedido'. | La seguridad no depende de un ajuste invisible del dashboard. | S |

---

## FASE 1 — QUICK-WINS de robustez y velocidad (días)
*Pequeños cambios, gran efecto. Sin tocar diseño.*

| Tarea | Archivo / acción | Impacto | Esfuerzo |
|---|---|---|---|
| **Error Boundary** | Envolver `renderSection` en `Shell.tsx` con `<ErrorBoundary>` (react-error-boundary) + fallback premium. | Un fallo en una pantalla ya no tumba toda la app; el camarero sigue cobrando. | S |
| **Limpiar logout** | `SettingsPanel.tsx:338`: borrar TODAS las claves `rebell-*` (salvo preferencias UI), no solo el perfil. | Corta la fuga de datos entre negocios en un tablet compartido. | S |
| **resetStores en logout** | Exportar `resetStores()` en cada lib; llamarlo cuando `session===null`. | El estado en memoria deja de arrastrar datos del usuario anterior. | M |
| **.limit() + .catch en libs sin red** | `compras.ts:79`, `equipo.ts:133`, `gastos.ts:82` (límite); 7 `.then(()=>{})` → `.catch`. | Evita descargas gigantes y pérdidas de datos silenciosas. | S |
| **Borrar libs de mapas muertas** | `npm rm maplibre-gl leaflet @types/leaflet` + CSS huérfano. | -48MB node_modules, menos superficie de ataque. | S |
| **Optimizar media** | Avatares/fondos a WebP (`cwebp -q 85`), recodificar vídeo intro. | De ~23MB a ~3-4MB. Mismo aspecto visual. | M |
| **manualChunks + límite de bundle** | `vite.config.ts`: separar vendor (react/supabase/mapbox/gsap) + `chunkSizeWarningLimit:300`. | Cachés duraderas + red de seguridad que avisa si el bundle crece. | S |

---

## FASE 2 — TROCEAR EL BUNDLE y aligerar runtime (1 semana)
*La app arranca rápido. El diseño no cambia, solo CUÁNDO se descarga cada cosa.*

| Tarea | Archivo / acción | Impacto | Esfuerzo |
|---|---|---|---|
| **Lazy-load por sección** | `registry.tsx`: el MAP pasa a `React.lazy(()=>import('./X'))` + `<Suspense>` con skeleton que respeta tokens. | El mapa 3D (62% del peso) solo carga al abrir el Mapa. Bundle inicial de 795KB → ~250-300KB. | M |
| **Aislar relojes de 1s** | `Tpv.tsx:379`, `Salon.tsx:147`: reloj en sub-componente; no arrancar en edición/`document.hidden`. | Menos calor/batería/tirones en terminal de barra. | M |
| **Memoizar el Mapa** | `MapaIncidencia.tsx:968-1006`: `useMemo` en derivaciones; reloj HH:MM cada 30-60s. | El "va lento" del Mapa desaparece. | M |
| **Restringir token Mapbox** | Panel Mapbox: URL allowlist a `dashboardhost.pages.dev`; idealmente proxy Pages Function como Places. | Nadie gasta tu cuota de Mapbox desde DevTools. | S |

---

## FASE 3 — CABLEAR DATOS REALES + tests (1-2 semanas)
*El corazón: que los números sean del negocio, no inventados. Y red de seguridad.*

| Tarea | Archivo / acción | Impacto | Esfuerzo |
|---|---|---|---|
| **Capa de datos a Supabase** | Reemplazar constantes de `data.ts` (`VENTAS_MES`, `Math.sin`) por hooks que leen de Supabase con RLS; mocks solo tras `isDemoMode()`. | El dueño ve SUS cifras reales, no las mismas falsas para todos. | L |
| **Agregaciones en SQL** | RPC `GROUP BY` día/mes/proveedor; paginación keyset en libros. | Totales correctos con histórico de años + carga rápida. | L |
| **Índice parcial de comandas** | `create index ... on comandas(local_id, creado_at) where estado<>'servida'`. | El KDS sigue rápido en hora punta con miles de comandas viejas. | S |
| **Inventario a filas + descuento server-side** | `inventario` blob JSON → tabla de filas; RPC atómico para descontar stock. | Dos cajas no se pisan; el stock baja aunque nadie tenga la app abierta. | L |
| **rate-limit fuera del hot-path** | check_rate sin delete global (pg_cron) o rate-limiter de Cloudflare. | El pedido online no se atasca a escala. | M |
| **Vitest sobre lógica de dinero** | Tests de IVA, cuadre de caja, food cost, wallet; gate en build. | Tocar fórmulas sin miedo a romper el dinero del cliente. | M |

---

## FASE 4 — ESTRUCTURAL / deuda a medio plazo (post-lanzamiento)
*Hace el código rápido de mantener. Cambios graduales, sin tocar el look.*

| Tarea | Archivo / acción | Impacto | Esfuerzo |
|---|---|---|---|
| **Fábrica createStore** | Unificar el patrón store+bus copiado en 14 libs (`useSyncExternalStore`). | Una entidad nueva = 15 líneas, no 80. Un bug se arregla 1 vez. | L |
| **CSS Modules gradual** | Mover el CSS de Mapa/Tpv/Salon a `*.module.css` SIN cambiar el aspecto. | Editar una sección no puede romper otra. | L |
| **react-router** | Una ruta por sección; deep-links; botón Atrás correcto; habilita splitting por ruta. | Friccón diaria menos en un panel de 30+ secciones. | M |
| **Migrar apply.sql a migraciones + test RLS en CI** | Trocear en 0004/0005...; test que lee datos de otro local y espera 0 filas. | La protección de datos deja de depender de la memoria de una persona. | M |
| **Pasarela de pago real** | Stripe/MONEI: la venta se inserta SOLO desde webhook firmado. | Cobro real, no simulado. Pedidos online de verdad. | L |
| **Decidir UN sistema de estilo y UNA lib de animación** | Tailwind vs CSS propio; gsap+motion → evaluar consolidar. | Menos confusión, menos peso. | M |

---

## Resumen de prioridad
1. **FASE 0** = imprescindible antes de cualquier público (seguridad + datos sensibles).
2. **FASE 1-2** = la app deja de "romperse" y arranca rápida (robustez + velocidad).
3. **FASE 3** = los números son reales (el producto deja de ser demo).
4. **FASE 4** = la casa queda ordenada para crecer sin miedo.

**Recordatorio final: cada fase termina con verificación visual en navegador real (Playwright) comparando antes/después. Si la estética se mueve un píxel, se revierte. El "wow" es intocable.**