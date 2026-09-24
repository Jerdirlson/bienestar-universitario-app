/**
 * Filtro de moderación automática de la comunidad.
 *
 * Puro a propósito: no toca la base, no llama a ningún servicio externo y no
 * guarda estado. Recibe un texto y devuelve una decisión. Así se prueba en
 * milisegundos (tests/moderation.test.mjs) y se puede razonar sobre él sin
 * levantar nada.
 *
 *   screen(text) → { outcome, risk, reason, note }
 *
 *   outcome  'published' | 'held'    — held = queda en revisión humana
 *   risk     'none' | 'low' | 'high'  — mismo vocabulario que public.risk_level
 *   reason   null | 'crisis' | 'review'
 *   note     texto corto para el panel de administración (screening_note)
 *
 * Qué NO es: un clasificador perfecto. Es una red de primera línea que
 * prefiere retener de más a publicar de menos cuando hay riesgo de
 * autolesión — un falso positivo cuesta unos minutos de espera; un falso
 * negativo puede costar mucho más. Para acoso y datos personales el costo de
 * un falso positivo es el mismo (revisión humana), así que también se inclina
 * a retener, pero cuida los modismos obvios ("me muero de la risa", "este
 * parcial me mata") para no convertir cada desahogo en una espera.
 *
 * Siempre en primera persona para la crisis: "este parcial me mata" habla del
 * parcial; "matarme" o "me quiero morir" hablan de quien escribe.
 *
 * El diario NUNCA pasa por aquí: el servidor no analiza lo que alguien
 * escribe para sí.
 *
 * La nota nunca repite el dato personal detectado (el correo, el teléfono):
 * screening_note se guarda y lo lee una persona, y copiar ahí el dato sería
 * justo lo que el filtro intenta evitar.
 */

// ── normalización ──────────────────────────────────────────────────────────

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' };

/** Colapsa letras repetidas: "muerooooo" → "muero", "llorar" → "lorar". */
function squeeze(s) {
  return s.replace(/([a-z])\1+/g, '$1');
}

/**
 * Minúsculas y sin tildes (la ñ también pasa a n).
 *
 * Antes de plegar: NFKC convierte las letras "de adorno" (ancho completo
 * "ｓｕｉｃｉｄｉｏ", superíndices, ligaduras) en letras corrientes, y se quitan
 * los caracteres de formato invisibles (\p{Cf}: espacio de ancho cero, guion
 * blando, marcas de dirección). Sin esto, "sui<U+200B>cidio" se ve igual en
 * pantalla y pasa el filtro.
 */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Texto normalizado para buscar frases de riesgo:
 *   1. minúsculas, sin tildes;
 *   2. letras sueltas separadas por signos se juntan ("s.u.i.c.i.d.i.o");
 *   3. leetspeak básico solo dentro de palabras que ya tienen letras
 *      ("m4t4rm3" → "matarme"), para no convertir números de verdad;
 *   4. todo lo que no es letra o dígito pasa a espacio;
 *   5. letras sueltas separadas por espacios se juntan ("s u i c i d i o");
 *   6. repeticiones colapsadas.
 */
export function normalize(text) {
  let s = fold(text);

  s = s.replace(/(?:^|(?<=[^a-z0-9@$]))(?:[a-z0-9@$][.\-_*]){2,}[a-z0-9@$](?=$|[^a-z0-9@$])/g,
    (run) => run.replace(/[.\-_*]/g, ''));

  s = s.replace(/[a-z0-9@$]+/g, (token) => {
    if (!/[a-z]/.test(token)) return token;
    return token.replace(/[0134578@$]/g, (c) => LEET[c]);
  });

  s = s.replace(/[^a-z0-9]+/g, ' ');

  // Solo rachas de 4 o más letras sueltas: "y", "a", "o", "e", "u" son
  // palabras reales en español y juntar dos o tres podría inventar palabras.
  s = s.replace(/\b(?:[a-z] ){3,}[a-z]\b/g, (run) => run.replace(/ /g, ''));

  s = squeeze(s);
  return ` ${s.trim().replace(/\s+/g, ' ')} `;
}

// Las expresiones se escriben en español/inglés corriente (sin tildes) y se
// comprimen con la misma regla que el texto, así "llorar" en el patrón y
// "lloraaar" en el texto terminan iguales.
const compile = (sources) => sources.map((src) => new RegExp(squeeze(src)));

