# Investigación de competencia — Raíz (bienestar mental, estudiantes UPB Bucaramanga)

Fecha de investigación: 2026-09-26
Método: búsqueda web (sitios oficiales, App Store/Play Store, prensa, guías de seguridad, estudios) sobre apps de apoyo entre pares, registro/acompañamiento y salud mental universitaria. No se auditó el código de Raíz en este documento (esa auditoría la hace otro agente en paralelo).

---

## 1. Resumen ejecutivo

Raíz ya cubre bien el núcleo "individual" (check-in, diario privado, progreso/rachas, bienestar) y tiene un modelo de comunidad anónima con moderación automática + revisión humana que es más seguro por diseño que la mayoría de apps de apoyo entre pares genéricas (TalkLife, Vent), porque **no tiene mensajería privada abierta**, que es precisamente el punto donde esas apps fallan de forma documentada (acoso, intentos de grooming, contenido dañino sin supervisión suficiente).

Los competidores más maduros se dividen en tres arquetipos:

1. **Apoyo entre pares abierto** (TalkLife, Vent, 7 Cups, Wisdo): comunidad + algún tipo de mensajería 1:1, con moderación automática + humana de calidad muy desigual. TalkLife y Vent (mismo creador) tienen historiales públicos de acoso y fallas de moderación pese a tener reglas escritas robustas. 7 Cups y Wisdo son más seguros porque limitan quién puede escribir a quién (solo con un "listener"/"helper" entrenado, no entre miembros).
2. **Registro y acompañamiento personal** (How We Feel, Daylio, Finch, Bearable, Wysa, Headspace, Calm): sin comunidad (o casi), fuertes en personalización, notificaciones inteligentes y gamificación sin castigo (Finch). Son el benchmark de retención y de "qué se siente pulido" en un producto de bienestar.
3. **Salud mental universitaria** (Togetherall, TimelyCare, YOU at College): el segmento más comparable a Raíz. Togetherall es el caso más relevante: comunidad anónima moderada por profesionales licenciados ("Wall Guides") 24/7, sin mensajería privada entre pares, con más de 350 universidades como clientes institucionales. TimelyCare y YOU at College resuelven el acceso a un profesional real (algo que Raíz no tiene) pero no tienen comunidad anónima entre estudiantes.

No se encontró un competidor directo, independiente y de uso público que combine exactamente lo que hace Raíz (check-in + diario + comunidad anónima + bienestar + SOS local) para el contexto universitario colombiano. Sí existen esfuerzos institucionales nacionales (plataforma "Bienestar en tu Mente" del Ministerio de Educación/Salud, la app "EstarBien" de Uninorte) y un chatbot de IA en español muy popular en la región (Yana), pero ninguno reproduce el modelo de comunidad anónima moderada de Raíz. (Nota: una búsqueda arrojó una descripción de "una app de bienestar para estudiantes de la UPB Bucaramanga con check-ins diarios y comunidad anónima" — esto corresponde casi con certeza a Raíz mismo o a un proyecto académico relacionado, no a un competidor externo, y se excluyó del análisis para no auto-referenciar el hallazgo.)

Las brechas de mayor impacto para Raíz son, en orden: (1) notificaciones push personalizadas, (2) un puente de derivación real hacia un profesional (aunque sea vía convenio con Bienestar Universitario UPB o líneas 106/123, no un servicio de telesalud propio), (3) verificación institucional (correo UPB) para reforzar confianza sin sacrificar el anonimato del alias, y (4) una capa de mentoría por pares moderada (no mensajería abierta) inspirada en el modelo Wisdo/7 Cups/Togetherall.

---

## 2. Tabla comparativa de funciones

### 2.1 Apoyo entre pares / comunidad

