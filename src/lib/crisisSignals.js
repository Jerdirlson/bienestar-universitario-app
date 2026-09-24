/**
 * Detección local de señales de riesgo en lo que alguien escribe en su diario.
 *
 * Corre solo en el teléfono: el texto no se envía a ningún lado para esto. No
 * diagnostica nada ni bloquea el guardado; si encuentra algo, la app ofrece con
 * cariño el acceso a la pantalla de apoyo (Sos). Por eso se prefiere algún
 * falso positivo antes que callar ante un "me quiero morir" real — pero se
 * descartan las exageraciones cotidianas ("me muero de la risa", "me voy a
 * matar estudiando") para que la tarjeta no aparezca a la ligera y la persona
 * no aprenda a ignorarla.
 *
 * Debe cubrir lo mismo que el filtro del servidor (api/src/moderation.js):
 * tests/crisisParity.test.mjs pasa el mismo corpus por los dos.
 *
 * Todo se compara sin tildes, en minúsculas y sin letras alargadas
 * ("quierooo morirrr" → "quiero morir").
 */

// Caracteres de formato invisibles (categoría Unicode Cf): guion blando,
// espacios de ancho cero, marcas de dirección, BOM, y los "tag" (U+E0001,
// U+E0020–E007F, que en UTF-16 van como par sustituto). Escritos a mano y no
// con \p{Cf}: este archivo corre en Hermes, y aquí un error no puede pasar —
// si hasCrisisSignals lanzara, el guardado del check-in mostraría un error.
const FORMAT_CHARS = /[\u00AD\u0600-\u0605\u061C\u06DD\u070F\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uDB40[\uDC01\uDC20-\uDC7F]/g;

// Por si el motor no tiene normalize(): tildes a mano.
const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u' };

const tryNormalize = (s, form) => {
  try { return s.normalize(form); } catch { return s; }
};

/**
 * Letras "de adorno" (ancho completo "ｓｕｉｃｉｄｉｏ", superíndices) → letras
 * corrientes (NFKC, y el ancho completo también a mano por si no hay
 * normalize), y fuera los invisibles: así "sui<U+200B>cidio" no se escapa.
 * Después, minúsculas y sin tildes.
 */
export function normalizeForScreening(text) {
  const plain = tryNormalize(String(text ?? ''), 'NFKC')
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(FORMAT_CHARS, '')
    .toLowerCase();
  return ` ${tryNormalize(plain, 'NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[áéíóúüñàèìòù]/g, (c) => ACCENTS[c])
    .replace(/['’`´]/g, '')
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

// Modismos, negaciones y contextos informativos que usan las mismas palabras.
// NO se borran antes de buscar (borrarlos dejaba pasar "me muero de ganas de
// morir"): solo descartan una coincidencia de riesgo que cae ENTERA dentro de
// uno de ellos.
const HYPERBOLE_OBJECTS = 'risa|hambre|sueno|frio|calor|ganas|amor|verguenza|pena|nervios|aburrimiento|cansancio|envidia|curiosidad|emocion|felicidad|alegria|sed|miedo|susto|dolor de cabeza';
const SAFE_PHRASES = [
  // es
  new RegExp(`\\b(me )?(muero|moria|mori|morire|muriendo|morirme|morir|morirse|muerto|muerta|muertos|muertas) (de|del) (la |el )?(${HYPERBOLE_OBJECTS})\\b`),
  new RegExp(`\\b(me )?(quiero|quisiera) morir(me)? (de|del) (la |el )?(${HYPERBOLE_OBJECTS})\\b`),
  /\b(me )?(muero|muriendo|moria) por\b/,
  /\b(matarme|me mato|me voy a matar|me estoy matando|me mate|nos vamos a matar) (estudiando|trabajando|entrenando|corriendo|leyendo|haciendo tareas|a estudiar|en el gym|en el gimnasio|de la risa|de risa)\b/,
  /\bno (me )?quiero morir(me)?\b/,
  /\bprevencion del suicidio\b/,
  /\bsobredosis de (cafe|cafeina|azucar|tareas|trabajo|memes|series|estudio)\b/,
  // en
  /\b(dying|die|died|dead) (of|from) (laughter|laughing|embarrassment|boredom|shame|cringe|hunger)\b/,
  /\b(dying|died) laughing\b/,
  /\bdying to\b/,
  /\bkill(ing)? myself laughing\b/,
  /\bdont want to die\b/,
  /\bsuicide (squad|prevention)\b/,
];