// ── falsos positivos obvios ────────────────────────────────────────────────
// Modismos donde "morir" o "matar" no hablan de hacerse daño. NO se borran del
// texto antes de buscar: borrarlos dejaba pasar "me muero de ganas de morir"
// (se borraba "me muero de ganas" y quedaba "de morir"). Solo sirven para
// DESCARTAR una coincidencia de riesgo que cae ENTERA dentro de uno de ellos
// (ver insideSafe); si la coincidencia se sale del modismo, cuenta.

const FEELINGS = 'risa|hambre|sueno|pena|verguenza|ganas|calor|frio|amor|nervios|envidia|curiosidad|emocion|cansancio|susto|aburrimiento|sed|ternura|felicidad|alegria|gusto|estres|dolor de cabeza';

const SAFE_PHRASES = compile([
  // "me muero de la risa", "muerta de sueño", "me moría de la pena"
  String.raw` (?:me )?(?:muero|mori|morir|morirme|muriendo|muerta|muerto|muertos|muertas|moria|moriria) de(?:l)? (?:la |el |tanta |tanto )?(?:${FEELINGS})\b`,
  // "me quiero morir de la pena" (vergüenza, no deseo de morir)
  String.raw` (?:me )?(?:quiero|quisiera) morir(?:me)? de(?:l)? (?:la |el )?(?:${FEELINGS})\b`,
  // "matar el tiempo", "matar el rato"
  String.raw` matar(?:ando)? el (?:tiempo|rato|aburrimiento|hambre|antojo)\b`,
  // "me mato estudiando", "me voy a matar en el gimnasio"
  String.raw` (?:me mato|me voy a matar|matarme|me estoy matando|me mate) (?:estudiando|trabajando|haciendo|leyendo|entrenando|en el gym|en el gimnasio|de la risa|de risa)\b`,
  String.raw` sobredosis de (?:cafe|cafeina|azucar|tareas|trabajo|memes|series|estudio)\b`,
  // inglés
  String.raw` (?:dying|died|die|dead) (?:of|from|laughing|with)(?: laughter| laughing| embarrassment| cuteness| boredom| hunger)?\b`,
  String.raw` (?:dying|die) to (?:see|know|try|go|meet|hear|read|watch)\b`,
  String.raw` kil(?:l|ing|led) (?:it|time)\b`,
  String.raw` to die for\b`,
]);

// ── autolesión / suicidio → crisis ─────────────────────────────────────────

const SELF_HARM_VERBS = 'matarme|suicidarme|ahorcarme|colgarme|envenenarme|hacerme dano|lastimarme|desaparecer para siempre|quitarme la vida';