| Función | **Raíz** | TalkLife | Vent | 7 Cups | Wisdo | Togetherall |
|---|---|---|---|---|---|---|
| Propuesta de valor | Bienestar integral universitario: check-in + diario + comunidad + SOS | Red social de apoyo entre pares 24/7, global | "Diario social" para desahogarse de forma anónima | Apoyo emocional gratuito por "listeners" voluntarios + terapia de pago | Comunidad + coaching por temas de vida específicos | Comunidad anónima clínicamente moderada, contratada por universidades |
| Comunidad anónima | Sí, por defecto, con alias y perfil público opcional | Sí, con perfil/alias | Sí, totalmente anónimo | Parcial (perfil de miembro, no expone identidad real) | Opcional (usuario elige anonimato) | Sí, obligatorio (usuario crea alias, no hay nombre real) |
| Mensajería privada 1:1 entre pares | **No tiene** | Sí, se desbloquea tras participar en la comunidad; 1er mensaje previsualizable/ignorable; 1ª imagen difuminada | Sí, con pocos controles de seguridad documentados | **No** entre miembros; solo miembro↔listener entrenado | Sí, con "helper" entrenado o profesional ("guide") | **No** entre miembros; toda interacción es en el "wall" moderado |
| Detección de crisis en mensajes | Sí (en publicaciones, vía moderación automática) | IA + equipo humano en tiempo real | Moderación reactiva (solo por reporte) | Sí: si el texto sugiere riesgo, no llega al listener; se redirige a línea de crisis | IA de tono emocional + intervención de seguridad | Wall Guides (profesionales licenciados) monitorean 24/7 |
| Moderación | Automática + revisión humana para crisis/acoso/datos personales | IA + equipo global de confianza y seguridad | Solo por reporte de usuarios | Moderadores + evaluaciones "cliente incógnito" semanales a listeners | Equipo de moderación + IA, monitoreo 24/7 | Profesionales licenciados ("Wall Guides") en vivo |
| Reportes/bloqueos | Sí, con umbral | Sí, con derecho a apelación | Sí, básico | Sí; el bloqueo genera copia de reporte al equipo | Sí | Sí |
| Notificaciones push | **No tiene** | Sí | Sí | Sí | Sí | Limitadas (modelo institucional) |
| Acceso a profesional | No (deriva a SOS/líneas) | No | No | Sí, de pago (terapia) | Sí, "guide"/supervisor de pago | Indirecto (referidos por la universidad) |
| Reseñas — fortaleza | — | Alcance global, controles de mensajería inicial pensados | Facilidad de desahogo anónimo | Disponibilidad 24/7, entrenamiento formal de listeners | Sin anuncios, no vende datos, grupos por tema muy específicos | Respaldo clínico real, confianza institucional |
| Reseñas — debilidad | — | Acoso y comportamiento predatorio reportado pese a las reglas; caídas/errores técnicos | Muy pocos controles efectivos; amenazas y acoso documentados; señalada como riesgosa para menores por organismos de seguridad escolar en el Reino Unido | Respuestas de listeners percibidas como genéricas/robóticas; casos de listeners insistiendo en contacto por redes sociales o vendiendo coaching | Cambio a modelo de pago generó quejas de usuarios que la conocieron gratis | Poca evidencia pública de críticas mayores; el modelo depende de que la universidad pague la licencia |

### 2.2 Registro y acompañamiento personal

| Función | **Raíz** | How We Feel | Daylio | Finch | Bearable | Wysa | Headspace / Calm |
|---|---|---|---|---|---|---|---|
| Propuesta de valor | Check-in de ánimo + diario + progreso | Vocabulario emocional preciso (Yale) | Registro de ánimo sin escribir | Mascota virtual que premia el autocuidado | Correlaciones entre síntomas y hábitos | Chatbot de IA con TCC | Meditación/mindfulness con curación experta |
| Check-in de ánimo | Sí (emociones + causas) | Sí (rueda de 150+ emociones) | Sí (2 toques) | Sí | Sí (sin límite de variables) | Conversacional | No es el foco |
| Diario | Sí, privado, preguntas guiadas | Journaling con insights de IA | Notas/fotos/voz opcionales | Bullet journal guiado | No | Conversacional | No |
| Comunidad | Sí (aparte) | **No** | **No** | **No** (single-player) | **No** | **No** | Prácticamente no (contenido, no social) |
| Gamificación / rachas | Sí (rachas) | No | Sí (rachas, "Year in Pixels") | Sí, sin castigo por fallar (filosofía "auto-compasión") | No | No | Rachas + comunidad (ej. Insight Timer) |
| Notificaciones push | **No tiene** | Sí | Sí | Sí | Sí | Sí | Sí, cada vez más personalizadas con datos de salud (2025-2026) |
| Personalización | Insights de progreso | Recomendaciones por emoción registrada | Estadísticas y correlaciones personalizadas | Rutinas y logros adaptados | Reportes de correlación/triggers | Herramientas sugeridas por conversación | Recomendaciones por datos biométricos (reloj) |
| Modelo de negocio | Institucional (UPB) | Gratis, sin anuncios, sin pago (ONG) | Freemium (US$4.99/mes) | Freemium | Freemium (US$34.99/año) | Freemium + coaching humano de pago | Suscripción; acceso corporativo (Headspace cierra este canal en jul-2026) |
| Reseñas — fortaleza | — | Gratis para siempre, sin publicidad, respaldo científico | Rapidísimo de usar, datos guardados localmente, muy alta calificación (4.8/4.8) | Retiene sin culpa ni castigo; ideal para gente ansiosa | Muy buena para encontrar patrones/triggers | Único chatbot evaluado con los 5 tipos de soporte en crisis | Contenido validado científicamente, alta producción |
| Reseñas — debilidad | — | Menos útil si se busca comunidad | No ideal para quien prefiere escribir mucho | Nula función social | Sin comunidad ni coaching | Respuestas percibidas como genéricas; no apta para crisis/casos severos (lo dice la propia app) | Poca personalización de comunidad; cambios de modelo de negocio generan fricción |

### 2.3 Salud mental universitaria (comparación más directa con Raíz)

