# Plan VERIFICADO — Datos reales FAT SMASH (workflow 14 agentes, 28-jun)

## Estado real (corrige la auditoría)
LA VERDAD (corrige la auditoria previa "ninguna seccion lee de Supabase" — es FALSA):

YA SON REALES en modo REAL (mixto: Supabase + RLS por local_id, respetan isDemoMode, hidratan con realtime):
- ventas.ts (libro de tickets/facturas) — initSync con .eq('local_id') + insert con local_id (ventas.ts:68-87, 100-106). FUNCIONA. Solo "fake transitorio": al importar carga SEED hasta que initSync responde (ventas.ts:47).
- cierres.ts (libro de arqueos) — Supabase real + realtime (cableado correcto). PERO el IMPORTE que graba viene contaminado por el SEED del wallet.
- compras.ts, gastos.ts, equipo.ts, comandas.ts, acceso.ts, almacen.ts — TODOS leen/escriben Supabase real por local_id. El problema NO es que sean fake, es que AUTO-SIEMBRAN datos de demo en la tabla real del cliente la primera vez (compras 9 albaranes, equipo 8 empleados, gastos 10 gastos, almacen blob ALM0 de hamburgueseria). Eso ensucia la BD real del tenant.

SON FAKE DE VERDAD en modo REAL (el corazon del problema — los AGREGADOS del panel):
- wallet.ts — CAJA DEL DIA. NO importa supabase ni isDemoMode. Arranca con SEED=1787.4 (wallet.ts:10,36) en localStorage SIN local_id. Nunca suma las ventas reales de hoy. Es el #1 a arreglar.
- data.ts — TODO inventado: CAJA (1607,80 €), VENTAS_MES=42000, serie de 10 dias y calendario con Math.sin (data.ts:44-100), META_DIA/OBJ/FOOD_COST_PCT hardcodeados. No importa supabase ni isDemoMode. Alimenta Resumen P&L, Coste personal, grafica de ventas, calendario.
- caja.ts — estado abierta/cerrada + numeracion de tickets, solo localStorage global sin local_id. GERENTE_PIN='1234' en el bundle (critico seguridad).
- salon.ts — geometria de mesas SI es real (Supabase), pero el ESTADO de servicio (ocupada/cobrar/timers) lo siembra seedStates() y el IMPORTE a cobrar es un HASH falso (cobroAmount), tambien en REAL.

PARADOJA CLAVE: ventas.ts ya guarda cada cobro real en Supabase, pero wallet.ts (la Caja del dia que el usuario VE arriba) ignora esa tabla y vive de un SEED en localStorage. La fuente real existe; el agregado no la lee. Arreglar wallet = leer ventas de hoy, que ya estan ahi.

