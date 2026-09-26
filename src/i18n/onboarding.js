/**
 * Textos del onboarding nuevo. Se mezclan en COPY desde src/i18n.js, igual
 * que DIARY_COPY/SOCIAL_COPY/WELLNESS_COPY (mismas reglas: español estándar,
 * ambos idiomas con las mismas claves, tests/i18n.test.mjs lo verifica).
 *
 * Todas las claves empiezan por "onboarding" para no chocar con otros
 * módulos, salvo welcomeTitle/welcomeBody/privacyTitle/privacyBody/
 * supportTitle/supportBody: ya existían en BASE_COPY (src/i18n.js) desde el
 * onboarding viejo y se movieron aquí tal cual, sin renombrarlas, para no
 * romper lo que ya usa esas claves (incluida la prueba de privacidad de
 * tests/i18n.test.mjs, que sigue revisando privacyBody).
 *
 * skip/next/start/back (t.skip, t.next, t.start, t.diaryBack) NO están acá:
 * son controles compartidos con el check-in y otras pantallas y ya viven en
 * BASE_COPY / DIARY_COPY.
 */
export const ONBOARDING_COPY = {
  es: {
    welcomeTitle: 'Bienvenido a Raíz',
    welcomeBody: 'Una app hecha por y para la comunidad universitaria. Te mostramos en un minuto cómo funciona.',
    // Fila de 4 iconos del paso de bienvenida: un vistazo a los pilares antes
    // de entrar en cada uno con más calma en los pasos siguientes.
    onboardingPillarMood: 'Ánimo',
    onboardingPillarJournal: 'Diario',
    onboardingPillarCommunity: 'Comunidad',
    onboardingPillarSupport: 'Apoyo',

    // Paso interactivo: elegir una cara de ánimo y ver una vista previa real
    // de cómo quedaría el registro, en vez de solo describirlo.
    onboardingMoodTitle: 'Así registras tu ánimo',
    onboardingMoodBody: 'Cada día eliges cómo te sientes con un toque. Tócala para ver cómo se vería tu registro de hoy.',
    onboardingMoodPreviewLabel: 'Vista previa de tu registro',
    onboardingMoodPreviewHint: 'Toca una carita arriba',

    privacyTitle: 'Tu diario, solo tuyo',
    // Tiene que ser 100 % cierto: dentro de la app nadie más lo lee (ninguna
    // política lo permite, ni a moderación ni a administración), pero vive en
    // un servidor que opera la universidad. Prometer "nadie de la universidad"
    // no sería verdad frente a quien opera ese servidor. tests/i18n.test.mjs
    // revisa exactamente esto.
    privacyBody: 'Lo que escribes se guarda en tu teléfono y en tu cuenta, para que no lo pierdas. Dentro de la app nadie más puede leerlo, ni moderadores ni administradores. Se guarda protegido en el servidor de la universidad.',
    // Tarjeta de ejemplo del diario, clarísimamente marcada como tal.
    onboardingJournalExampleBadge: 'Ejemplo, no es tuyo',
    onboardingJournalExampleTitle: 'Gratitud de hoy',
    onboardingJournalExampleBody: 'Terminé el parcial de física. Me sentí orgullosa de haber estudiado con tiempo.',

    onboardingCommunityTitle: 'Comunidad anónima y moderada',
    onboardingCommunityBody: 'Comparte cómo te sientes sin usar tu nombre. Un filtro automático revisa cada publicación antes de mostrarla, y puedes reportar lo que veas.',
    onboardingCommunityExampleBadge: 'Ejemplo, no es una publicación real',
    onboardingCommunityExampleAuthor: 'Anónimo',
    onboardingCommunityExampleBody: 'Esta semana de parciales ha sido dura, pero escribir aquí ayuda. ¿A alguien más le sirve el diario de gratitud?',
    onboardingCommunityExampleReaction: 'Abrazo',

    supportTitle: 'Apoyo cuando lo necesites',
    supportBody: 'Retos, respiración guiada y artículos para cuidarte cada día. Y si alguna vez necesitas hablar con alguien ya, el botón SOS te lleva directo a líneas de ayuda reales.',
    onboardingSosLabel: 'SOS',
    onboardingSosHint: 'Siempre visible, en un toque',

    // Paso final: enfoque personal (liviano, opcional) + resumen.
    onboardingFocusTitle: '¿Qué te gustaría trabajar primero?',
    onboardingFocusBody: 'Elige lo que quieras — resaltamos ese contenido en Explorar. Puedes cambiarlo cuando quieras, y también saltarte esto.',
    onboardingFocusLiveWell: 'Vive bien',
    onboardingFocusRelieveStress: 'Estrés de parciales',
    onboardingFocusRelations: 'Relaciones sanas',
    onboardingFocusMindfulness: 'Sueño y calma',
    onboardingReady: 'Listo para empezar',

    onboardingStepOf: 'Paso {n} de {total}',
    onboardingSkipHint: 'Saltar el recorrido',
    onboardingBackHint: 'Paso anterior',
  },
  en: {
    welcomeTitle: 'Welcome to Raíz',
    welcomeBody: 'An app by and for the university community. Here is how it works, in about a minute.',
    onboardingPillarMood: 'Mood',
    onboardingPillarJournal: 'Journal',
    onboardingPillarCommunity: 'Community',
    onboardingPillarSupport: 'Support',

    onboardingMoodTitle: "This is how you log your mood",
    onboardingMoodBody: 'Every day you pick how you feel with one tap. Tap a face to see what your entry would look like.',
    onboardingMoodPreviewLabel: 'Preview of your entry',
    onboardingMoodPreviewHint: 'Tap a face above',

    privacyTitle: 'Your journal, only yours',
    privacyBody: "What you write is saved on your phone and in your account, so you don't lose it. No one else in the app can read it, not moderators or admins. It's stored securely on the university's server.",
    onboardingJournalExampleBadge: "Example, not yours",
    onboardingJournalExampleTitle: "Today's gratitude",
    onboardingJournalExampleBody: 'Finished my physics midterm. Proud I studied ahead of time.',

    onboardingCommunityTitle: 'Anonymous, moderated community',
    onboardingCommunityBody: 'Share how you feel without using your name. An automatic filter checks every post before it shows up, and you can report anything you see.',
    onboardingCommunityExampleBadge: 'Example, not a real post',
    onboardingCommunityExampleAuthor: 'Anonymous',
    onboardingCommunityExampleBody: "Midterms week has been rough, but writing here helps. Does the gratitude journal work for anyone else?",
    onboardingCommunityExampleReaction: 'Hug',

    supportTitle: 'Support when you need it',
    supportBody: 'Challenges, guided breathing, and articles to help you take care of yourself. And if you ever need to talk to someone right now, the SOS button takes you straight to real help lines.',
    onboardingSosLabel: 'SOS',
    onboardingSosHint: 'Always there, one tap away',

    onboardingFocusTitle: 'What would you like to work on first?',
    onboardingFocusBody: 'Pick whatever fits — we highlight that content in Explore. You can change it anytime, and skip this too.',
    onboardingFocusLiveWell: 'Live well',
    onboardingFocusRelieveStress: 'Exam stress',
    onboardingFocusRelations: 'Healthy relationships',
    onboardingFocusMindfulness: 'Sleep and calm',
    onboardingReady: 'Ready to start',

    onboardingStepOf: 'Step {n} of {total}',
    onboardingSkipHint: 'Skip the tour',
    onboardingBackHint: 'Previous step',
  },
};