| Función | **Raíz** | Togetherall | TimelyCare | YOU at College | Yana (referente LatAm) |
|---|---|---|---|---|---|
| Comunidad anónima | Sí | Sí (con moderación clínica) | No | No | No (es 1:1 con chatbot) |
| Mensajería privada entre estudiantes | No | No (todo es en el "wall" moderado) | No aplica | No | No aplica |
| Acceso a profesional/telesalud | No | Indirecto (referidos) | **Sí**, on-demand (~4-10 min) y agendado, filtrable por especialidad/idioma/género | No (deriva a consejería del campus) | No |
| Línea de crisis integrada | Sí (106, 123) | Recursos de la institución | **Sí**, línea propia 24/7 (CrisisNow) integrada institucionalmente | Deriva a servicios del campus | Deriva a recursos generales |
| Modelo de acceso | App para toda la comunidad UPB | B2B2C: la universidad paga la licencia, gratis para el estudiante | B2B2C: convenio con la universidad | B2B2C, contenido personalizado por campus | App pública, freemium |
| Idioma/contexto local | Español, contexto UPB/Colombia | Inglés, contexto EE.UU./Reino Unido | Inglés, EE.UU. | Inglés, EE.UU. | Español, LatAm genérico |
| Reseñas — fortaleza | — | Respaldo clínico real, 4.5M estudiantes en +350 universidades | Alta satisfacción de estudiantes (4.9★ en App Store), conexión rápida | Co-diseñada con estudiantes, reduce estigma con lenguaje de "bienestar" | App de salud mental con IA más descargada en español |
| Reseñas — debilidad | — | Depende de contrato institucional; no hay app pública abierta a cualquiera | Terapeutas reportan cargas altas y pagos bajos por "no-show"; puede sentirse impersonal por rotación | Sin comunidad ni seguimiento emocional diario | Como todo chatbot de IA, limitado en crisis reales; no reemplaza comunidad humana |

---

## 3. Fichas breves por competidor

**TalkLife** — Red social de apoyo entre pares fundada en 2012, presente en 125 países con millones de usuarios. Combina posts, comentarios y mensajería privada; el acceso a mensajes se desbloquea tras participar en la comunidad, el primer mensaje de un desconocido puede previsualizarse o ignorarse sin abrirlo, y la primera imagen enviada por otra persona llega difuminada hasta aprobarla. Moderación declarada: IA en tiempo real + equipo global de confianza y seguridad, con controles de usuario (ocultar posts, advertencias de contenido sensible, bloqueo, apelación). Pese a estas reglas escritas, reseñas de padres y usuarios en Common Sense Media y otras fuentes describen un ambiente que se ha vuelto "cada vez más inseguro y tóxico", con acoso y comportamiento predatorio hacia usuarios vulnerables, además de problemas técnicos (caídas, lentitud) y señales internas de inestabilidad corporativa (despidos sin transparencia en 2024-2025).

**Vent** — Creada por la misma empresa que TalkLife, es una app de "diario social" 100% anónimo organizado por comunidades temáticas. Tiene muy pocos controles de seguridad efectivos: la moderación depende casi enteramente de que los propios usuarios reporten contenido. Organismos de seguridad escolar del Reino Unido (Safer Schools, Ineqe) la señalaron explícitamente como riesgosa, documentando casos de amenazas de muerte, acoso por neurodivergencia y por fe religiosa, y recomendando bloquearla en redes escolares.

**7 Cups** — Plataforma freemium de apoyo emocional con "listeners" voluntarios (entrenamiento de 30-60 min + examen) y terapia profesional de pago. Diseño clave de seguridad: **los miembros no pueden escribirse entre sí**, solo pueden chatear con un listener asignado; si el texto de un miembro sugiere riesgo suicida/homicida, ese contenido no llega al listener y la persona es redirigida de inmediato a la línea de crisis correspondiente. Los listeners son evaluados semanalmente con un esquema tipo "cliente incógnito". Aun así, hay críticas serias: respuestas percibidas como genéricas o robóticas, señalamientos éticos por matchear usuarios con "terapeutas" no licenciados en su estado, una controversia de 2025 por crear perfiles de terapeutas sin su consentimiento, y reportes de listeners que intentan vender coaching o pedir contacto por redes sociales a usuarios vulnerables.

**Wisdo** — Comunidad de apoyo por "situaciones de vida" (duelo, ansiedad, carrera, etc.) con más de 70 grupos temáticos. Permite chats privados con un "helper" (par entrenado) o un profesional ("guide"/supervisor), además de sesiones grupales en video. Usa IA para moderación de contenido y detección de tono emocional, con monitoreo 24/7 y política explícita de no vender datos ni mostrar publicidad. Fue adquirida por Talkspace en 2023. Su principal fricción reportada por usuarios es haber empezado a cobrar por funciones que antes eran gratuitas.

**Reddit (r/mentalhealth, como referencia de moderación)** — No es una app dedicada, pero su modelo de moderación es relevante: bots como AutoModerator automatizan acciones (filtro de acoso, "crowd control", filtro de evasión de baneos) y cada subreddit define sus propias reglas, aplicadas por moderadores voluntarios (a veces con experiencia vivida, no necesariamente profesionales). En 2020 Reddit se asoció con Crisis Text Line: cualquier usuario puede "marcar" una publicación de otra persona que parezca estar en crisis, y esa persona recibe automáticamente un mensaje privado con recursos y la opción de conectarse con un consejero de crisis, sin exponer quién hizo el reporte. Este patrón de "marcador de confianza que dispara un mensaje automatizado de recursos" es replicable en Raíz sin necesitar mensajería abierta entre usuarios.

