# Referencias para el rediseño del onboarding

Investigación previa al rediseño de `src/screens/OnboardingScreen.js` (septiembre
2026). Búsqueda con WebSearch/WebFetch sobre apps de bienestar mental
reconocidas y guías de UX de onboarding móvil. Resume solo lo que se aplicó al
diseño final; no es un resumen exhaustivo de cada fuente.

## Qué funciona (8-12 puntos aplicados)

1. **Aprender haciendo, no leer.** Los recorridos interactivos ("learn by
   doing") funcionan mejor que las tarjetas pasivas para flujos que la persona
   va a usar de verdad — NN/g recomienda reservarlos para lo genuinamente
   nuevo, y que el resto del contenido sea breve y opcional. Por eso el paso
   de ánimo deja tocar una cara de `MoodFace` real en vez de describir el
   check-in con texto.
2. **Personalización de contenido, no de diseño.** NN/g distingue entre
   personalizar contenido (bueno: preguntar idioma, nivel, objetivo) y
   personalizar apariencia (evitar: la gente se queda con lo que viene por
   defecto). El paso de "qué te gustaría trabajar" pregunta contenido
   (categorías de bienestar), no colores ni layout.
3. **Máximo 3-5 pantallas.** Cada pantalla adicional mide una caída de
   finalización. Se mantuvo el flujo en 6 pasos cortos (antes 3, pero mucho
   más delgados en contenido cada uno) en vez de agregar más texto por paso.
4. **Mostrar valor rápido, no promocionar funciones.** NN/g desaconseja la
   "promoción de funciones" al lanzar la app — mejor demostrar con datos de
   ejemplo. Por eso el diario y la comunidad se explican con una tarjeta de
   ejemplo real (marcada como tal), no con una lista de bullets de lo que
   "se puede hacer".
5. **Personalización breve y anclada a rutinas existentes.** Headspace usa
   solo 3 preguntas (~1 minuto) y ancla el hábito a rutinas ya existentes en
   vez de pedir un horario exacto. El paso de enfoque de Raíz es opcional, de
   un toque por opción, sin formularios.
6. **Tono cálido, no clínico ni comercial.** Los análisis de apps de salud
   mental coinciden en que un tono "frío-clínico" o "empujón comercial"
   ahuyenda por igual — el onboarding es el primer momento de confianza. El
   copy nuevo evita jerga clínica y evita prometer lo que la app no hace
   (igual que ya exige `tests/i18n.test.mjs` para `privacyBody`).
7. **Progreso visible.** Un indicador de avance (barra o puntos) reduce la
   sensación de flujo interminable — se implementó con una barra segmentada
   animada con `Animated`, no solo puntos estáticos.
8. **Saltar siempre visible.** Video de NN/g "Onboarding: Skip it When
   Possible" — quien ya conoce el patrón (o vuelve a instalar) necesita una
   salida inmediata. El botón "Saltar" queda fijo en la esquina superior en
   los 6 pasos, no solo en el primero.
9. **Explicar privacidad en concreto, no en abstracto.** En vez de una
   promesa genérica ("tus datos están seguros"), se muestra qué pasa con una
   entrada real de ejemplo (guardada en el teléfono, sincronizada, nadie más
   la lee) — el patrón que recomiendan las guías de apps de salud mental:
   explicar qué se recopila y hasta dónde llega, en el momento en que
   importa.
10. **Pedir permisos en contexto, no todos al inicio.** Principio general de
    onboarding 2026 (Eleken, VWO, UXCam): los permisos deben pedirse cuando el
    usuario ya entiende por qué se necesitan. Raíz no pide notificaciones ni
    otros permisos del sistema en el onboarding — el SOS y el resto de la app
    los piden más adelante si aplica, así el onboarding no se siente como un
    interrogatorio antes de ver nada.
11. **Cierre con llamada a la acción clara.** Headspace termina su secuencia
    con un resumen y una acción clara para empezar. El último paso de Raíz
    resume brevemente lo elegido en personalización y termina con un botón
    "Empezar" que lleva a Login, sin pasos extra.
12. **Probar primero si hace falta onboarding, y no repetirlo.** NN/g sugiere
    probar la app sin onboarding para quien vuelve. Raíz ya no lo repite si
    la persona lo completó una vez (bandera en AsyncStorage), y solo insiste
    si nunca hubo sesión ni onboarding completado.

## Fuentes

- [Mobile-App Onboarding: An Analysis of Components and Techniques — NN/g](https://www.nngroup.com/articles/mobile-app-onboarding/)
- [Onboarding: Skip it When Possible (Video) — NN/g](https://www.nngroup.com/videos/onboarding-skip-it-when-possible/)
- [Headspace's mindful onboarding sequence — GoodUX / Appcues](https://goodux.appcues.com/blog/headspaces-mindful-onboarding-sequence)
- [Product Teardown — Headspace: User onboarding personalisation](https://tearthemdown.medium.com/product-teardown-headspace-user-onboarding-personalisation-b6effd0df1d7)
- [Calm Onboarding Design: 10 Recorded Screens Explained](https://screensdesign.com/articles/calm-onboarding-design/)
- [Wellness App Onboarding Flows — Calm, Noom, Headspace & More (Figma Community)](https://www.figma.com/community/file/1580362528287435672/wellness-app-onboarding-flows-calm-noom-headspace-more)
- [Mobile App Onboarding Best Practices [2026 Guide] — Eleken](https://www.eleken.co/blog-posts/mobile-app-onboarding-best-practices)
- [The Ultimate Mobile App Onboarding Guide (2026) — VWO](https://vwo.com/blog/mobile-app-onboarding-guide/)
- [12 Apps with Great User Onboarding (2026 Examples) — UXCam](https://uxcam.com/blog/10-apps-with-great-user-onboarding/)

## Cómo se aplicó al flujo final

| Referencia | Dónde quedó en el código |
|---|---|
| Aprender haciendo | Paso "Ánimo": toca una `MoodFace`, ve una vista previa de su registro (`src/screens/OnboardingScreen.js`, paso `mood`) |
| Personalización de contenido, anclada a algo real | Paso "Enfoque": elige entre las 4 categorías que ya existen en Explorar (`live_well`, `relieve_stress`, `relations`, `mindfulness`); se guarda en AsyncStorage y resalta contenido en `src/screens/ExploreScreen.js` |
| Mostrar valor con ejemplo, no promoción | Pasos "Diario" y "Comunidad": tarjetas de ejemplo con texto claramente marcado `(ejemplo)` / `(example)` |
| Progreso visible | Barra segmentada animada con `Animated.timing` en el header del onboarding |
| Saltar siempre visible | Botón fijo en las 6 pantallas, mismo comportamiento que "Empezar" al final |
| Privacidad concreta | Paso "Diario" reutiliza y muestra en contexto el mismo texto que ya prueba `tests/i18n.test.mjs` (`privacyBody`) |
| Sin permisos por adelantado | El onboarding no llama a ninguna API del sistema (notificaciones, ubicación, etc.) |
| No repetir si ya se vio | Bandera `raiz.onboarded.v1` en AsyncStorage, leída por `SplashScreen.js` vía `decideSplashRoute` (`src/lib/onboarding.js`) |
