# dsh-desktop-windowstatus-saving

[![npm](https://img.shields.io/npm/v/@jamolpe88/dsh-desktop-windowstatus-saving?style=flat-square&logo=npm&label=npm)](https://www.npmjs.com/package/@jamolpe88/dsh-desktop-windowstatus-saving)
[![GitHub release](https://img.shields.io/github/v/release/JaMoLpE88/dsh-desktop-windowstatus-saving?style=flat-square&logo=github&label=release)](https://github.com/JaMoLpE88/dsh-desktop-windowstatus-saving/releases)
[![licencia](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.1--rc.3-4B8BBE?style=flat-square)](#compatibilidad)
[![plataforma](https://img.shields.io/badge/platform-Windows%2011-0078D6?style=flat-square)](#compatibilidad)
[![dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/jamolpe88/dsh-desktop-windowstatus-saving)

**La ventana de DeepSeek Harness Desktop, exactamente donde la dejaste.** El tamaño, la posición y el estado maximizado se guardan mientras usas la aplicación y se restauran antes de que la ventana se pinte: sin saltar de nuevo al tamaño por defecto de 1280 × 820.

Cero configuración. Solo Windows. Un plugin Host, sin procesos extra y sin red.

**English** → [README.md](README.md)

![La misma ventana tras reiniciar: posición por defecto a la izquierda, posición restaurada a la derecha](https://raw.githubusercontent.com/JaMoLpE88/dsh-desktop-windowstatus-saving/main/assets/hero.png)

*Sin el plugin la ventana vuelve a 1280 × 820 en la posición por defecto. Con el plugin vuelve a 1943 × 1323 en el mismo monitor y el primer fotograma pintado ya es el definitivo.*

## Qué hace

- Recuerda el **tamaño**, la **posición** y el estado **maximizado** de la ventana principal de DeepSeek Harness.
- Aplica la posición guardada **con la ventana todavía oculta**, así que aparece directamente con su geometría final en lugar de redimensionarse después.
- Detecta los cambios mientras la aplicación está abierta (arrastrar, redimensionar, ajustar, maximizar) y los guarda en menos de un segundo.
- Guarda un valor final al cerrar DSH, tanto al salir desde la bandeja como al cerrar la ventana normalmente.
- Conserva el estado maximizado al **minimizar** y al ocultar en la bandeja: si maximizas, minimizas y cierras, la próxima vez vuelve maximizada.
- Restaura en el monitor donde se guardó el rectángulo, incluidos los monitores con **coordenadas negativas** (a la izquierda o por encima del principal).
- Mueve y encoge la ventana al área de trabajo más cercana cuando el monitor guardado ya no existe.
- Escribe el estado de forma atómica y solo cuando ha cambiado.

## Qué no hace

- No añade interfaz, comandos, herramientas ni ajustes.
- No lanza un segundo proceso ni un servicio en segundo plano.
- No identifica la aplicación por el título de la ventana.
- No toca ventanas de otras aplicaciones.
- No restaura el modo pantalla completa ni el estado minimizado (la ventana siempre se abre visible).
- No guarda geometría por perfil ni por sesión: una ventana, un único sitio guardado.

## Requisitos

- **DSH Desktop** `>= 0.2.1-rc.3`, perfil `desktop` (probado en `0.2.1-rc.3`, Windows 11).
- Windows 10 u 11. macOS y Linux no están soportados.
- Node 22+ (DSH trae su propio runtime).

## Instalación

Desde npm:

```bash
dsh plugin --profile desktop add @jamolpe88/dsh-desktop-windowstatus-saving
```

Desde el repositorio:

```bash
dsh plugin --profile desktop add github:JaMoLpE88/dsh-desktop-windowstatus-saving
```

Desde un checkout local, mientras desarrollas:

```bash
dsh plugin --profile desktop add C:\ruta\a\dsh-desktop-windowstatus-saving
```

Reinicia DeepSeek Harness Desktop después de instalar. El plugin solo restaura al arrancar, así que una instalación en caliente empieza a guardar de inmediato pero espera al siguiente arranque para restaurar.

## Uso

1. Mueve, redimensiona o maximiza la ventana principal.
2. Cierra DSH normalmente o sal desde la bandeja.
3. Abre DSH otra vez: la ventana ya está en la geometría que dejaste, en el mismo monitor.

No hay nada que configurar ni ningún panel que abrir. Para olvidar la ventana guardada, borra el archivo de estado y reinicia.

## Cómo funciona

![Ciclo de vida: mover y redimensionar, guardado silencioso, cerrar DSH, reabrir en el mismo sitio](https://raw.githubusercontent.com/JaMoLpE88/dsh-desktop-windowstatus-saving/main/assets/lifecycle.png)

### Restaurar antes del primer fotograma

DSH Desktop crea su `BrowserWindow` principal oculta al arrancar y solo la muestra cuando el host de plugins está listo y la página ha cargado. El plugin se ejecuta dentro de ese host y encuentra la ventana mientras sigue oculta:

```
ventana principal creada (oculta, 1280 × 820)
   │
   ├── arranca el host de plugins, carga el plugin
   │      └── SetWindowPlacement(geometría guardada, maximizado)
   │
   └── window.show()  ← el primer fotograma visible ya es el guardado
```

Como la posición se aplica con la ventana oculta, desaparece el salto visible desde el tamaño por defecto. El archivo de estado lo registra con `restore.whileHidden: true`.

### Identidad de la ventana

El plugin solo actúa sobre la ventana del producto: la ventana Chromium de nivel superior (`Chrome_WidgetWin_1`) del proceso Electron que lanzó el host del plugin, sin ventana propietaria y con un tamaño plausible. Nunca usa el título de la ventana: una pestaña del navegador titulada “DeepSeek Harness” no es una ventana de la aplicación.

### Archivo de estado

`%USERPROFILE%\.dsh\window-bounds.json`, o `$DSH_HOME/window-bounds.json` cuando `DSH_HOME` está definido:

```json
{
  "version": 1,
  "bounds": { "x": -2280, "y": 43, "width": 1943, "height": 1323 },
  "maximized": false,
  "savedAt": "2026-10-26T16:45:43.738Z",
  "restore": { "at": "2026-10-26T16:45:43.738Z", "whileHidden": true }
}
```

- Las escrituras son atómicas (archivo temporal + renombrado), así que un cierre inesperado no puede dejar un documento truncado.
- El archivo solo se escribe cuando cambia la geometría o el estado maximizado, y una vez más al apagar.
- Un archivo corrupto se ignora y se sustituye en el siguiente guardado.
- Un archivo escrito por una versión más nueva del plugin se deja intacto.

### Estados de la ventana

![Estados normal, maximizado y minimizado antes de cerrar](https://raw.githubusercontent.com/JaMoLpE88/dsh-desktop-windowstatus-saving/main/assets/states.png)

### Varios monitores

![Una ventana guardada en un monitor con coordenadas negativas](https://raw.githubusercontent.com/JaMoLpE88/dsh-desktop-windowstatus-saving/main/assets/multimonitor.png)

El área de trabajo que se usa para encajar la ventana procede del monitor del rectángulo guardado, no del monitor en el que esté la ventana al arrancar. Las coordenadas negativas son válidas y se conservan. Si el monitor ya no existe, la ventana se mueve al área de trabajo más cercana y se ajusta.

## Compatibilidad

| | |
|---|---|
| DSH | `>= 0.2.1-rc.3` (la única versión probada por el autor) |
| Node | `>= 22` |
| SO | Windows 11 (probado); Windows 10 sin probar; macOS y Linux no soportados |
| Perfil | `desktop` |
| Runtime | Plugin Host, FFI de `koffi` a `user32` |
| Catálogo | [publicado en dsh-plugin.org](https://dsh-plugin.org/plugins/jamolpe88/dsh-desktop-windowstatus-saving) |

Estado de validación: **probado en Windows 11 con DSH Desktop 0.2.1-rc.3** (2026-10-26) con reinicios normales, reinicios maximizado, maximizar → minimizar → cerrar, salida desde la bandeja y una configuración de dos monitores con coordenadas negativas. El archivo de estado registró `restore.whileHidden: true` tras los reinicios y la geometría guardada coincidía con la ventana viva.

No validado: macOS, Linux, Windows 10, otras versiones de DSH y el perfil web.

## Límites

- **Solo Windows.** El plugin llama a `user32` mediante `koffi`; en otras plataformas se desactiva.
- **Píxeles físicos.** Cambiar la escala de pantalla conserva el tamaño físico; no se reescala a DIP.
- **La pantalla completa no se restaura.** El maximizado sí; el fullscreen no se guarda como estado.
- **El minimizado no se restaura.** La aplicación siempre se abre visible.
- **Los grupos de ajuste no se recrean.** Los snap layouts de Windows 11 no forman parte del estado guardado.
- **Una sola ventana.** Solo se sigue la ventana principal del producto.
- **Si DSH acaba guardando la geometría por su cuenta**, desinstala este plugin.

## Privacidad

- Sin peticiones de red, sin telemetría y sin analítica.
- El plugin lee el estado de la ventana con Win32 y escribe un único archivo JSON en el home de DSH.
- Nunca lee el contenido ni el título de las ventanas, ni datos de sesión, ni credenciales.
- Nunca modifica ventanas de otras aplicaciones.

Consulta [SECURITY.md](SECURITY.md) para la política resumida.

## Problemas frecuentes

**La ventana sigue abriéndose a 1280 × 820.**
Comprueba que el bundle está instalado en el perfil `desktop` y reinicia la aplicación. Una instalación en caliente no restaura hasta el siguiente arranque. Comprueba también que no haya otro plugin de posición de ventana activo: dos plugins se pelean por la misma ventana.

**La ventana parpadea en el tamaño por defecto antes de moverse.**
El plugin no se cargó antes de que se mostrara la ventana. Comprueba que el bundle está activo y que DSH es la versión Desktop, no la CLI ni el perfil web.

**Quiero borrar la ventana guardada.**
Elimina `%USERPROFILE%\.dsh\window-bounds.json` y reinicia.

**Ha desaparecido un monitor.**
El rectángulo guardado ya no toca ninguna pantalla, así que la ventana se mueve al área de trabajo más cercana y se ajusta.

## Desarrollo

```bash
npm install
npm test        # 20 tests: geometría, máquina de estados, store atómico y bindings Win32
npm run check   # comprobación de sintaxis de todos los módulos
```

La suite de Win32 es una prueba de humo (tamaños de struct, `EnumWindows`, lectura de la posición); la restauración real se valida en el Harness en ejecución. Las ilustraciones del README se generan con `assets/src/render_assets.py` (Pillow, fuentes de Windows).

Instalación local:

```bash
dsh plugin --profile desktop add C:\ruta\a\dsh-desktop-windowstatus-saving
```

## Terceros

El plugin depende de [koffi](https://koffi.dev/) 3.1.1 (MIT, Niels Martignène) para la FFI. No se empaqueta ninguna otra dependencia de runtime.

## Licencia

[MIT](LICENSE) © 2026 JaMoLpE88
