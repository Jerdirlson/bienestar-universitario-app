#!/usr/bin/env bash
# Emulador de Android nativo para probar Raíz (APK real, no Expo Go) por línea
# de comandos: arrancar sin ventana, instalar el APK, abrir la app, tocar,
# escribir, tomar capturas y apagar. Pensado para correr en CI/agentes sin
# interfaz gráfica ni Android Studio — solo cmdline-tools + platform-tools.
#
# Variables de entorno configurables (todas tienen un valor por defecto que
# funciona si el SDK se instaló en la ruta estándar de Windows):
#   ANDROID_HOME     ruta del SDK (por defecto: %LOCALAPPDATA%\Android\Sdk)
#   AVD_NAME         nombre del AVD a usar (por defecto: raiz_pixel)
#   RAIZ_PKG         paquete de la app (por defecto: co.edu.upb.raiz)
#
# Uso: se pensó para hacerle `source` y llamar sus funciones directamente, o
# invocarlo directo con el nombre de la función como primer argumento:
#   bash e2e/native/emulator.sh iniciar
#   bash e2e/native/emulator.sh instalar ruta/al/app.apk
#   bash e2e/native/emulator.sh abrir
#   bash e2e/native/emulator.sh tocar 540 1200
#   bash e2e/native/emulator.sh escribir "hola mundo"
#   bash e2e/native/emulator.sh atras
#   bash e2e/native/emulator.sh captura salida.png
#   bash e2e/native/emulator.sh apagar
set -euo pipefail

: "${ANDROID_HOME:="$LOCALAPPDATA/Android/Sdk"}"
: "${ANDROID_SDK_ROOT:="$ANDROID_HOME"}"
: "${AVD_NAME:=raiz_pixel}"
: "${RAIZ_PKG:=co.edu.upb.raiz}"

EMULATOR_BIN="$ANDROID_HOME/emulator/emulator"
ADB="$ANDROID_HOME/platform-tools/adb"

log() { echo "── $* ──" >&2; }

# Arranca el emulador sin ventana ni sonido, en segundo plano, con el
# renderizador por software (swiftshader_indirect) que funciona igual con o
# sin aceleración por hardware. No bloquea: para saber cuándo está listo hay
# que llamar a `esperar_arranque` después.
iniciar() {
  log "arrancando $AVD_NAME sin ventana"
  "$EMULATOR_BIN" -avd "$AVD_NAME" \
    -no-window -no-audio -no-boot-anim \
    -gpu swiftshader_indirect \
    -accel auto \
    > "${TEMP:-/tmp}/emulator-$AVD_NAME.log" 2>&1 &
  echo $! > "${TEMP:-/tmp}/emulator-$AVD_NAME.pid"
  log "PID $(cat "${TEMP:-/tmp}/emulator-$AVD_NAME.pid"); log en ${TEMP:-/tmp}/emulator-$AVD_NAME.log"
}

# Espera a que el dispositivo aparezca y termine de arrancar Android (no solo
# que exista el proceso: sys.boot_completed es lo único confiable). Sin esto,
# instalar un APK justo después del arranque falla con "device offline".
esperar_arranque() {
  local intentos="${1:-120}"
  log "esperando a que el dispositivo aparezca (adb wait-for-device)"
  "$ADB" wait-for-device
  log "esperando sys.boot_completed=1"
  for _ in $(seq 1 "$intentos"); do
    estado="$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    [ "$estado" = "1" ] && { log "arrancó"; return 0; }
    sleep 2
  done
  echo "el emulador no terminó de arrancar a tiempo" >&2
  return 1
}

# Instala un APK (reemplazando una instalación previa con -r).
instalar() {
  local apk="$1"
  log "instalando $apk"
  "$ADB" install -r "$apk"
}

# Abre la app por su paquete (equivalente a tocar el ícono: un solo evento
# "monkey" que dispara el launcher, sin depender de conocer el Activity
# principal).
abrir() {
  local pkg="${1:-$RAIZ_PKG}"
  log "abriendo $pkg"
  "$ADB" shell monkey -p "$pkg" 1
}

# Toca la pantalla en coordenadas x y (en píxeles, según la resolución del
# AVD: 1080x2400 en raiz_pixel).
tocar() {
  local x="$1" y="$2"
  "$ADB" shell input tap "$x" "$y"
}

# Escribe texto con el teclado en pantalla. `adb shell input text` no acepta
# espacios literales: hay que mandarlos como %s.
escribir() {
  local texto="$1"
  "$ADB" shell input text "${texto// /%s}"
}

# Botón atrás (KEYCODE_BACK = 4).
atras() {
  "$ADB" shell input keyevent 4
}

# Toma una captura de pantalla y la guarda en la ruta dada (PNG).
captura() {
  local destino="${1:-captura.png}"
  "$ADB" exec-out screencap -p > "$destino"
  log "captura guardada en $destino"
}

# Apaga el emulador (adb emu kill es más limpio que matar el proceso: le
# avisa al AVD que cierre en vez de dejarlo en un estado inconsistente).
apagar() {
  log "apagando $AVD_NAME"
  "$ADB" -s emulator-5554 emu kill 2>/dev/null || true
}

# Si se invoca directo (no con `source`), se llama a la función pedida por
# nombre con el resto de los argumentos.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  cmd="${1:-}"
  shift || true
  case "$cmd" in
    iniciar|esperar_arranque|instalar|abrir|tocar|escribir|atras|captura|apagar)
      "$cmd" "$@"
      ;;
    *)
      echo "uso: $0 {iniciar|esperar_arranque|instalar|abrir|tocar|escribir|atras|captura|apagar} [args]" >&2
      exit 1
      ;;
  esac
fi