**How We Feel** — App sin fines de lucro, gratis para siempre y sin publicidad, desarrollada con el Centro de Inteligencia Emocional de Yale (Dr. Marc Brackett). Su fuerza es el vocabulario emocional preciso (más de 150 palabras en un "medidor de ánimo" de cuatro cuadrantes) y estrategias en video corto por emoción registrada. No tiene ningún componente social ni de comunidad.

**Daylio** — Registro de ánimo y actividades sin necesidad de escribir (dos toques, menos de 30 segundos), con estadísticas de correlación, rachas y la vista "Year in Pixels". Guarda los datos localmente por defecto (no los sube a un servidor salvo que el usuario pague sincronización), lo cual es un fuerte argumento de privacidad. Calificaciones muy altas (4.8/5 en ambas tiendas). No tiene comunidad.

**Finch** — Compañero virtual (un pájaro) que gana monedas y accesorios cuando el usuario completa tareas reales de autocuidado (metas, journaling guiado, respiración, seguimiento de ánimo, cuestionarios periódicos de ansiedad/depresión/imagen corporal). Su diferenciador es la filosofía "sin castigo": si el usuario falla o se ausenta, el pájaro simplemente "espera pacientemente" en vez de penalizar, a diferencia de apps de gamificación competitiva. No tiene comunidad ni ranking social.

**Bearable** — Rastreador de síntomas/ánimo/medicación orientado a encontrar correlaciones y factores desencadenantes (sueño, alimentación, clima, estrés, hábitos). Totalmente personalizable en qué se rastrea. No tiene comunidad ni coaching.

**Wysa** — Chatbot de IA basado en terapia cognitivo-conductual. Un estudio la identificó como la única app de tipo chatbot que cubre los 5 tipos de soporte en crisis (información, herramientas de autoayuda, acceso a profesional, detección de crisis en el chat, y notificación a personal designado). Aun así, la propia app advierte que no es apta para crisis ni para condiciones severas. En 2024 lanzó "Wysa Copilot", un modelo híbrido IA + terapeuta adoptado por el NHS británico. Críticas académicas señalan que chatbots como Wysa pueden ser percibidos como poco auténticos o "poco éticos" en su promesa de empatía, y que los usuarios valoran la disponibilidad 24/7 pero extrañan la interacción humana.

**Headspace / Calm** — Líderes en meditación y mindfulness con contenido curado científicamente. La tendencia 2025-2026 en este segmento es la personalización basada en datos de salud (ej. notificaciones de respiración disparadas por frecuencia cardíaca alta detectada en un reloj inteligente) y el uso de rachas/comunidad para retención (ej. Insight Timer, con ~16% de retención a 30 días como referencia de mercado). Headspace cerrará el canal de acceso corporativo/patrocinado por empleadores en julio de 2026, señal de un modelo de negocio en ajuste. Ninguna de las dos tiene comunidad de apoyo entre pares.

**Togetherall (antes Big White Wall)** — El competidor institucional más parecido a Raíz. Comunidad anónima (el usuario crea un alias sin datos que lo identifiquen) moderada en vivo, las 24 horas, por profesionales licenciados llamados "Wall Guides". Desde 2007 da servicio a 4.5 millones de estudiantes en más de 350 universidades. **No existe mensajería privada entre miembros**: toda la interacción ocurre en el "wall" (muro) público/pseudónimo de la comunidad, lo que elimina estructuralmente el vector de riesgo que sí tienen TalkLife y Vent. El modelo de negocio es B2B2C: la universidad paga la licencia y el estudiante lo usa gratis. No se encontraron críticas públicas relevantes sobre fallas de seguridad, aunque tampoco hay una app pública para comparar reseñas de tienda como con las demás.

**TimelyCare** — Telesalud para universidades en EE. UU.: conexión on-demand a un profesional con maestría en ~4-10 minutos ("TalkNow"), consejería agendada filtrable por especialidad/idioma/género/raza del proveedor, y una línea de crisis institucional 24/7 ("CrisisNow") que no requiere registro previo. Muy bien calificada por estudiantes (4.9★), aunque reseñas de terapeutas (Glassdoor) describen alta rotación, cargas de trabajo pesadas y pagos bajos quitando calidad al servicio. No tiene comunidad ni diario/check-in.

**YOU at College** — Plataforma de contenido y autoevaluaciones (no terapia) organizada en tres pilares: éxito académico, "prosperar" (salud mental/física) y "sentido de pertenencia" ("matter"). Personalizada por campus, co-diseñada con estudiantes, con un enfoque deliberado en reducir el estigma usando el lenguaje de "bienestar" en vez de "enfermedad mental". No tiene comunidad entre estudiantes ni seguimiento emocional diario; dirige a consejería del campus cuando corresponde.

**Yana** — Chatbot de IA basado en TCC, con diario emocional, "baúl de gratitud" y rutinas personalizadas; se posiciona como la app de salud mental con IA más descargada en el mundo hispanohablante. No tiene comunidad entre usuarios ni mensajería; su límite principal (como todo chatbot) es la falta de conexión humana real y de manejo robusto de crisis severas.

