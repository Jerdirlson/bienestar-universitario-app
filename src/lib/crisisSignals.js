/**
 * Detección local de señales de riesgo en lo que alguien escribe en su diario.
 *
 * Corre solo en el teléfono: el texto no se envía a ningún lado para esto. No
 * diagnostica nada ni bloquea el guardado; si encuentra algo, la app ofrece con
 * cariño el acceso a la pantalla de apoyo (Sos). Por eso se prefiere algún
 * falso positivo antes que callar ante un "me quiero morir" real — pero se
 * descartan primero las exageraciones cotidianas ("me muero de la risa", "me
 * voy a matar estudiando") para que la tarjeta no aparezca a la ligera y la
 * persona no aprenda a ignorarla.
 *
 * Todo se compara sin tildes, en minúsculas y sin letras alargadas
 * ("quierooo morirrr" → "quiero morir").
 */

const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u' };

export function normalizeForScreening(text) {
  return ` ${String(text ?? '')
    .toLowerCase()
    .replace(/[áéíóúüñàèìòù]/g, (c) => ACCENTS[c])
    .replace(/['’`´]/g, '')
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

// Frases que se quitan antes de buscar: exageraciones, negaciones y contextos
// informativos que usan las mismas palabras.
const HYPERBOLE_OBJECTS = 'risa|hambre|sueno|frio|calor|ganas|amor|verguenza|pena|nervios|aburrimiento|cansancio|envidia|curiosidad|emocion|felicidad|alegria|sed|miedo|susto|dolor de cabeza';
const SAFE_PHRASES = [
  // es
  new RegExp(`\\b(me )?(muero|moria|mori|morire|muriendo|morirme|morir|morirse|muerto|muerta|muertos|muertas) (de|del) (la |el )?(${HYPERBOLE_OBJECTS})\\b`, 'g'),
  /\b(me )?(muero|muriendo|moria) por\b/g,
  /\b(matarme|me mato|me voy a matar|me estoy matando|me mate|nos vamos a matar) (estudiando|trabajando|entrenando|corriendo|leyendo|haciendo tareas|a estudiar|en el gym|en el gimnasio|de la risa|de risa)\b/g,
  /\bno (me )?quiero morir(me)?\b/g,
  /\bprevencion del suicidio\b/g,
  /\bcortarme (el|los|las|la) (pelo|cabello|unas|fleco|flequillo|barba|puntas)\b/g,
  // en
  /\b(dying|die|died|dead) (of|from) (laughter|laughing|embarrassment|boredom|shame|cringe|hunger)\b/g,
  /\b(dying|died) laughing\b/g,
  /\bdying to\b/g,
  /\bkill(ing)? myself laughing\b/g,
  /\bdont want to die\b/g,
  /\bsuicide (squad|prevention)\b/g,
];

const RISK_PATTERNS = [
  // ── español ────────────────────────────────────────────────────────────────
  /\b(me )?(quiero|quisiera|queria|deseo|ganas de|prefiero|preferiria) morir/,
  /\bme (quiero|quisiera|voy a) morir\b/,
  /\b(me quiero|me voy a|pienso en) matar\b/,
  /\bmatarme\b/,
  /\bsuicid/,
  /\bquitarme la vida\b/,
  /\b(acabar|terminar|ponerle fin a|ponerle fin) (con )?(mi vida|todo de una vez)\b/,
  /\bno (quiero|deseo|aguanto) (seguir )?(vivir|viviendo|existir|estar vivo|estar viva|despertar|despertarme)\b/,
  /\bno (vale|tiene sentido) (la pena )?(seguir )?(vivir|viviendo)\b/,
  /\bla vida no (vale la pena|tiene sentido)\b/,
  /\bno tengo (razon|razones|motivo|motivos) (para|por las que) vivir\b/,
  /\b(mejor|preferiria|estaria mejor|ojala estuviera)( estar)? muert[oa]s?\b/,
  /\bojala no (despertar|despertara|existiera|hubiera nacido)\b/,
  /\b(hacerme|me hago|me hice|me voy a hacer|quiero hacerme) dano\b/,
  /\b(lastimarme|herirme|autolesion|autolesionarme|autolesiones|me autolesiono)\b/,
  /\b(cortarme|me corto|me corte|me cortaba) (las |los |la |el )?(venas|vena|brazos|brazo|munecas|muneca|piernas|pierna|piel)\b/,
  /\b(tomarme|me tome|me voy a tomar) todas las pastillas\b/,
  /\bsobredosis\b/,
  /\bahorcarme\b/,
  /\b(tirarme|lanzarme|me voy a tirar|me voy a lanzar) (de|desde|por) (un|una|el|la) (puente|edificio|balcon|ventana|piso|techo|terraza)\b/,
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
  /\btake my (own )?life\b/,
  /\b(hurt|harm|cut|hurting|harming|cutting) myself\b/,
  /\bself ?harm/,
  /\bdont want to (live|be alive|exist|wake up)\b/,
  /\bbetter off (dead|without me)\b/,
  /\bno reason to live\b/,
  /\bnot worth living\b/,
  /\boverdose\b/,
  /\bhang myself\b/,
  /\bjump off (a|the) (bridge|building|roof|balcony)\b/,
  /\bnobody would miss me\b/,
  /\bim a burden\b/,
];

/**
 * { risk, matches } — `matches` solo sirve para pruebas; la app no muestra
 * ni guarda qué frase activó la tarjeta.
 */
export function screenText(text) {
  let s = normalizeForScreening(text);
  for (const re of SAFE_PHRASES) s = s.replace(re, ' ');
  const matches = [];
  for (const re of RISK_PATTERNS) {
    const m = s.match(re);
    if (m) matches.push(m[0].trim());
  }
  return { risk: matches.length > 0, matches };
}

export const hasCrisisSignals = (...texts) => texts.some((t) => t && screenText(t).risk);