## Números falsos (15)
- **Caja del dia = 1787,40 € (SEED inicial)** [src/lib/wallet.ts:10,36]: En REAL: total de hoy = suma de ventas.total cuyo creado_at sea hoy, filtrado por local_id (la tabla ventas YA existe y es real). Suscribir wallet al evento 'rebell:ventas' + recalcular. En DEMO: mantener SEED. Local nuevo = 0, no roto.
- **Ventas hoy (TPV y cartera) = mismo 1787,40 €** [src/lib/wallet.ts (useCajaDelDia, walletTotal)]: Misma fuente que arriba: deriva del agregado real de ventas de hoy por local_id en REAL; SEED solo en DEMO. No tocar el count-up ni la estetica.
- **Caja del dia demo data.ts = 1607,80 € (180.5+320+145.9+240+520.4+380.6) y 84 pedidos** [src/lib/data.ts:2-11 (CAJA, subM, subT, totalDia, avgT)]: Constantes solo para DEMO. En REAL las shift-cards manana/tarde deben agregar ventas reales por franja horaria (creado_at) por local_id.
- **Facturacion del mes = 42.000 € (igual para todos los tenants)** [src/lib/data.ts:16 (VENTAS_MES) consumida en Resumen.tsx:40,80-85,127,139,149, Coste.tsx:32,90, Mensual.tsx:39]: En REAL: SUM(ventas.total) del mes en curso por local_id. Crear helper ventasMes() en ventas.ts. VENTAS_MES queda solo como fallback DEMO.
- **Facturacion hoy del P&L = 1787 € hardcodeado** [src/sections/Resumen.tsx:40]: Reemplazar el literal 1787 por walletTotal()/caja del dia real en REAL; literal solo en DEMO.
- **Grafica ventas ultimos 10 dias + medianas (Math.sin)** [src/lib/data.ts:44-100 (frac, salesForDay, SALES, salesMedian), consumida en SalesChart.tsx:48-55,108,206]: En REAL: construir la serie desde ventasPorDia() (ventas.ts ya lo tiene) por local_id; el motor Math.sin queda solo para DEMO.
- **Calendario de ventas dia/mes/año (Math.sin)** [src/lib/data.ts:49-82 (salesForDay/Month/Year), consumida en Ventas.tsx:41, Coste.tsx:47]: En REAL: leer ventasPorDia() del local; generador determinista solo en DEMO.
- **Meta del dia 2000 €, objetivo 1492 €, food cost 30%** [src/lib/data.ts:12-17 (META_DIA, OBJ, FOOD_COST_PCT)]: Mover a config por local (tabla locales o ajustes). Defaults solo si el local no los configuro.
- **Importe a cobrar de una mesa = hash 18-90 € (cobroAmount)** [src/lib/salon.ts:26-30, usado en Salon.tsx:371, Tpv.tsx:183,388]: En REAL usar la cuenta real de la mesa (comandas.items por mesa); nunca el hash. Hash solo DEMO.
- **Estados de mesa ocupada/cobrar + timers sembrados** [src/lib/salon.ts:93-122 (seedStates)]: En REAL derivar de comandas activas por mesa (estado!=cerrada). Siembra solo DEMO.
- **Cierre Z guardado en Supabase contaminado por SEED 1787.4** [src/lib/wallet.ts:87-93 -> cierres.ts:84-96]: Al arreglar wallet (total real desde ventas), el cierre dejara de incluir el SEED automaticamente. Verificar que efectivo+tarjeta cuadren con total (hoy el SEED queda sin metodo, descuadra).
- **KPIs Compras del mes / pendiente / pagado suman TODO el historico** [src/lib/compras.ts:126-129]: Filtrar por ts del mes en curso. Ademas: NO sembrar SEED en la tabla real (compras.ts:80-82).
- **Valor stock 4850 € y % ocupacion fijos** [src/lib/almacen.ts:29,39,48,55 + Almacen.tsx:88]: Recalcular valor desde nivel x precio unitario; en REAL no sembrar ALM0 (almacen.ts:124) ni drenar por timer decorativo (Almacen.tsx:90-95).
- **Numeracion de tickets T-NNN solo-cliente sin local_id** [src/lib/caja.ts:66-75]: En REAL la secuencia debe venir del servidor (columna numero de ventas / RPC) por local_id; localStorage solo DEMO.
- **GERENTE_PIN = '1234' en el bundle** [src/lib/caja.ts:10]: Validar PIN server-side (Edge Function por local_id); fuera del cliente. (Seguridad, no agregado, pero es numero falso de cara a auditoria.)

## Plan de implementación
# Plan: pasar los AGREGADOS del panel a datos reales (sin tocar estetica)

Regla transversal en TODO el plan: `if (isDemoMode()) -> SEED` (escaparate intacto) · `else -> Supabase por local_id`. Estado vacio = 0/listas vacias, nunca roto. Reutilizar el patron ya probado de `ventas.ts` (initSync + .eq('local_id') + realtime + evento). NO tocar tokens, motion, count-up ni layout.

## FASE 0 — PLANTILLA: Caja del dia (wallet.ts) [empezar AQUI]

**Problema:** `wallet.ts` arranca con `SEED=1787.4` (wallet.ts:10,36) en localStorage sin local_id y nunca suma las ventas reales de hoy. Pero `ventas.ts` YA guarda cada cobro real en Supabase. La fuente existe; el agregado no la lee.

