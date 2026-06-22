# 📐 Referencias — el libro de estilo de REBELL

> El **criterio de Juan**, hecho concreto. Antes de construir cualquier pantalla nueva, miro aquí.
> Esta carpeta NO se despliega (no está en `public/` ni `src/`), solo guía el diseño.

## Cómo trabajamos (flujo "preview → aprobar → aplicar")

Como las webs donde copias el código de un componente: **primero lo ves aislado, luego decides.**

1. **Ficha + referencia** — cuando Juan pide un elemento, saco sus propiedades medibles y la referencia (de Mobbin o la que él mande).
2. **Preview aislado** — construyo el elemento SOLO, en `referencias/previews/<elemento>.html` (HTML+CSS autocontenido, sin tocar la app).
3. **Captura** — lo abro en el navegador y le mando la captura.
4. **Juan decide** — "aplícalo" / "cambia X" / "así no". Itero en el HTML (barato, aislado).
5. **Porto a React** — solo cuando está aprobado, lo llevo al componente real.

Regla de oro (`talcual`): **no se da nada por hecho sin cargar la vista y comparar con la referencia.**

## Canon aprobado (nuestro norte) — "ASÍ SÍ"

| Zona | Referencia | App / link | Qué tomamos |
|---|---|---|---|
| Hero Caja diaria | Anillo + lista limpia | [Revolut "Total wealth"](https://mobbin.com/screens/6d76195e-738e-43c1-89f7-b52c371eb96d) | Anillo fino crispy, datos en lista, cero halo/aire |
| Carta (cromo) | Tarjeta banking $80.600 | (imagen de Juan) + [CRED](https://mobbin.com/screens/4b32ea66-a7dc-4ba1-99f1-335da21df047) | Foto visible, nº grande arriba-dcha, panel oscuro con muesca curva, datos en esquinas |
| Coverflow Carta | Card central + laterales | [Believe](https://mobbin.com/screens/f088d852-8a9c-4369-a916-866ac56269ed) | Card grande domina, laterales asomando |
| Login (futuro) | "Who's Watching" | [Netflix](https://mobbin.com/screens/56828317-e043-4028-b611-6449437fe8f6) | Rejilla de avatares + añadir + editar |
| Glow / "respira" | Gema con aura | [Opal](https://mobbin.com/screens/0f12fb66-1ce1-49f0-93ff-ef3db182de56) | Glow limpio (nunca sucio), pulso lento |
| Cierre épico | Medalla 3D + logros | [Any Distance](https://mobbin.com/screens/eda463cb-1acb-481b-a9c9-cabe3bc7e3b9) | Recompensa al cerrar, coleccionable |

## Reglas permanentes — "ASÍ NO" (anti-olor-a-Claude-Code)

- ❌ Pastillas flotantes con borde y texto de bajo contraste → ✅ datos en filas/columnas con líneas finas.
- ❌ Halo/glow de color de marca difuminado sobre negro ("halo sucio") → ✅ stroke/borde CRISPY, sin drop-shadow de color.
- ❌ Texturas baratas (rayas/scanlines) en superficies premium → ✅ fondo limpio o vignette radial sutil.
- ❌ Tapar la foto del producto → ✅ **la foto es la protagonista** (cromo).
- ❌ Texto secundario diminuto al lado de número gigante → ✅ escala tipográfica coherente (proporción SAGRADA).
- ❌ El `€` pequeño → ✅ el `€` al tamaño de los números.
- ❌ `transition: all` → ✅ animar solo `transform`/`opacity`.

Norte: **Revolut / Opal / Netflix.** Menos elementos, cada uno perfecto. Que NO parezca hecho con Claude Code.
