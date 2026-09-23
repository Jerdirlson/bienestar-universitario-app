/**
 * Artículos breves de bienestar, bilingües.
 *
 * Reglas de este archivo:
 *  - Cada artículo cita al menos una fuente oficial (OMS/WHO, APA, NHS, NIMH,
 *    MinSalud) con su enlace. Fuentes revisadas el 2026-09-23.
 *  - Nada de diagnósticos: se describe y se sugiere, no se etiqueta.
 *  - NINGÚN teléfono ni recurso de crisis aquí. Los recursos de crisis viven
 *    solo en crisisResources.js (verificados); los artículos llevan a la
 *    pantalla Sos. Hay una prueba que rechaza números de teléfono en este archivo.
 *  - Nada de datos de contacto de la UPB ni de nadie: aún no están verificados.
 *
 * Forma: { id, tone, illus, minutes, sources: [{ name, url }], es, en }
 *   es/en = { title, summary, sections: [{ h?, p?, list? }] }
 */

const SRC = {
  nhsSleep: {
    name: 'NHS · Every Mind Matters — How to fall asleep faster and sleep better',
    url: 'https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/how-to-fall-asleep-faster-and-sleep-better/',
  },
  nhsStress: {
    name: 'NHS · Every Mind Matters — Stress',
    url: 'https://www.nhs.uk/every-mind-matters/mental-health-issues/stress/',
  },
  whoStress: {
    name: 'OMS / WHO — Doing What Matters in Times of Stress',
    url: 'https://www.who.int/publications/i/item/9789240003927',
  },
  nhsAnxiety: {
    name: 'NHS · Every Mind Matters — Anxiety',
    url: 'https://www.nhs.uk/every-mind-matters/mental-health-issues/anxiety/',
  },
  nhsBreathing: {
    name: 'NHS — Breathing exercises for stress',
    url: 'https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/',
  },
  apaProcrastination: {
    name: 'APA — Psychology of procrastination',
    url: 'https://www.apa.org/news/press/releases/2010/04/procrastination',
  },
  apaProcrastinationStudents: {
    name: 'APA — The first step to overcoming procrastination: Know thyself',
    url: 'https://www.apa.org/ed/precollege/psn/2017/01/overcoming-procrastination',
  },
  apaSupport: {
    name: 'APA — Manage stress: Strengthen your support network',
    url: 'https://www.apa.org/topics/stress/manage-social-support',
  },
  nhsLoneliness: {
    name: 'NHS · Every Mind Matters — Loneliness',
    url: 'https://www.nhs.uk/every-mind-matters/lifes-challenges/loneliness/',
  },
  nimhCaring: {
    name: 'NIMH — Caring for Your Mental Health',
    url: 'https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health',
  },
  minsalud106: {
    name: 'MinSalud Colombia — Línea 106',
    url: 'https://www.minsalud.gov.co/salud/publica/salud-mental/Paginas/linea-106.aspx',
  },
  whoMentalHealth: {
    name: 'OMS / WHO — Mental health: strengthening our response',
    url: 'https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response',
  },
  nimh5Steps: {
    name: 'NIMH — 5 Action Steps to Help Someone Having Thoughts of Suicide',
    url: 'https://www.nimh.nih.gov/health/publications/5-action-steps-for-helping-someone-in-emotional-pain/index.shtml',
  },
};