**Patron de codigo (quirurgico):**
1. En `wallet.ts` importar `isDemoMode` y un nuevo helper `ventasHoy()` de `ventas.ts`.
2. En `ventas.ts` exportar `ventasHoyTotal()` y `ventasHoyPorMetodo(m)`: filtran `ventas` (ya hidratado por local_id) por `ts` del dia local y suman. Cero query nueva: reusa el array que initSync ya trae.
3. `load()` (wallet.ts:36): si `isDemoMode()` -> `total: SEED`. Si REAL -> `total: ventasHoyTotal()` (0 si local nuevo).
4. `useCajaDelDia`/`onChange` (wallet.ts:120,139): ademas de escuchar `'rebell:caja'`, escuchar `'rebell:ventas'` -> al llegar una venta real (propia o de otro dispositivo via realtime) recalcula el total. Asi DOS cajas del mismo local ven lo mismo (hoy no).
5. `walletTotal()` en REAL devuelve `ventasHoyTotal()`; en DEMO el `state.total`.

**EVITAR DOBLE-CONTEO (critico):** hoy un cobro de TICKET hace `addWallet(payAmount)` (Tpv.tsx:339) Y `appendVenta(...)` que inserta en Supabase. Si wallet pasa a leer de ventas, sumar tambien con addWallet contaria DOBLE.
- Solucion: en REAL, `addWallet` y `logCobro` NO mutan el total (el total se deriva de ventas). Solo en DEMO siguen sumando al `state` local.
- El cobro de MESA (Tpv.tsx:187, Salon.tsx:375) que hoy SOLO hace addWallet (no appendVenta): en REAL debe pasar a `appendVenta` para que entre por la unica via real -> entonces wallet lo refleja sin doble-conteo. (Cerrar el flujo mesa->venta real.)
- Las "moneditas que vuelan" (`fireCobro`) son SOLO adorno visual: se mantienen igual, no tocan dato.

**Aislamiento por local_id:** wallet deja de usar la clave global `rebell-caja-dia-v1` como fuente de verdad en REAL (pasa a ser solo cache DEMO). El total real ya viene filtrado por local_id desde ventas (RLS + .eq).

**Estado vacio:** local nuevo sin ventas hoy -> `ventasHoyTotal()=0` -> la cartera muestra 0 € con su animacion normal. Nada roto.

**reset/cierre:** `resetWallet` (Tpv.tsx:411) y `registrarCierre` (wallet.ts:87) en REAL: el total ya es real, el cierre Z deja de arrastrar el SEED automaticamente. Verificar que efectivo+tarjeta = total (usar `ventasHoyPorMetodo`).

**Verificacion:** login con local real vacio -> Caja = 0. Cobrar un ticket de 12 € -> Caja = 12 (no 1787+12, no 24). Abrir en 2 pestañas mismo local -> ambas 12. Modo DEMO -> vuelve a 1787,40.

## FASE 1 — Facturacion del mes + serie + calendario (data.ts)

Es la 2ª fuente fake mas visible (Resumen P&L, Coste personal, grafica, calendario).
- Crear en `ventas.ts`: `ventasMes()` (SUM del mes en curso por local_id, reusa el array hidratado) y exponer `ventasPorDia()` (ya existe) para serie y calendario.
- `Resumen.tsx:40,80-85` etc.: en REAL usar `ventasMes()`; `VENTAS_MES=42000` queda como fallback solo DEMO.
- `Resumen.tsx:40` literal `1787` de "hoy" -> `walletTotal()` real.
- `SalesChart` (SALES) y `Ventas.tsx`/`Coste.tsx` (salesForDay): en REAL construir desde `ventasPorDia()`; motor Math.sin solo DEMO.
- Mismo patron `isDemoMode()` en cada punto. Sin tocar el SVG/curvas de la grafica (solo cambia el origen de los numeros).

## FASE 2 — Salon: estado e importe de mesa reales

- `salon.ts`: en REAL derivar estado ocupada/cobrar de `comandas` activas por mesa; importe a cobrar = cuenta real (comandas.items), nunca `cobroAmount` hash (salon.ts:26-30). `seedStates` solo DEMO. Importar `isDemoMode`.
- Geometria ya es real, no se toca.