**Contexto institucional colombiano** — El Ministerio de Educación y el Ministerio de Salud impulsan la plataforma "Bienestar en tu Mente" (recursos y orientaciones para IES colombianas) y universidades individuales han lanzado herramientas propias (ej. "EstarBien" de Uninorte, con acceso directo a líneas de emergencia). Ninguna de estas iniciativas reportadas reproduce el modelo de comunidad anónima con moderación automática + humana que ya tiene Raíz.

---

## 4. Mensajes privados en apps de salud mental: patrones, riesgos y recomendación

### 4.1 Patrones observados (de más riesgoso a más seguro)

1. **DM abierto entre cualquier miembro, con pocos controles** (Vent): moderación 100% reactiva (solo por reporte). Resultado documentado: amenazas de muerte, acoso dirigido por identidad/fe, señalamiento explícito por organismos de seguridad escolar del Reino Unido como app a bloquear para menores.
2. **DM abierto pero con fricción de entrada** (TalkLife): se desbloquea tras participar en la comunidad; primer mensaje previsualizable sin comprometerse a abrirlo; primera imagen difuminada hasta aprobarla; IA + equipo humano monitorea. Reduce pero **no elimina** el problema: sigue habiendo reportes consistentes de acoso y conducta predatoria en reseñas de usuarios/padres, lo que sugiere que la fricción de entrada y la IA de moderación no bastan por sí solas a la escala de una red social abierta.
3. **DM solo hacia un rol entrenado y supervisado, nunca entre pares comunes** (7 Cups: miembro↔listener; Wisdo: miembro↔helper/guide): el texto de riesgo se filtra antes de llegar al humano y se redirige a una línea de crisis; hay evaluación de calidad tipo "cliente incógnito"; el bloqueo genera automáticamente un reporte para el equipo. Aun con este diseño más seguro, persisten incidentes (listeners intentando pasar el contacto a redes sociales externas, venta de servicios) porque el canal 1:1 privado sigue existiendo, solo que con menos gente autorizada a usarlo.
4. **Sin mensajería privada entre miembros en absoluto** (Togetherall, y hoy Raíz): toda la interacción social ocurre en un espacio moderado en vivo (público o pseudónimo). Es el diseño que elimina de raíz el vector de riesgo más citado en la literatura de seguridad infantil/adolescente: la app de mensajería privada facilita el aislamiento del contacto respecto del resto de la comunidad, lo que dificulta que un moderador o un tercero note un patrón de manipulación o acoso a tiempo. Reportes de NSPCC/Thorn documentan que buena parte del grooming ocurre precisamente cuando la conversación migra de un espacio público a uno privado 1:1.

### 4.2 Riesgos documentados de la mensajería privada en contextos de vulnerabilidad emocional

- Migración de lo público a lo privado como táctica: gran parte de los contactos de riesgo comienzan en un espacio público y buscan mover la conversación a un canal privado para reducir la supervisión.
- Falsa sensación de privacidad/mensajes efímeros: incentiva compartir contenido que la persona no compartiría en un espacio visible, y dificulta que terceros detecten abuso.
- Explotación de la vulnerabilidad emocional: en 7 Cups se documentaron casos de personas en rol de "ayuda" que aprovechan la confianza para pedir contacto externo o vender servicios a usuarios que llegaron buscando apoyo emocional, precisamente el perfil de usuario más susceptible a manipulación.
- Dificultad de moderar a escala: TalkLife tiene reglas y tecnología de moderación relativamente sofisticadas y aun así no logra evitar que usuarios (según reseñas de padres) describan la plataforma como "cada vez más tóxica"; esto sugiere que ningún nivel de reglas escritas sustituye el rediseño estructural del canal.

### 4.3 Recomendación de diseño concreta para Raíz

Dado que Raíz hoy **no tiene mensajería privada** y ese es probablemente su mayor activo de seguridad frente a TalkLife/Vent, la recomendación es **no abrir DM libre entre estudiantes**. Si se quiere capturar el valor de "conexión más profunda" que ofrecen Wisdo/7 Cups/Togetherall sin heredar sus riesgos, se propone un modelo de mensajería **acotado y mediado**, no un DM social genérico:

1. **Quién puede escribir a quién**: no member-to-member por defecto. Introducir, si acaso, un canal de "mentoría por pares" moderado, similar a 7 Cups/Wisdo: estudiantes de psicología de la UPB (practicantes/servicio social, supervisados) como únicos habilitados para iniciar conversación 1:1 con quien lo solicite desde la comunidad o desde una alerta de riesgo medio. Nunca member↔member anónimo abierto.
2. **Solicitudes, no chats directos instantáneos**: toda conversación nace como una "solicitud de acompañamiento" que el estudiante debe aceptar explícitamente; el primer mensaje del mentor puede preverse sin comprometerse a responder (como el patrón de TalkLife), y no se revela nunca información identificable real de ninguna de las partes (se mantiene el alias).
3. **Filtros automáticos antes de entrega**: cada mensaje pasa por el mismo pipeline de moderación automática que ya usa Raíz para publicaciones (detección de riesgo de crisis, acoso, datos personales) *antes* de llegar al destinatario. Si el sistema detecta lenguaje de crisis, el mensaje no se entrega tal cual: se interrumpe el envío y se muestra al usuario la pantalla de SOS (106/123), replicando el patrón de 7 Cups donde el texto de riesgo nunca llega "en crudo" al otro lado, y se genera automáticamente un caso para revisión humana (patrón Reddit + Crisis Text Line: notificar sin exponer quién reportó).
4. **Límites de frecuencia**: tope diario de mensajes nuevos que una cuenta puede iniciar y de destinatarios distintos por día (ej. máximo 1-2 hilos nuevos/día para cuentas nuevas, límites más altos para mentores verificados), para frenar tanto el spam como el patrón de "barrido" de contactos que caracteriza el acoso a escala en TalkLife/Vent.
5. **Qué ve el moderador y con qué límite de privacidad**: el moderador humano **no** tiene acceso de lectura libre a todas las conversaciones. Solo ve el contenido de un hilo cuando (a) el sistema automático lo marca por riesgo, o (b) alguna de las partes lo reporta; y en ese caso ve únicamente el mensaje reportado más un margen acotado de contexto inmediato (p. ej. los 2-3 mensajes anteriores/posteriores), no el historial completo. Los mensajes no marcados ni reportados se purgan tras una ventana de retención corta (ej. 30-90 días) para acotar la exposición de privacidad, y la app debe declarar explícitamente que los mensajes **no son cifrados de extremo a extremo** ni "privados" en sentido absoluto —se escanean automáticamente por seguridad—, igual que hacen TalkLife y 7 Cups en sus políticas.
6. **Reportes y bloqueo en un toque**: cada mensaje debe tener botón de reporte con categorías específicas (crisis, acoso, datos personales, contenido sexual, spam/venta de servicios —el problema documentado en 7 Cups—), y el bloqueo debe generar automáticamente una copia para el equipo de confianza y seguridad, como hace 7 Cups.
7. **Opt-in explícito y apagado global**: la mensajería debe ser una función que el estudiante activa conscientemente (no un DM abierto por defecto al crear la cuenta), con un interruptor único "no recibir mensajes" en cualquier momento.

En síntesis: el diseño más seguro documentado en la competencia no es "DM con buenas reglas" (TalkLife) sino "sin DM entre pares, con un rol entrenado y supervisado como único canal 1:1, y contenido siempre escaneable por el moderador" (7 Cups/Wisdo/Togetherall combinados). Esa es la dirección recomendada para Raíz si decide avanzar en este terreno.

---

## 5. Brechas de Raíz priorizadas (impacto para estudiantes UPB/Colombia × esfuerzo)

**Contexto que justifica la prioridad**: en Colombia, 94% de los universitarios reporta múltiples barreras de acceso a atención en salud mental, 32% presenta ideación suicida moderada o alta, 43% muestra riesgo depresivo y 38% tiene diagnóstico confirmado de depresión (estudio nacional 2025, 1.200 estudiantes de 122 IES); en Medellín, el estrés académico explica hasta 64% de los síntomas depresivos reportados. Esto hace que "conectar con ayuda real" y "sostener el uso durante picos de estrés académico (parciales)" sean los ejes de mayor impacto.

### Impacto alto / esfuerzo bajo-medio (hacerlo primero)
- **Notificaciones push personalizadas**: Raíz es la única app revisada, entre las 15 analizadas, sin ningún tipo de notificación push. Daylio, Finch, Headspace, Wysa y Calm dependen de ellas para retención; la tendencia 2025-2026 del sector es personalizarlas con datos de comportamiento (racha en riesgo, patrón de ánimo reciente, semana de parciales). Esfuerzo relativamente bajo dado que Raíz ya recolecta los datos de ánimo/rachas necesarios.
- **Recomendaciones de bienestar basadas en datos ya recolectados**: usar el historial de check-ins/insights para sugerir de forma proactiva un reto, respiración o artículo específico (como hace Headspace/Calm con datos biométricos, pero con lo que Raíz ya tiene: emociones y causas registradas).
- **Verificación institucional (correo UPB)**: sin ser un SSO completo, validar el correo institucional al registrarse refuerza la confianza de la comunidad (evita que personas ajenas a la UPB entren a la comunidad anónima) y diferencia a Raíz de comunidades abiertas globales como TalkLife/Vent, que son más tóxicas justamente por ser abiertas a cualquiera.
- **Puente de derivación visible a Bienestar Universitario UPB y líneas 106/123**: no requiere construir telesalud propia; solo un flujo claro tipo "quiero hablar con alguien real" que muestre horarios/canal de contacto del área de bienestar/psicología de la UPB, imitando lo que hace YOU at College (dirige a consejería del campus) sin necesidad de la infraestructura de TimelyCare.

### Impacto alto / esfuerzo alto (mediano plazo)
- **Capa de mentoría por pares moderada** (ver sección 4.3): valor de conexión humana real sin abrir DM social genérico.
- **Moderadores con formación en psicología/primeros auxilios psicológicos**, tipo "Wall Guide" de Togetherall: hoy Raíz deriva crisis/acoso/datos personales a revisión humana, pero no es público si quienes revisan tienen formación clínica; certificarlos (o usar estudiantes de psicología de la UPB supervisados) eleva la calidad y la defensibilidad del protocolo de crisis.
- **Contenido multimedia guiado** (audio de respiración, video de 5-4-3-2-1): Headspace/Calm ganan por producción audiovisual; Raíz hoy describe artículos con fuentes (texto), lo cual es más liviano de mantener pero menos envolvente.