export const ARTICLES = [
  {
    id: 'sleep',
    tone: 'lilac',
    illus: 'sueño',
    minutes: 3,
    sources: [SRC.nhsSleep],
    es: {
      title: 'Dormir mejor en época de clases',
      summary: 'Pequeños hábitos que ayudan a conciliar el sueño y descansar de verdad.',
      sections: [
        { p: 'Cuando hay entregas y parciales, el sueño suele ser lo primero que se sacrifica. Pero dormir bien no es un lujo: ayuda a concentrarte, recordar lo que estudiaste y manejar mejor las emociones. No se trata de hacerlo perfecto, sino de ajustar algunos hábitos.' },
        { h: 'Lo que suele ayudar', list: [
          'Acostarte y levantarte a horas parecidas, también el fin de semana.',
          'Dejar el celular y el computador una hora antes de dormir; la luz de las pantallas dificulta conciliar el sueño.',
          'Escribir lo que te preocupa antes de acostarte para no darle vueltas en la cama.',
          'Un cuarto oscuro, silencioso y fresco.',
          'Evitar cafeína, alcohol y comidas pesadas cerca de la hora de dormir.',
          'Moverte durante el día: la actividad física mejora el descanso.',
        ] },
        { h: 'Si no logras dormir', p: 'Si llevas unos 20 minutos despierto en la cama, levántate y haz algo tranquilo con poca luz (leer, respirar despacio) hasta sentir sueño. Forzarlo suele empeorarlo.' },
        { p: 'Si los problemas de sueño se mantienen varias semanas o afectan tu día a día, vale la pena consultarlo con un profesional de la salud.' },
      ],
    },
    en: {
      title: 'Sleeping better during the semester',
      summary: 'Small habits that help you fall asleep and actually rest.',
      sections: [
        { p: 'With deadlines and exams, sleep is often the first thing to go. But good sleep is not a luxury: it helps you focus, remember what you studied and handle emotions better. It is not about being perfect, just adjusting a few habits.' },
        { h: 'What usually helps', list: [
          'Going to bed and waking up at similar times, weekends included.',
          'Putting your phone and laptop away an hour before bed; screen light makes it harder to fall asleep.',
          'Writing down what worries you before bed so it does not keep you up.',
          'A dark, quiet and cool room.',
          'Avoiding caffeine, alcohol and heavy meals close to bedtime.',
          'Moving during the day: physical activity improves rest.',
        ] },
        { h: 'If you cannot sleep', p: 'If you have been awake in bed for about 20 minutes, get up and do something calm in low light (read, breathe slowly) until you feel sleepy. Forcing it usually makes it worse.' },
        { p: 'If sleep problems last for several weeks or affect your daily life, it is worth talking to a health professional.' },
      ],
    },
  },
  {
    id: 'exam-stress',
    tone: 'sun',
    illus: 'estudios',
    minutes: 4,
    sources: [SRC.nhsStress, SRC.whoStress],
    es: {
      title: 'Estrés de parciales: cómo llevarlo',
      summary: 'El estrés es la reacción del cuerpo a la presión. Estas ideas ayudan a que no te desborde.',
      sections: [
        { p: 'Un poco de estrés puede ayudarte a ponerte en marcha, pero cuando se acumula afecta el ánimo, el cuerpo y las relaciones. Algunas señales: irritabilidad, preocupación constante, dolores de cabeza o de estómago, cambios en cómo comes o duermes.' },
        { h: 'Ideas prácticas', list: [
          'Divide el temario en partes pequeñas y concretas. "Repasar el tema 3" es más fácil de empezar que "estudiar para el parcial".',
          'Planea con tiempo: anota fechas y reparte el estudio en varios días.',
          'Haz pausas cortas y muévete; la actividad física ayuda a liberar tensión.',
          'Habla con alguien de confianza sobre cómo te sientes.',
          'Al final del día, nota algo que salió bien, aunque sea pequeño.',
        ] },
        { h: 'Volver al presente', p: 'La OMS propone, en su guía "Doing What Matters in Times of Stress", practicar unos minutos al día técnicas sencillas para "anclarte" cuando las emociones te arrastran: notar lo que piensas y sientes, volver a tu cuerpo y a lo que te rodea, y reenfocarte en lo que estás haciendo. Los ejercicios de respiración y 5-4-3-2-1 de esta app van en esa línea.' },
      ],
    },
    en: {
      title: 'Exam stress: how to handle it',
      summary: 'Stress is the body\'s reaction to pressure. These ideas help keep it from overwhelming you.',
      sections: [
        { p: 'A little stress can get you moving, but when it builds up it affects your mood, body and relationships. Some signs: irritability, constant worry, headaches or stomach aches, changes in how you eat or sleep.' },
        { h: 'Practical ideas', list: [
          'Split the material into small, concrete pieces. "Review topic 3" is easier to start than "study for the exam".',
          'Plan ahead: write down dates and spread studying over several days.',
          'Take short breaks and move; physical activity helps release tension.',
          'Talk to someone you trust about how you feel.',
          'At the end of the day, notice something that went well, even if small.',
        ] },
        { h: 'Coming back to the present', p: 'In its guide "Doing What Matters in Times of Stress", WHO suggests practising simple techniques for a few minutes a day to "ground" yourself when emotions pull you away: notice your thoughts and feelings, come back to your body and surroundings, and refocus on what you are doing. The breathing and 5-4-3-2-1 exercises in this app follow that idea.' },
      ],
    },
  },
  {
    id: 'anxiety',
    tone: 'sky',
    illus: 'ansiedad',
    minutes: 4,
    sources: [SRC.nhsAnxiety, SRC.nhsBreathing],
    es: {
      title: 'Cuando la ansiedad aparece',
      summary: 'Sentir miedo o inquietud es humano. Hay formas de bajarle el volumen.',
      sections: [
        { p: 'La ansiedad es una sensación de miedo o inquietud que todos vivimos a veces. Puede notarse en el cuerpo (corazón acelerado, tensión, sudor, mareo, malestar de estómago) y en la mente (preocupación, dificultad para concentrarte o dormir). Cuando es muy frecuente o intensa, empieza a interferir con tu vida.' },
        { h: 'Cosas que puedes probar', list: [
          'Respirar despacio: inhalar contando hasta 5 y exhalar contando hasta 5, durante unos minutos. Funciona mejor si lo practicas a diario, no solo en momentos difíciles.',
          'Llevar un registro de cuándo aparece la ansiedad para reconocer qué la dispara. Tu diario en Raíz puede servir.',
          'Reservar un "rato para preocuparte": si surge una preocupación, anótala y déjala para ese momento.',
          'Enfrentar poco a poco las situaciones que evitas, en pasos pequeños.',
          'Traer la atención al presente con los sentidos (el ejercicio 5-4-3-2-1).',
        ] },
        { h: 'Cuándo buscar apoyo', p: 'Si la ansiedad afecta de forma importante tus estudios, tus relaciones o tu día a día, habla con un profesional de la salud. Pedir ayuda funciona y no tienes que esperar a estar "muy mal" para hacerlo.' },
      ],
    },
    en: {
      title: 'When anxiety shows up',
      summary: 'Feeling fear or unease is human. There are ways to turn the volume down.',
      sections: [
        { p: 'Anxiety is a feeling of fear or unease that everyone experiences at times. You may notice it in your body (racing heart, tension, sweating, dizziness, upset stomach) and in your mind (worry, trouble concentrating or sleeping). When it is very frequent or intense, it starts to get in the way of your life.' },
        { h: 'Things you can try', list: [
          'Breathe slowly: in while counting to 5 and out while counting to 5, for a few minutes. It works best if you practise daily, not only in hard moments.',
          'Keep track of when anxiety shows up to recognise what triggers it. Your journal in Raíz can help.',
          'Set a "worry time": when a worry comes up, write it down and save it for that time.',
          'Gradually face the situations you avoid, in small steps.',
          'Bring your attention to the present with your senses (the 5-4-3-2-1 exercise).',
        ] },
        { h: 'When to seek support', p: 'If anxiety significantly affects your studies, relationships or daily life, talk to a health professional. Asking for help works, and you do not have to wait until you feel "really bad".' },
      ],
    },
  },
  {
    id: 'procrastination',
    tone: 'peach',
    illus: 'calendario',
    minutes: 3,
    sources: [SRC.apaProcrastination, SRC.apaProcrastinationStudents],
    es: {
      title: 'Procrastinar no es pereza',
      summary: 'Postergar suele tener que ver con emociones, no con falta de voluntad.',
      sections: [
        { p: 'La mayoría de estudiantes universitarios procrastina en algún momento. Muchas veces no es pereza: evitamos una tarea porque nos genera inseguridad, aburrimiento o miedo a hacerlo mal. Postergar alivia un rato, pero luego suma estrés.' },
        { h: 'Lo que ayuda', list: [
          'Trátate con amabilidad. Según investigaciones citadas por la APA, quienes se perdonaron por haber procrastinado tendieron a procrastinar menos después.',
          'Empieza con algo muy pequeño: cinco minutos, un párrafo, abrir el documento.',
          'Calcula el tiempo con realismo: solemos subestimar lo que toman los proyectos largos. Usa un calendario e incluye también comer, dormir y descansar.',
          'Aprovecha los ratos cortos entre clases para avanzar un poco.',
          'Busca a alguien con quien revisar avances; rendir cuentas a otra persona ayuda.',
          'Aleja las distracciones mientras trabajas (el celular en otra parte, bloquear páginas).',
        ] },
      ],
    },
    en: {
      title: 'Procrastination is not laziness',
      summary: 'Putting things off is usually about emotions, not lack of willpower.',
      sections: [
        { p: 'Most university students procrastinate at some point. Often it is not laziness: we avoid a task because it makes us feel unsure, bored or afraid of doing it badly. Putting it off brings relief for a while, but then adds stress.' },
        { h: 'What helps', list: [
          'Be kind to yourself. Research cited by the APA found that students who forgave themselves for procrastinating tended to procrastinate less afterwards.',
          'Start with something very small: five minutes, one paragraph, opening the document.',
          'Estimate time realistically: we tend to underestimate how long big projects take. Use a calendar and include eating, sleeping and resting too.',
          'Use short gaps between classes to make a bit of progress.',
          'Find someone to review progress with; being accountable to another person helps.',
          'Keep distractions away while you work (phone elsewhere, block websites).',
        ] },
      ],
    },
  },
  {
    id: 'relationships',
    tone: 'rose',
    illus: 'relaciones',
    minutes: 3,
    sources: [SRC.apaSupport],
    es: {
      title: 'Relaciones que sostienen',
      summary: 'Una buena red de apoyo te hace más fuerte frente al estrés.',
      sections: [
        { p: 'Las relaciones cercanas ayudan a atravesar momentos difíciles. No hace falta tener una sola persona para todo: cada relación puede aportar algo distinto.' },
        { h: 'Ideas para cuidar tu red', list: [
          'Diversifica: quizá un compañero te entiende con la carrera y un familiar te escucha con otros temas. Está bien.',
          'Pide lo que necesitas: hay personas buenas para escuchar y otras para ayudar con algo práctico.',
          'Cuida el equilibrio: una relación en la que solo das y nunca recibes también desgasta.',
          'Da apoyo tú también: ayudar a otros aumenta las emociones positivas.',
          'Haz el esfuerzo: escribe, saluda, propone un plan. Las relaciones se mantienen cuando se cuidan.',
        ] },
      ],
    },
    en: {
      title: 'Relationships that hold you up',
      summary: 'A good support network makes you stronger against stress.',
      sections: [
        { p: 'Close relationships help us get through hard times. You do not need one person for everything: each relationship can offer something different.' },
        { h: 'Ideas to care for your network', list: [
          'Diversify: maybe a classmate gets your degree struggles and a relative listens about other things. That is fine.',
          'Ask for what you need: some people are good listeners and others are good at practical help.',
          'Keep it balanced: a relationship where you only give and never receive is draining too.',
          'Give support as well: helping others increases positive emotions.',
          'Make the effort: text, say hi, suggest a plan. Relationships last when they are cared for.',
        ] },
      ],
    },
  },
  {
    id: 'loneliness',
    tone: 'mint',
    illus: 'amigos',
    minutes: 3,
    sources: [SRC.nhsLoneliness],
    es: {
      title: 'Sentirse solo en la universidad',
      summary: 'La soledad es común entre jóvenes y puede pasar. Algunas formas de reconectar.',
      sections: [
        { p: 'Sentirte solo no significa que algo esté mal contigo. Es especialmente común entre los 16 y los 34 años, y en etapas de cambio como empezar la universidad o mudarte de ciudad. La soledad y los sentimientos difíciles pueden pasar.' },
        { h: 'Pasos pequeños', list: [
          'Escribe a alguien con quien hace tiempo no hablas, o arma un grupo de chat.',
          'Únete a un grupo, semillero o club de algo que te guste.',
          'Haz actividades que disfrutes: salir al aire libre, moverte, un hobby.',
          'Cuéntale a alguien cómo te sientes en vez de guardártelo.',
          'Evita compararte con lo que ves en redes: solo muestra una parte.',
          'Acércate a otras personas que quizá también se sienten solas, o haz voluntariado.',
        ] },
        { p: 'La comunidad de Raíz también es un lugar para compartir lo que sientes, de forma anónima si prefieres.' },
      ],
    },
    en: {
      title: 'Feeling lonely at university',
      summary: 'Loneliness is common among young people and it can pass. Some ways to reconnect.',
      sections: [
        { p: 'Feeling lonely does not mean something is wrong with you. It is especially common between ages 16 and 34, and during changes like starting university or moving to a new city. Loneliness and difficult feelings can pass.' },
        { h: 'Small steps', list: [
          'Text someone you have not talked to in a while, or start a group chat.',
          'Join a group, research team or club about something you enjoy.',
          'Do activities you enjoy: going outside, moving, a hobby.',
          'Tell someone how you feel instead of keeping it in.',
          'Avoid comparing yourself with what you see on social media: it only shows part of the story.',
          'Reach out to others who may feel lonely too, or volunteer.',
        ] },
        { p: 'The Raíz community is also a place to share how you feel, anonymously if you prefer.' },
      ],
    },
  },
  {
    id: 'when-to-ask-for-help',
    tone: 'lilac',
    illus: 'salud',
    minutes: 3,
    sources: [SRC.nimhCaring, SRC.whoMentalHealth, SRC.minsalud106],
    sos: true,
    es: {
      title: 'Cuándo pedir ayuda profesional',
      summary: 'Señales de que vale la pena hablar con alguien, y por dónde empezar.',
      sections: [
        { p: 'La salud mental es parte de la salud, y cuidarla incluye saber cuándo el autocuidado no alcanza. Buscar ayuda no es exagerar ni ser débil.' },
        { h: 'Señales a tener en cuenta', p: 'Considera hablar con un profesional si durante dos semanas o más notas cosas como:', list: [
          'Dificultad para dormir o cambios en el apetito.',
          'Problemas para concentrarte o para cumplir con tus tareas de siempre.',
          'Perder el interés en cosas que antes disfrutabas.',
          'Irritabilidad, frustración o inquietud frecuentes.',
          'Que te cueste levantarte de la cama por cómo te sientes.',
        ] },
        { h: 'Por dónde empezar', p: 'Puedes comenzar con tu médico o servicio de salud, que puede orientarte hacia un profesional de salud mental. Contarle a alguien de confianza también ayuda a dar el primer paso.' },
        { h: 'Si es una crisis', p: 'Si sientes que no puedes más o piensas en hacerte daño, no esperes: en la pantalla de Apoyo están las líneas gratuitas verificadas, disponibles todo el día.' },
      ],
    },
    en: {
      title: 'When to seek professional help',
      summary: 'Signs that it is worth talking to someone, and where to start.',
      sections: [
        { p: 'Mental health is part of health, and caring for it includes knowing when self-care is not enough. Seeking help is not overreacting or being weak.' },
        { h: 'Signs to keep in mind', p: 'Consider talking to a professional if for two weeks or more you notice things like:', list: [
          'Trouble sleeping or changes in appetite.',
          'Difficulty concentrating or getting through your usual tasks.',
          'Losing interest in things you used to enjoy.',
          'Frequent irritability, frustration or restlessness.',
          'Finding it hard to get out of bed because of how you feel.',
        ] },
        { h: 'Where to start', p: 'You can start with your doctor or health service, who can refer you to a mental health professional. Telling someone you trust also helps you take the first step.' },
        { h: 'If it is a crisis', p: 'If you feel you cannot go on or are thinking about hurting yourself, do not wait: the Support screen lists verified free lines, available around the clock.' },
      ],
    },
  },
  {
    id: 'help-a-friend',
    tone: 'blush',
    illus: 'fortaleza',
    minutes: 4,
    sources: [SRC.nimh5Steps],
    sos: true,
    es: {
      title: 'Cómo apoyar a un amigo en crisis',
      summary: 'Cinco pasos para acompañar a alguien que está pasando por un momento muy difícil.',
      sections: [
        { p: 'Si alguien cercano está sufriendo mucho, tu presencia importa. No necesitas tener todas las respuestas. El NIMH propone cinco pasos:' },
        { h: '1. Pregunta', p: 'Pregunta directamente si está pensando en suicidarse. No es fácil, pero preguntar no aumenta el riesgo y puede abrir la conversación.' },
        { h: '2. Acompaña', p: 'Escucha sin juzgar. Déjale contar lo que piensa y siente; hablar de ello puede aliviar.' },
        { h: '3. Ayuda a mantenerle a salvo', p: 'Pregunta si tiene un plan y ayuda a alejar objetos o lugares con los que pueda hacerse daño.' },
        { h: '4. Ayuda a conectar', p: 'Anímale a buscar apoyo profesional y conéctale con líneas de ayuda. En la pantalla de Apoyo de esta app están las líneas verificadas; si hay riesgo inmediato para su vida, la línea de emergencias.' },
        { h: '5. Haz seguimiento', p: 'Escribe o llama en los días siguientes. Saber que alguien sigue ahí marca una diferencia.' },
        { p: 'Cuidar a otro también cansa: busca apoyo para ti y no cargues solo con la situación.' },
      ],
    },
    en: {
      title: 'How to support a friend in crisis',
      summary: 'Five steps to be there for someone going through a very hard time.',
      sections: [
        { p: 'If someone close to you is struggling a lot, your presence matters. You do not need to have all the answers. NIMH suggests five steps:' },
        { h: '1. Ask', p: 'Ask directly whether they are thinking about suicide. It is not easy, but asking does not increase the risk and can open the conversation.' },
        { h: '2. Be there', p: 'Listen without judging. Let them share what they think and feel; talking about it can bring relief.' },
        { h: '3. Help keep them safe', p: 'Ask whether they have a plan and help put distance between them and objects or places they could use to hurt themselves.' },
        { h: '4. Help them connect', p: 'Encourage them to seek professional support and connect them with helplines. The Support screen in this app lists verified lines; if their life is in immediate danger, the emergency line.' },
        { h: '5. Follow up', p: 'Text or call in the following days. Knowing someone is still there makes a difference.' },
        { p: 'Caring for someone else is tiring too: seek support for yourself and do not carry it alone.' },
      ],
    },
  },
];