## FASE 3 — Frenar auto-siembra en tablas reales (limpieza de tenant)

En REAL, NO insertar SEED cuando el local esta vacio (debe quedar vacio elegante):
- compras.ts:80-82, equipo.ts:134-137, gastos.ts:83-86, almacen.ts:124.
- Patron: la siembra solo si `isDemoMode()`. Local real nuevo = listas vacias + estado vacio en UI (ya hay que añadir copy "aun no hay datos", sin tocar estetica de las tarjetas).
- Recetas/valores de almacen: hacer la receta configurable por carta del local (fuera de plantilla REBELL).

## FASE 4 — caja.ts: estado y numeracion por servidor + PIN seguro

- Numeracion de tickets por local_id desde servidor (columna `numero` de ventas / RPC). 
- Estado abierta/cerrada por local_id.
- `GERENTE_PIN` (caja.ts:10): validar server-side (Edge Function). Sale del bundle. [tocar con security-review]

## FASE 5 — KPIs por periodo + endurecer escrituras

- compras.ts:126-129: filtrar por mes en curso (hoy suma todo el historico).
- almacen: recalcular valor stock (no constante), quitar drenaje decorativo en REAL (Almacen.tsx:90-95).
- Defensa en profundidad: añadir `.eq('local_id', _lid)` en updates/deletes (compras.ts:116,122; gastos.ts:97,102) aunque la RLS ya proteja.
- Manejo de error en escrituras fire-and-forget (equipo, comandas, cierres): avisar si falla, no divergir en silencio.

## Riesgos
- DOBLE-CONTEO en la Caja del dia: hoy el cobro de TICKET hace addWallet Y appendVenta. Si wallet pasa a derivar de ventas sin desactivar addWallet en REAL, el total se duplica. Es el riesgo #1 de la Fase 0.
- Flujo MESA incompleto: el cobro de mesa (Tpv.tsx:187, Salon.tsx:375) hoy SOLO hace addWallet, no appendVenta. Si wallet deja de sumar en REAL pero la mesa no pasa a appendVenta, esos cobros DESAPARECEN del total. Hay que migrar el cobro de mesa a appendVenta a la vez.
- Latencia del realtime/initSync: hasta que initSync responde, ventas.ts arranca con SEED (ventas.ts:47). Si wallet deriva de ventas, la Caja parpadearia del SEED a la cifra real. Mitigar: en REAL no cargar SEED de ventas (arrancar vacio hasta hidratar) o marcar 'cargando'.
- Contaminacion cruzada DEMO->REAL: quien uso la demo deja SEED en localStorage (rebell-*-v1) sin local_id. Al pasar a REAL, esas claves pueden pintarse antes de hidratar. Hay que limpiar/ignorar localStorage en REAL (no usarlo como fuente).
- Tablas ya ensuciadas: locales reales que ya arrancaron en REAL antes del fix tienen SEED persistido en Supabase (compras/equipo/gastos/almacen). Frenar la siembra no borra lo ya sembrado: hace falta un script de limpieza por local_id o avisar al cliente.
- Definicion de 'hoy': salesForDay y el calendario usan la fecha local del navegador (data.ts:40, caja.ts:12). Cobros cerca de medianoche o reloj manipulado pueden caer en el dia equivocado. Idealmente usar creado_at del servidor para el corte del dia.
- Singletons de modulo sin reset por local_id: ventas/cierres/compras/etc. tienen _syncStarted que impide re-sincronizar si se cambia de local sin recargar (fuga cross-tenant visible en cliente). El fix de Caja hereda este riesgo si no se contempla el cambio de sesion.
- Performance: ventasMes()/ventasPorDia() recorren el array en cada render. Con histórico grande conviene memoizar o agregar server-side (vista/RPC) en vez de traer 400 filas al cliente.
- No tocar estetica: el riesgo es que al cambiar la fuente de datos se rompa el count-up o el formato eur(). Mantener exactamente walletTotal()/useCajaDelDia como interfaz; solo cambia de DONDE sale el numero.