### Impacto medio / esfuerzo medio
- **Grupos o temas más segmentados dentro de la comunidad** (ej. "primer semestre", "ansiedad por parciales", comunidad LGBTIQ+), inspirado en los grupos temáticos de Wisdo y las "tribus" de Vent, pero manteniendo la moderación centralizada de Raíz.
- **Evolucionar las rachas hacia un modelo "sin castigo"** al estilo Finch (en vez de solo premiar la constancia, evitar que romper una racha se sienta como fracaso), que la evidencia de reseñas señala como más sano para usuarios ansiosos.

### Exploratorio / largo plazo
- **IA conversacional de apoyo** (tipo Wysa/Yana) como complemento —nunca reemplazo— del check-in y la comunidad, útil en horarios donde no hay pares ni moderadores activos (madrugada), siempre con detección de crisis que enlace a SOS/106/123 y con las mismas advertencias que usa Wysa sobre no ser apta para crisis severas.
- **Conexión con profesionales/telesalud propia** (tipo TimelyCare): la opción de mayor impacto potencial dado el 94% de barreras de acceso reportado, pero también la de mayor esfuerzo/costo (requiere alianzas clínicas, cumplimiento normativo y probablemente no debería construirse antes que el puente de derivación simple mencionado arriba).

---

## 6. Ideas diferenciadoras que la competencia no hace bien y Raíz podría aprovechar

- **Vender la ausencia de DM abierto como ventaja de seguridad, no como carencia**: ninguno de los competidores de apoyo entre pares de uso masivo y abierto (TalkLife, Vent) ha resuelto el acoso/grooming en mensajería privada pese a años de iteración en reglas; Raíz puede comunicar explícitamente "comunidad anónima sin mensajes privados abiertos" como una elección de diseño de seguridad, algo que hoy nadie en el segmento de apoyo entre pares comunica como diferencial de marketing.
- **Contexto hiperlocal universitario colombiano**: ningún competidor (global o de EE. UU./Reino Unido) cubre la vida universitaria colombiana específica (parciales, matrícula/financiación, ICFES/PAPA, prácticas, adaptación al primer semestre, distancia del hogar, movilidad en Bucaramanga). Es un espacio en blanco frente a TalkLife/Vent/7 Cups (genéricos/globales) y frente a Togetherall/TimelyCare/YOU at College (diseñados para EE. UU./Reino Unido).
- **Moderación culturalmente competente en español colombiano**: Wysa/Yana son IA generalista sin curación humana local, y suelen remitir a líneas de crisis no localizadas (ej. 988 de EE. UU.). Raíz ya combina automoderación con revisión humana y líneas verificadas (106, 123); formalizar y comunicar esa competencia cultural/local es un diferenciador defendible frente a los chatbots regionales.
- **Anticipación al calendario académico UPB**: programar retos/contenido de bienestar preventivo en semanas de parciales o cierre de semestre (cuando el estrés académico explica hasta 64% de los síntomas depresivos reportados en estudios locales), algo que YOU at College hace por campus en EE. UU. pero que no existe para universidades colombianas.
- **Comunidad exclusiva verificada por correo institucional**: reduce trolls externos y aumenta la confianza sin sacrificar el anonimato del alias, algo que TalkLife/Vent no pueden ofrecer al ser globales y abiertas a cualquier persona.
- **Mentoría por pares con estudiantes de psicología de la UPB** (práctica/servicio social) como capa de "guías" moderadores: la mayoría de competidores o no tiene supervisión profesional real (TalkLife, Vent) o la cobra (Wisdo "guide", 7 Cups terapia, Wysa coaching humano). Un modelo ligado a la propia universidad, sin costo para el estudiante, es un diferenciador institucional difícil de replicar para un competidor global.
- **Gamificación compasiva sin comparación social tóxica**: seguir el ejemplo de Finch (sin castigo, sin rankings) al evolucionar el sistema de rachas de Raíz, evitando el efecto ansiógeno de las tablas de posiciones competitivas que sí usan otras apps de hábitos.

---

## 7. Fuentes

**TalkLife**
- https://www.talklife.com/ · https://www.talklife.com/safeguarding · https://www.talklife.com/about · https://www.talklife.com/our-guidelines-new
- https://www.commonsensemedia.org/app-reviews/talklife/user-reviews/adult
- https://apps.apple.com/sa/app/talklife-24-7-peer-support/id449804588
- https://www.glassdoor.com/Reviews/TalkLife-Reviews-E2047204.htm
- https://justuseapp.com/en/app/449804588/talklife-24-7-peer-support/reviews

**Vent**
- https://oursaferschools.co.uk/2023/08/18/vent-app-safeguarding-update/
- https://ineqe.com/2023/08/18/vent-app-safeguarding-update/
- https://gizmodo.com/the-new-secret-spilling-app-vent-is-a-disaster-waitin-1644475071
- https://justuseapp.com/en/app/780298346/vent-express-your-feelings/reviews
- https://medium.com/pen-with-paper/virtual-friend-shoulder-vent-app-review-a-social-media-app-with-mental-health-as-its-central-6a983923fb06