export const getArticle = (id) => ARTICLES.find(a => a.id === id) ?? null;

// Marcas diacríticas combinantes (rango 0x300–0x36f), armadas con códigos para no
// depender de caracteres invisibles en el código fuente.
const DIACRITICS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

/** Minúsculas y sin tildes, para buscar "ansiedad" con "ANSIEDAD" o "sueno" con "sueño". */
export function normalizeText(s) {
  let out = String(s ?? '');
  try { out = out.normalize('NFD'); } catch { /* motor sin normalize: se busca con tildes */ }
  return out
    .replace(DIACRITICS, '')
    .toLowerCase()
    .trim();
}

function articleText(a, lang) {
  const c = a[lang] ?? a.es;
  const parts = [c.title, c.summary];
  for (const s of c.sections) {
    if (s.h) parts.push(s.h);
    if (s.p) parts.push(s.p);
    if (s.list) parts.push(...s.list);
  }
  return normalizeText(parts.join(' '));
}

/**
 * Búsqueda simple: todas las palabras de la consulta deben aparecer en el
 * artículo (en el idioma activo). Los que coinciden en el título van primero.
 */
export function searchArticles(query, lang = 'es', list = ARTICLES) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return list;
  return list
    .filter(a => {
      const text = articleText(a, lang);
      return words.every(w => text.includes(w));
    })
    .map(a => {
      const title = normalizeText((a[lang] ?? a.es).title);
      return { a, score: words.filter(w => title.includes(w)).length };
    })
    .sort((x, y) => y.score - x.score)
    .map(x => x.a);
}