## Veredicto adversarial (sólido: true)
### Agujeros encontrados
- DOBLE-CONTEO en pagos DIVIDIDOS (el peor, mal cubierto): confirmado en Tpv.tsx:321-342. Las partes INTERMEDIAS de un split solo hacen addWallet+logCobro y NUNCA appendVenta; solo la ULTIMA parte hace appendVenta con total=cobroFinal completo. Hoy cuadra por casualidad (wallet=suma de partes=cobroFinal; ventas=1 fila=cobroFinal). El fix del plan ('addWallet no muta total en REAL, derivar de ventas') ROMPE esto: las partes intermedias desaparecen del libro (no hay appendVenta) y el descuadre solo se ve si miras importe por parte. El plan dice 'migrar cobro de mesa a appendVenta' pero NO menciona el caso split ni que appendVenta se llama una sola vez por ticket completo.
- PER-METODO se pierde en split: cada parte de un split puede pagarse efectivo o tarjeta (confirmCobro(m) por parte), pero appendVenta graba UN solo metodo para todo el ticket (Tpv.tsx:342). Si ventasHoyPorMetodo() deriva el desglose efectivo/tarjeta desde ventas.metodo, el cierre Z efectivo/tarjeta saldra mal en cualquier mesa dividida con metodos mixtos. El plan promete 'efectivo+tarjeta=total con ventasHoyPorMetodo' sin ver que la fuente ya no tiene el metodo por parte.
- PROPINA contamina el agregado: appendVenta graba total=cobroFinal que INCLUYE la propina (Tpv.tsx:142,342). Si wallet/ventasMes/food-cost% derivan de ventas.total, la propina infla 'facturacion del mes' y baja el food cost %. El plan nunca menciona propina; deberia guardar base y propina por separado o excluir propina del agregado de ventas.
- .limit(400) DESCUADRA los totales del mes (el limit que pide la auditoria): ventas.ts:77 carga solo las ultimas 400 filas al cliente. ventasMes()/ventasPorDia() recorren ESE array truncado -> un local con >400 tickets/mes vera la facturacion del mes SILENCIOSAMENTE infravalorada vs el historico real en Supabase. El plan lo trata como 'performance/memoizar', no como bug de correctitud. Hay que agregar server-side (RPC/vista SUM por mes) o el numero del panel mentira en locales con volumen.
- AUTO-SIEMBRA escribe SEED en la tabla REAL del tenant (no es solo memoria): confirmado compras.ts:80-82 hace INSERT del SEED en Supabase la 1a vez si la tabla esta vacia (idem equipo/gastos/almacen). Ensucia PERMANENTEMENTE la BD de un cliente limpio, y comprasMes()/pendienteMes() suman esos albaranes-fantasma. El plan lo recoge en FASE 3, pero el estadoReal lo minimiza como 'auto-siembra' sin dejar claro que ya hay tenants con datos basura persistidos (el propio plan lo admite en riesgos: frenar no borra -> hace falta script de limpieza por local_id).
- ticketsHoy() es fake global sin local_id y se ESCRIBE en el cierre real: registrarCierre(ticketsHoy()) (Tpv.tsx:416) mete ese contador de caja.ts (localStorage global) en la fila real de cierres en Supabase (cierres.ts:96). Aun arreglando wallet, el nº de tickets del arqueo auditable sigue contaminado/cross-tenant. El plan aplaza caja.ts a FASE 4 sin notar que ya esta envenenando la tabla cierres en FASE 0.
- DIVIDE-BY-ZERO / grafica fea con tenant vacio: salesMedian=sum/SALES.length y el escalado del SVG asumen serie poblada (data.ts:101). Un local real sin ventas da serie toda a 0 -> linea de mediana en 0, posible NaN en agregados que dividen por dias/conteo, eje Y degenerado. El plan dice 'estado vacio = 0' pero no aborda la matematica de la grafica/mediana ni el calendario sobre datos vacios.
- DEPENDENCIA de RLS sin .eq en updates/deletes: confirmado compras.ts:116,122 y gastos.ts:97,102 hacen .update/.delete SOLO por .eq('id', ...) sin .eq('local_id'). Si la RLS de UPDATE/DELETE no esta perfecta, un id de otro tenant podria tocarse. El plan SI lo recoge (FASE 5 defensa en profundidad), bien.
- Singletons _syncStarted no reinician al cambiar de local sin recargar: confirmado en todos los stores. Cambiar de sesion/tenant en la misma pestaña deja los datos del local anterior en pantalla (fuga cross-tenant visible). El plan lo lista en riesgos pero NO lo mete como tarea en el plan -> queda como riesgo huerfano sin fix asignado.
- Contaminacion DEMO->REAL via localStorage sin local_id: ventas/wallet/caja persisten en claves globales (rebell-ventas-v1, rebell-caja-dia-v1). Quien uso demo deja SEED que puede pintarse antes de hidratar al pasar a REAL. El plan lo cita en riesgos; el fix correcto (ignorar localStorage como fuente en REAL) esta esbozado para wallet pero no para ventas.ts (que en REAL aun arranca de load()/SEED hasta initSync, ventas.ts:47).