**7 Cups**
- https://www.7cups.com/Documents/SafetyFactsheet/ · https://www.7cups.com/community-guidelines/Safety-Reporting-c97e53621f924398b1db1088c9def307
- https://help.7cups.com/hc/en-us/categories/360002027793-Safety
- https://www.choosingtherapy.com/7-cups-review/
- https://bhbusiness.com/2025/04/18/therapist-criticize-digital-health-app-7-cups-for-creating-profiles-without-permission/
- https://www.complaintsboard.com/7-cups-b136019 · https://www.trustpilot.com/review/www.7cups.com

**Wisdo**
- https://apps.apple.com/us/app/wisdo-someone-to-talk-to/id1273601356
- https://www.mobihealthnews.com/news/talkspace-acquires-wisdo-health-peer-support-platform
- https://wisdo.com/coaching/wisdo-community-guideline
- https://justuseapp.com/en/app/1273601356/wisdo-someone-to-talk-to/reviews

**Reddit / r/mentalhealth**
- https://support.reddithelp.com/hc/en-us/articles/15484439276692-Crisis-management
- https://techcrunch.com/2020/03/05/reddit-partners-and-integrates-with-mental-health-service-crisis-text-line

**How We Feel**
- https://apps.apple.com/us/app/how-we-feel/id1562706384
- https://www.selfpause.com/resources/how-we-feel

**Daylio**
- https://daylio.net/ · https://www.choosingtherapy.com/daylio-app-review/
- https://intuitionlabs.ai/software/telepsychiatry-digital-mental-health/mood-tracking-and-journaling/daylio

**Finch**
- https://www.whistleout.com/CellPhones/Apps/finch-self-care-app-review
- https://slate.com/technology/2026/09/finch-app-self-care-wellness-review.html
- https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/

**Bearable**
- https://bearable.app/ · https://www.choosingtherapy.com/bearable-app-review/

**Wysa**
- https://blogs.wysa.io/blog/research/wysa-found-to-be-only-chatbot-based-mental-health-app-with-5-types-of-crisis-support-for-users
- https://www.wysa.com/faq · https://www.choosingtherapy.com/wysa-app-review/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12234914/

**Headspace / Calm**
- https://en.wikipedia.org/wiki/Headspace_(company)
- https://www.headspace.com/app
- https://editorialge.com/meditation-apps-in-2026/

**Togetherall**
- https://togetherall.com/en-us/ · https://togetherall.com/en-us/mental-health-services/college-students/
- https://uhs.berkeley.edu/mental-health/connect/anonymous-online-peer-support
- https://togetherall.com/en-us/case-studies/the-university-of-texas-at-el-paso-reaching-more-and-different-students-through-clinically-moderated-digital-peer-to-peer-support/

**TimelyCare**
- https://timelycare.com/mental-health/ · https://timelycare.com/crisis-line/
- https://dailynorthwestern.com/2022/10/19/lateststories/students-react-to-virtual-mental-health-service-timelycare/
- https://www.glassdoor.com/Reviews/Employee-Review-TimelyCare-E3969803-RVW100177391.htm

**YOU at College**
- https://youatcollege.com/higher-education-wellbeing-products/you-for-students/
- https://www.insidehighered.com/news/2018/10/05/colleges-turn-wellness-app-address-student-mental-health

**Yana**
- https://apps.apple.com/es/app/yana-tu-acompa%C3%B1ante-emocional/id1512301453
- https://www.eltiempo.com/tecnosfera/novedades-tecnologia/esta-aplicacion-probara-si-la-ia-puede-ayudar-a-mejorar-la-salud-mental-794084

**Riesgos de mensajería privada / grooming**
- https://www.nspcc.org.uk/about-us/news-opinion/2025/data-shows-how-criminals-are-using-private-messaging-platforms-to-manipulate-and-groom-children/
- https://info.thorn.org/hubfs/Research/2022_Online_Grooming_Report.pdf

**Contexto Colombia**
- https://www.infobae.com/colombia/2025/09/11/94-de-los-universitarios-en-colombia-enfrenta-multiples-barreras-para-la-atencion-en-salud-mental-alerta-ante-aumento-de-suicidios/
- https://www.eltiempo.com/amp/colombia/otras-ciudades/salud-mental-universitaria-en-colombia-en-alerta-estudio-revela-niveles-de-depresion-ansiedad-y-brechas-regionales-en-jovenes-estudiantes-3547863
- https://www.elcolombiano.com/tendencias/estres-academico-salud-mental-universitarios-medellin-PE37118236
- https://www.minsalud.gov.co/salud/publica/salud-mental/Paginas/linea-106.aspx
- https://bogota.gov.co/mi-ciudad/salud/linea-106-para-apoyo-psicologico-y-mas-informacion-en-bogota-este-2025
- https://www.colombiaaprende.edu.co/contenidos/coleccion/bienestar-en-tu-mente
- https://www.uninorte.edu.co/en/web/grupo-prensa/w/estar-bien-la-nueva-app-que-promueve-la-salud-mental-y-el-autocuidado