const CRISIS = compile([
  String.raw` suicid(?:io|ios|arme|arse|arte|a|al|ales|e|o|ar|andome|ado|ada)?\b`,
  String.raw` (?:me )?quiero morir(?:me)?\b`,
  String.raw` (?:ganas|deseos) de morir(?:me)?\b`,
  // Coloquial colombiano que antes pasaba.
  // "me quiero quitar la vida", "me voy a quitar la vida"
  String.raw` me (?:quiero|quisiera|voy a|pienso|puedo|iba a) quitar la vida\b`,
  // "quiero acabar con todo" (pero no "acabar con todo el taller")
  String.raw` (?:quiero|quisiera|voy a|pienso|ganas de|deseo|necesito) (?:acabar|terminar) con todo\b(?! (?:el|la|los|las|mi|mis|lo que|de|para|antes|hoy)\b)`,
  // "quiero estar muerto", "quisiera estar muerta"
  String.raw` (?:quiero|quisiera|deseo|preferiria|ojala|me gustaria) estar muert[oa]s?\b`,
  // "quiero dormir y no despertar"
  String.raw` dormir(?:me)? y no (?:volver a )?despertar(?:me)?\b`,
  String.raw` mejor me muero\b`,
  // "quiero desaparecer" (pero no "desaparecer de las redes")
  String.raw` (?:quiero|quisiera|deseo|ganas de|me gustaria) desaparecer\b(?! (?:de|del) (?:las redes|redes|internet|clase|la clase|este grupo|el grupo|whatsapp|instagram)\b)`,
  // "me quiero cortar", "me corto" (pero no el pelo ni las uñas)
  String.raw` (?:me (?:quiero|voy a|vuelvo a) cortar|me corto|me corte)\b(?! (?:el|la|los|las|un|una) (?:pelo|cabelo|unas|fleco|flequilo|barba|puntas|cabeza|dedo)\b)`,
  // "voy a tomar todas mis pastillas", "me tomé todas las pastillas"
  String.raw` (?:tomar|tomarme|tragar|tragarme|tome|tomo) todas (?:las|mis) pastilas\b`,
  String.raw` (?:me )?quisiera morir(?:me)?\b`,
  String.raw` prefiero (?:estar )?muert[oa]\b`,
  String.raw` (?:estaria|estarian) mejor muert[oa]s?\b`,
  String.raw` mejor (?:estar )?muert[oa]\b`,
  String.raw` no quiero (?:seguir )?(?:vivir|viviendo|existir|estar viv[oa]|despertar)\b`,
  String.raw` (?:quiero|quisiera|deseo) (?:dejar de existir|desaparecer para siempre|no despertar|no existir)\b`,
  String.raw` ojala (?:no despert(?:ar|ara|arme)|no existiera|me muera|me muriera|no haber nacido)\b`,
  String.raw` quitarme la vida\b`,
  String.raw` (?:acabar|terminar) con (?:mi vida|mi existencia)\b`,
  String.raw` (?:me voy a|me quiero|me dan ganas de) (?:matar|suicidar|ahorcar|envenenar|hacer dano)\b`,
  String.raw` (?:voy a|quiero|pienso|pensando en|ganas de|he pensado en|intente|intento de) (?:${SELF_HARM_VERBS})\b`,
  // "mi mamá va a matarme" es un modismo sobre otra persona, no autolesión.
  String.raw`(?<! va a| van a| vas a| iba a| iban a| quiere| quieren| me) matarme\b`,
  String.raw` (?:cortarme|me corto|me corte|me he cortado|me sigo cortando) (?:las venas|los brazos|las munecas|el brazo|la muneca|las piernas|otra vez|de nuevo)\b`,
  String.raw` cortarme\b(?! (?:el|las|la|los) (?:pelo|cabelo|unas|fleco|barba|cabeza|flequilo))`,
  String.raw` (?:autolesion(?:es|arme|o)?|auto lesion(?:es|arme)?|autoagresion(?:es)?)\b`,
  String.raw` (?:hacerme dano|lastimarme|herirme)\b`,
  String.raw` (?:tirarme|lanzarme|botarme|echarme|(?:me )?(?:quiero|voy a) (?:tirar|lanzar|botar|echar)(?:me)?|me tiro|me lanzo) (?:de|del|desde|por|a) (?:un |una |el |la |los |las )?(?:puente|edificio|ventana|balcon|terraza|techo|vias|via del tren|metro|tren|carretera|piso)\b`,
  String.raw` (?:ahorcarme|colgarme|envenenarme|pegarme un tiro|darme un tiro|volarme los sesos)\b`,
  String.raw` (?:tomarme|tragarme) (?:todas )?(?:las|mis) pastilas\b`,
  String.raw` sobredosis\b`,
  String.raw` (?:no tengo|sin|ya no hay|no hay|no encuentro) (?:razones|motivos|razon|motivo) (?:para|por (?:las|la) (?:que|cual)) vivir\b`,
  String.raw` no vale la pena (?:vivir|seguir viviendo|seguir vivo|seguir viva|seguir)\b`,
  String.raw` (?:nadie me extranaria|nadie notaria si desaparezco|nadie notaria si me muero)\b`,
  String.raw` carta de despedida\b`,
  // inglés
  String.raw` (?:kil|kiling|kiled) myself\b`,
  String.raw` (?:end|ending|take|taking) my (?:own )?life\b`,
  String.raw` (?:want|wanna|going|gona|gonna|wish i could) (?:to )?die\b`,
  String.raw` wish i (?:was|were) dead\b`,
  String.raw` beter of dead\b`,
  String.raw` (?:self harm|selfharm|self injury|hurt myself|hurting myself|cut myself|cuting myself|cut my wrists)\b`,
  String.raw` (?:no reason to live|(?:dont|don t|do not) want to (?:live|be alive|exist|wake up))\b`,
  String.raw` end it al\b`,
  String.raw` (?:going to|gona|want to|wana|about to|ready to|gonna) end it\b`,
  // "kms" = kill myself; pero no "5 kms" (kilómetros).
  String.raw`(?<![0-9]) kms\b`,
  String.raw` (?:hang myself|jump of (?:a|the) (?:bridge|building|roof)|overdose|unalive myself|suicidal)\b`,
]);

// ── acoso, insultos, amenazas, odio → revisión ─────────────────────────────