### Correcciones obligatorias
- FASE 0 — tratar el SPLIT como ciudadano de primera: en REAL, cada parte cobrada debe generar su propio appendVenta (con su metodo y su importe de parte), o bien crear UNA venta con sub-lineas de pago (pagos[] {metodo, importe}). Decidir el modelo ANTES de tocar wallet. Nunca dejar partes intermedias sin persistir.
- Separar PROPINA del importe de venta: appendVenta debe guardar total_base y propina aparte (o columna propina). Los agregados de facturacion/food-cost usan total_base; la caja del dia puede sumar base+propina pero el P&L no debe contar propina como venta.
- Reemplazar la dependencia de .limit(400) para totales por agregacion SERVER-SIDE: crear RPC/vista 'ventas_resumen(local_id, desde, hasta)' que devuelva SUM total y SUM por metodo por dia/mes. ventasMes()/ventasPorDia() del panel deben leer ese agregado, no recorrer un array truncado. Asi el numero coincide con el historico real aunque haya >400 tickets.
- Gate de siembra por isDemoMode() en compras/equipo/gastos/almacen ANTES de tocar nada mas (subirlo de FASE 3 a temprano): en REAL nunca INSERT del SEED. Y entregar un script SQL de limpieza por local_id para los tenants ya ensuciados (borrar filas-semilla identificables).
- Mover el arreglo de ticketsHoy()/numeracion por local_id a la MISMA fase que wallet (no FASE 4): mientras siga siendo global, los cierres reales nacen contaminados. El nº de tickets del cierre debe derivar de COUNT de ventas reales de hoy por local_id, no de caja.ts localStorage.
- Blindar estados vacios en la matematica, no solo en copy: guardas para salesMedian/escala SVG/divisiones cuando la serie esta vacia (mediana=0 sin NaN, eje Y con minimo sensato, calendario gris). Probar explicitamente un tenant 100% vacio.
- Asignar como TAREA (no solo riesgo) el reset de singletons al onAuthStateChange/cambio de local_id: resetear _syncStarted/_live/_lid/arrays y re-sincronizar al cambiar de sesion, o forzar recarga dura. Cubrir wallet/ventas/cierres/compras/equipo/gastos/almacen.
- En REAL, NO usar localStorage como fuente de verdad en ventas.ts ni wallet.ts: arrancar vacio/'cargando' hasta que initSync hidrate, e ignorar/limpiar las claves globales (sin local_id) para evitar arrastre DEMO->REAL y parpadeo SEED->real.
- Definir 'hoy' por reloj de servidor: el corte del dia (creado_at) debe basarse en hora servidor, no en Date local del navegador, para cobros cerca de medianoche y relojes manipulados. Idealmente filtrar 'hoy' en el RPC server-side.
- Anadir manejo de error visible a las escrituras fire-and-forget (insert/update/delete .then sin catch en ventas/cierres/compras/gastos/equipo): si Supabase falla, avisar y reconciliar; hoy pueden divergir en silencio (la UI cree que cobro, la BD no).