// "cortarme el pelo" no es autolesión.
const NOT_HAIR = '(?! (el|la|los|las|un|una) (pelo|cabello|unas|fleco|flequillo|barba|puntas|cabeza|dedo)\\b)';

const RISK_PATTERNS = [
  // ── español ────────────────────────────────────────────────────────────────
  /\b(me )?(quiero|quisiera|queria|deseo|ganas de|prefiero|preferiria) morir/,
  /\bme (quiero|quisiera|voy a) morir\b/,
  /\b(me quiero|me voy a|pienso en) matar\b/,
  /\bmatarme\b/,
  /\bsuicid/,
  /\bquitarme la vida\b/,
  /\bme (quiero|quisiera|voy a|pienso|puedo|iba a) quitar la vida\b/,
  /\b(acabar|terminar|ponerle fin a|ponerle fin) (con )?(mi vida|todo de una vez)\b/,
  /\b(quiero|quisiera|voy a|pienso|ganas de|deseo|necesito) (acabar|terminar) con todo\b(?! (el|la|los|las|mi|mis|lo que|de|para|antes|hoy)\b)/,
  /\bno (quiero|deseo|aguanto) (seguir )?(vivir|viviendo|existir|estar vivo|estar viva|despertar|despertarme)\b/,
  /\bno (vale|tiene sentido) (la pena )?(seguir )?(vivir|viviendo)\b/,
  /\bla vida no (vale la pena|tiene sentido)\b/,
  // "no le veo sentido a seguir viviendo". No si hay un complemento de lugar
  // detrás ("vivir en Bogotá" habla de la ciudad, no de dejar de existir).
  /\bno (le veo|le encuentro|tiene|encuentro) sentido (a )?(seguir )?(vivir|viviendo)\b(?! en \w+)/,
  // "ya no quiero seguir aquí": solo si la frase termina ahí o sigue con
  // "más"/"nunca más"/"en este mundo"; con cualquier otra cosa detrás
  // ("aquí en esta clase") habla del lugar físico, no de dejar de existir.
  /\bno quiero (seguir |estar )?aqui\b(?=\s*$| mas\b| nunca mas\b| en este mundo\b)/,
  // "ya me cansé de vivir", "estoy cansada de la vida". "de vivir" no cuenta
  // si sigue un complemento de compañía o lugar ("de vivir con mis papás",
  // "de vivir en esta ciudad", "de vivir así/aquí/sola"): eso habla de las
  // circunstancias, no de dejar de existir. "de la vida" y "de existir" no
  // admiten ese complemento, así que siempre cuentan.
  /\b(me canse|me he cansado|estoy cansad[oa]|me siento cansad[oa]) de (vivir\b(?! (con|en|asi|aqui|solo|sola)\b)|la vida\b|existir\b)/,
  // "quiero que todo termine", "necesito que todo acabe". Solo si la frase
  // termina ahí o sigue "ya"/"de una vez"/"para siempre"/"todo": con otro
  // complemento detrás ("termine rápido", "termine bien en el parcial")
  // habla de que algo puntual (la clase, el parcial) acabe pronto o salga
  // bien, no de dejar de existir.
  /\b(quiero|quisiera|necesito|deseo) que (todo|esto) (termine|terminara|acabe|acabara|se acabe|se termine)\b(?=\s*$| ya\b| de una vez\b| para siempre\b| todo\b)/,
  /\bno tengo (razon|razones|motivo|motivos) (para|por las que) vivir\b/,
  /\b(mejor|preferiria|estaria mejor|ojala estuviera)( estar)? muert[oa]s?\b/,
  /\b(quiero|quisiera|deseo|preferiria|ojala|me gustaria) estar muert[oa]s?\b/,
  /\bdormir(me)? y no (volver a )?despertar(me)?\b/,
  /\bmejor me muero\b/,
  /\bojala no (despertar|despertara|existiera|hubiera nacido)\b/,
  /\bojala me (muera|muriera)\b/,
  /\b(quiero|quisiera|deseo|ganas de|me gustaria) desaparecer\b(?! (de|del) (las redes|redes|internet|clase|la clase|este grupo|el grupo|whatsapp|instagram)\b)/,
  /\b(hacerme|me hago|me hice|me voy a hacer|quiero hacerme) dano\b/,
  /\b(lastimarme|herirme|autolesion|autolesionarme|autolesiones|me autolesiono)\b/,
  /\b(cortarme|me corto|me corte|me cortaba) (las |los |la |el )?(venas|vena|brazos|brazo|munecas|muneca|piernas|pierna|piel)\b/,
  new RegExp(`\\b(me (quiero|voy a|vuelvo a) cortar|me corto|me corte|cortarme)\\b${NOT_HAIR}`),
  /\b(tomar|tomarme|tragar|tragarme|tome|tomo) todas (las|mis) pastillas\b/,
  /\bsobredosis\b/,
  /\bahorcarme\b/,
  // "colgarme la mochila" no es autolesión: solo cuenta si el verbo no lleva
  // un objeto directo detrás (una prenda, una cosa).
  /\bcolgarme\b(?! (el|la|los|las|mi|mis|tu|tus|su|sus) \w+)/,
  // "del" es "de el" contraído y ya trae el artículo: por eso es opcional.
  /\b(tirarme|lanzarme|me voy a tirar|me voy a lanzar) (de|del|desde|por) (un |una |el |la |los |las )?(puente|edificio|balcon|ventana|piso|techo|terraza)\b/,
  // Lanzarse al paso de un vehículo: no es un puente ni un edificio, así que
  // necesita su propio patrón ("a la calle", no "de/desde la calle"). Exige
  // que se nombre el vehículo cerca: "lanzarme a la calle" a secas es salir
  // a la calle (a trabajar, a celebrar), no autolesión.
  /\b(lanzarme|tirarme|me lanzo|me tiro|me quiero (lanzar|tirar)|me voy a (lanzar|tirar)) a la calle(?: \w+){0,4} (carro|carros|auto|autos|automovil|bus|buses|buseta|busetas|camion|camiones|moto|motos|vehiculo|vehiculos|tren)\b/,
  /\bnadie me (extranaria|va a extranar|extranaria si)\b/,
  /\b(todos|el mundo|mi familia) (estarian|estaria) mejor sin mi\b/,
  /\bsoy una carga para (todos|mi familia|los demas)\b/,
  /\b(desaparecer para siempre|dejar de existir)\b/,
  // ── english ────────────────────────────────────────────────────────────────
  /\bkill(ing)? myself\b/,
  /\bsuicidal\b/,
  /\b(want|wanna|going|gonna|wish i could|i should) (to )?die\b/,
  /\bwish i (was|were) dead\b/,
  /\bend (my life|it all)\b/,
  /\b(going to|gonna|want to|wanna|about to|ready to) end it\b/,
  // "kms" = kill myself; pero no "5 kms" (kilómetros).
  /(?<![0-9] )\bkms\b/,
  /\btake my (own )?life\b/,
  /\b(hurt|harm|cut|hurting|harming|cutting) myself\b/,
  /\bself ?harm/,
  /\bdont want to (live|be alive|exist|wake up)\b/,
  /\bbetter off (dead|without me)\b/,
  /\bno reason to (keep )?liv(e|ing)\b/,
  // El apóstrofe se descarta en la normalización ("isn't" → "isnt").
  /\b(not|isnt|is not) worth living\b/,
  /\boverdose\b/,
  /\bhang(ing)? myself\b/,
  /\bjump off (a|the) (bridge|building|roof|balcony)\b/,
  /\bnobody would miss me\b/,
  /\bim a burden\b/,
];

const all = (re) => new RegExp(re.source, 'g');

function safeSpans(s) {
  const spans = [];
  for (const re of SAFE_PHRASES) {
    for (const m of s.matchAll(all(re))) spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}

/**
 * { risk, matches } — `matches` solo sirve para pruebas; la app no muestra
 * ni guarda qué frase activó la tarjeta.
 */
export function screenText(text) {
  const s = normalizeForScreening(text);
  const spans = safeSpans(s);
  const matches = [];
  for (const re of RISK_PATTERNS) {
    for (const m of s.matchAll(all(re))) {
      const start = m.index;
      const end = m.index + m[0].length;
      // Solo se descarta si la coincidencia cae entera dentro de un modismo:
      // "me muero de ganas de morir" sigue siendo riesgo.
      if (spans.some(([a, b]) => start >= a && end <= b)) continue;
      matches.push(m[0].trim());
      break;
    }
  }
  return { risk: matches.length > 0, matches };
}

export const hasCrisisSignals = (...texts) => texts.some((t) => t && screenText(t).risk);