const INSULT_WORDS = [
  'idiota', 'idiotas', 'imbecil', 'imbeciles', 'estupido', 'estupida', 'estupidos', 'estupidas',
  'pendejo', 'pendeja', 'pendejos', 'pendejas', 'guevon', 'guevona', 'huevon', 'huevona', 'webon', 'webona',
  'bobo', 'boba', 'tonto', 'tonta', 'inutil', 'inutiles', 'basura', 'escoria', 'mierda', 'perdedor',
  'perdedora', 'fracasado', 'fracasada', 'payaso', 'payasa', 'ridiculo', 'ridicula', 'retrasado', 'retrasada',
  'mongolico', 'mongolica', 'subnormal', 'tarado', 'tarada', 'zorra', 'perra', 'puta', 'marica', 'asqueroso',
  'asquerosa', 'lambon', 'lambona', 'sapo', 'sapa', 'bruto', 'bruta', 'gorda', 'gordo', 'feo', 'fea',
  'loser', 'stupid', 'idiot', 'moron', 'worthless', 'pathetic', 'dumb', 'ugly', 'bitch', 'slut', 'whore',
];
const INSULT_ALT = INSULT_WORDS.map(squeeze).join('|');

const HARASSMENT = compile([
  // Dirigido a otra persona: "eres un idiota", "ustedes son unos inútiles".
  // No se incluye "soy": insultarse a sí mismo es desahogo, no acoso.
  String.raw` (?:eres|sos|seas|pareces|ustedes son|you are|youre|ur|u r) (?:un |una |unos |unas |tan |muy |re |an |a |such an? |so |el mas |la mas )?(?:${INSULT_ALT})\b`,
  String.raw` son (?:unos|unas) (?:${INSULT_ALT})\b`,
  String.raw` (?:pedazo de|so|grandisim[oa]|maldit[oa]|you) (?:${INSULT_ALT})\b`,
  String.raw` (?:${INSULT_ALT}) de mierda\b`,
  // Insultos fuertes que no necesitan contexto.
  String.raw` (?:gonorrea|gonorreas|malparid[oa]s?|hijueputa|hijueputas|hijo de puta|hija de puta|hijos de puta|hpta|hdp|maricon|maricones|mamaguevo|carechimba|comemierda)\b`,
  String.raw` (?:fuck you|fuck of|stfu|son of a bitch|piece of shit|asshole|motherfucker)\b`,
  // Deseos de muerte o incitación dirigidos a otra persona.
  String.raw` (?:matate|suicidate|ahorcate|muerete|ojala te mueras|ojala te murieras|ojala se muera|deberias morirte|deberias matarte|deberias suicidarte|nadie te quiere|nadie te extranaria|kil yourself|kys|go die|nobody likes you|nobody loves you)\b`,
  // Amenazas.
  String.raw` (?:te voy a|les voy a|lo voy a|la voy a|los voy a|te vamos a) (?:matar|pegar|golpear|buscar|encontrar|partir|romper|joder|quebrar|chuzar|apunalar|violar|hacer dano|dar tu merecido)\b`,
  String.raw` (?:ya se|se|sabemos) (?:donde|en que) (?:vives|estudias|trabajas|te quedas|salon estas)\b`,
  String.raw` (?:te espero a la salida|vas a ver lo que te pasa|cuidate la espalda|te las vas a ver)\b`,
  String.raw` (?:i wil kil you|il kil you|i know where you live|watch your back|you wil regret)\b`,
  // Discurso de odio: insultos por grupo y frases de exterminio.
  String.raw` (?:veneco|venecos|veneca|venecas|sudaca|sudacas|travelo|travelos|faget|fagot|tranny|retard|niger|niga|negro de mierda|indio de mierda)\b`,
  String.raw` (?:los|las|todos los|todas las|all) (?:negros|indios|indigenas|gays|gais|maricas|lesbianas|trans|venezolanos|judios|musulmanes|mujeres|costenos|paisas|pobres|inmigrantes|migrantes|blacks|jews|muslims|immigrants|women) (?:son|deberian|merecen|tienen que|should|must|deserve|are) (?:una plaga|basura|escoria|inferiores|enferm[oa]s|morir|morirse|desaparecer|ser exterminad[oa]s|irse|largarse|die|be exterminated|disappear|trash|animals|animales)\b`,
]);

// ── datos personales ───────────────────────────────────────────────────────
// Se buscan sobre el texto SIN leetspeak: ahí los dígitos son dígitos.

const isMoney = (m) => /^\$?\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$/.test(m.trim());
const isDate = (m) => /^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/.test(m.trim());

const PII = [
  { label: 'correo', re: /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]| arroba )\s*[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/ },
  { label: 'url', re: /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|co|net|org|io|ly|gg|app|info|xyz|link|site|online|store)(?:\.[a-z]{2})?\b(?:\/\S*)?/ },
  { label: 'usuario', re: /(?:^|[^a-z0-9._%+-])@[a-z0-9_.]{3,}/ },
  { label: 'cedula', re: /\b(?:cedula|c\.\s?c\.?|cc|documento|tarjeta de identidad|t\.\s?i\.|nit|pasaporte|codigo estudiantil|carnet)\s*(?:de ciudadania\s*)?(?:es\s*)?(?:n(?:o|ro|umero|°|º)?\.?\s*)?:?\s*\d[\d.\s-]{4,}\d\b/ },
  // Siete o más dígitos, aunque vengan en grupos: "300 123 4567",
  // "+57 3001234567". Plata ("1.500.000") y fechas ("23.09.2026") no cuentan.
  { label: 'telefono', re: /(?:\+\s?\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){1,5}\d{2,4}/, test: (m) => m.replace(/\D/g, '').length >= 7 && !isMoney(m) && !isDate(m) },
  { label: 'direccion', re: /\b(?:calle|cl|cll|carrera|cra|kra|kr|cr|avenida|av|diagonal|dg|transversal|tv|circular|autopista)\.?\s*\d+\s*[a-z]?\s*(?:bis\s*)?(?:#|no\.?|n°|nº|numero|num\.?)\s*\d+[a-z]?(?:\s*-\s*\d+)?/ },
  { label: 'direccion', re: /\b(?:torre|bloque|manzana|mz)\s*\d+\w?\s*,?\s*(?:apartamento|apto|apt|casa|interior|int)\.?\s*\d+/ },
  { label: 'red social', re: /\b(?:mi|el|su) (?:insta|ig|instagram|tiktok|twitter|snap|snapchat|face|facebook|telegram|discord|whatsapp|wpp|wsp|numero|celular|cel)\s*(?:es|:)\s*\S+/ },
];

function findPii(text) {
  const s = fold(text);
  for (const { label, re, test } of PII) {
    for (const m of s.matchAll(new RegExp(re.source, 'g'))) {
      if (!test || test(m[0])) return label;
    }
  }
  return null;
}

/** Tramo [inicio, fin) de una coincidencia, sin los espacios de los bordes. */
function span(text, index, length) {
  let start = index;
  let end = index + length;
  while (start < end && text[start] === ' ') start += 1;
  while (end > start && text[end - 1] === ' ') end -= 1;
  return [start, end];
}

/** Tramos del texto ocupados por modismos inofensivos. */
function safeSpans(text) {
  const spans = [];
  for (const re of SAFE_PHRASES) {
    for (const m of text.matchAll(new RegExp(re.source, 'g'))) spans.push(span(text, m.index, m[0].length));
  }
  return spans;
}

const insideSafe = ([s, e], spans) => spans.some(([ss, se]) => s >= ss && e <= se);

/**
 * Primera coincidencia de riesgo que NO cae entera dentro de un modismo. Se
 * revisan todas las apariciones de cada patrón: que la primera sea un
 * modismo no dice nada de la segunda.
 */
function firstMatch(patterns, text, spans) {
  for (const re of patterns) {
    for (const m of text.matchAll(new RegExp(re.source, 'g'))) {
      if (!insideSafe(span(text, m.index, m[0].length), spans)) return m[0].trim();
    }
  }
  return null;
}

const CLEAN = Object.freeze({ outcome: 'published', risk: 'none', reason: null, note: 'filtro: sin hallazgos' });

export function screen(text) {
  const raw = String(text ?? '');
  if (!raw.trim()) return { ...CLEAN };

  const normalized = normalize(raw);
  const spans = safeSpans(normalized);

  const crisis = firstMatch(CRISIS, normalized, spans);
  if (crisis) {
    return { outcome: 'held', risk: 'high', reason: 'crisis', note: `crisis: "${crisis}"` };
  }

  const harassment = firstMatch(HARASSMENT, normalized, spans);
  if (harassment) {
    return { outcome: 'held', risk: 'low', reason: 'review', note: `acoso u odio: "${harassment}"` };
  }

  const pii = findPii(raw);
  if (pii) {
    return { outcome: 'held', risk: 'low', reason: 'review', note: `datos personales: ${pii}` };
  }

  return { ...CLEAN };
}
