import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { config } from './config.js';
import { withoutUser, withUser, withServiceRole } from './db.js';
import { sendCode } from './mailer.js';

/**
 * Login por código de correo institucional.
 *
 * Dos rutas: pedir el código (envía uno nuevo al correo, o no hace nada si ya
 * hay uno vigente) y verificarlo (crea la cuenta si es la primera vez, y
 * devuelve el JWT que el resto del API espera en Authorization: Bearer).
 *
 * El código nunca se guarda en claro — ver la migración access_codes — así
 * que "verificar" siempre compara hashes, nunca el valor recibido contra una
 * columna de texto plano.
 */

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MIN_SECONDS_BETWEEN_CODES = 60;

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

const isAllowedEmail = (email) => {
  if (typeof email !== 'string') return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === config.allowedEmailDomain.toLowerCase();
};

function signSession(userId) {
  // 180 días: no hay flujo de refresco todavía. Cuando exista SSO real, este
  // login por código pasa a ser el respaldo, no el camino principal, y ahí
  // sí vale la pena acortar esto y agregar refresco.
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '180d' });
}

export const authRouter = Router();

authRouter.post('/request-code', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!isAllowedEmail(email)) {
      return res.status(400).json({ error: 'dominio_no_permitido' });
    }

    await withoutUser(async (client) => {
      // attempts < MAX_ATTEMPTS es a propósito: un código que ya se bloqueó a
      // fuerza de intentos fallidos no debe seguir contando como "vigente" —
      // si no, alguien que se equivoca escribiendo su código queda esperando
      // el enfriamiento entero antes de poder pedir uno nuevo.
      const { rows } = await client.query(
        `select id from auth.access_codes
           where email = $1 and consumed_at is null and expires_at > now()
             and attempts < $2
           order by created_at desc limit 1`,
        [email, MAX_ATTEMPTS]
      );
      const vigente = rows[0];
      if (vigente) {
        const { rows: edadRows } = await client.query(
          `select extract(epoch from now() - created_at)::int as segundos
             from auth.access_codes where id = $1`,
          [vigente.id]
        );
        if (edadRows[0].segundos < MIN_SECONDS_BETWEEN_CODES) {
          // Ya se envió uno hace muy poco. Responder igual que si se hubiera
          // enviado — no hay que darle a quien llama información sobre el
          // estado interno de los códigos.
          return;
        }
      }

      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      await client.query(
        `insert into auth.access_codes (email, code_hash, expires_at)
           values ($1, $2, now() + interval '${CODE_TTL_MINUTES} minutes')`,
        [email, hashCode(code)]
      );

      await sendCode({ email, code, lang: req.body?.lang });
    });

    res.status(202).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/verify-code', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const code = String(req.body?.code ?? '').trim();
    if (!isAllowedEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'solicitud_invalida' });
    }

    const userId = await withoutUser(async (client) => {
      const { rows } = await client.query(
        `select id, code_hash, attempts from auth.access_codes
           where email = $1 and consumed_at is null and expires_at > now()
           order by created_at desc limit 1`,
        [email]
      );
      const pendiente = rows[0];
      if (!pendiente || pendiente.attempts >= MAX_ATTEMPTS) return null;

      if (pendiente.code_hash !== hashCode(code)) {
        await client.query(
          `update auth.access_codes set attempts = attempts + 1 where id = $1`,
          [pendiente.id]
        );
        return null;
      }

      await client.query(
        `update auth.access_codes set consumed_at = now() where id = $1`,
        [pendiente.id]
      );

      // auth.find_or_create_user (migración access_codes) es security definer:
      // anon no tiene ningún grant directo sobre auth.users, a propósito.
      // El trigger on_auth_user_created (initial_schema.sql) crea el profiles
      // correspondiente solo cuando la fila es nueva — el "do update" de
      // adentro de la función no lo duplica en logins siguientes.
      const { rows: userRows } = await client.query(
        `select auth.find_or_create_user($1) as id`,
        [email]
      );
      return userRows[0].id;
    });

    if (!userId) {
      return res.status(401).json({ error: 'codigo_invalido' });
    }

    res.json({ token: signSession(userId) });
  } catch (error) {
    next(error);
  }
});

// ── login por correo y contraseña (cuentas de prueba, ver migración
// password_auth) ──────────────────────────────────────────────────────────
//
// Freno de fuerza bruta en memoria: alcanza para una sola instancia, y esta
// ruta es exactamente para eso — cuentas de prueba, no el login principal.
// Si algún día crece a algo con más de un proceso, esto tiene que pasar a la
// base (igual que attempts en access_codes).
const passwordFailures = new Map(); // email -> { count, lockedUntil }
const PASSWORD_MAX_ATTEMPTS = 10;
const PASSWORD_LOCKOUT_MS = 15 * 60 * 1000;

function passwordRateLimited(email) {
  const entry = passwordFailures.get(email);
  return Boolean(entry?.lockedUntil && entry.lockedUntil > Date.now());
}

function recordPasswordFailure(email) {
  const entry = passwordFailures.get(email) ?? { count: 0 };
  entry.count += 1;
  if (entry.count >= PASSWORD_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + PASSWORD_LOCKOUT_MS;
    entry.count = 0;
  }
  passwordFailures.set(email, entry);
}

authRouter.post('/login-password', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      return res.status(400).json({ error: 'solicitud_invalida' });
    }
    if (passwordRateLimited(email)) {
      return res.status(429).json({ error: 'demasiados_intentos' });
    }

    const userId = await withoutUser(async (client) => {
      const { rows } = await client.query(
        `select auth.verify_password($1, $2) as id`,
        [email, password]
      );
      return rows[0].id;
    });

    if (!userId) {
      recordPasswordFailure(email);
      return res.status(401).json({ error: 'credenciales_invalidas' });
    }
    passwordFailures.delete(email);

    res.json({ token: signSession(userId) });
  } catch (error) {
    next(error);
  }
});

/**
 * Middleware: exige Authorization: Bearer <token>, lo valida y deja
 * req.userId listo para que las rutas protegidas lo pasen a withUser.
 * No toca la base — la identidad la impone Postgres vía withUser, esto solo
 * decide si hay una sesión válida para intentarlo.
 */
export function requireSession(req, res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'sin_sesion' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'sesion_invalida' });
  }
}

const AVATAR_COLORS = ['lilac', 'mint', 'sun', 'peach', 'sky', 'rose'];
// Largo en puntos de código, que es lo que mide char_length() en Postgres.
// .length de JS cuenta unidades UTF-16 y un emoji suele valer 2.
const codepoints = (s) => [...s].length;

const PROFILE_SELECT = `display_name, role, locale, created_at, public_id, avatar_emoji, avatar_color, bio`;

async function readProfile(client) {
  const emailResult = await client.query('select auth.my_email() as email');
  const profileResult = await client.query(
    `select ${PROFILE_SELECT} from public.profiles where id = auth.uid()`
  );
  return { email: emailResult.rows[0].email, ...profileResult.rows[0] };
}

/**
 * Datos de la sesión activa. auth.my_email() (migración password_auth) solo
 * puede devolver el correo de auth.uid() — no de un id arbitrario — así que
 * esto no puede convertirse por accidente en "el correo de cualquiera".
 * El resto sale de public.profiles, con RLS que solo deja ver la fila propia
 * (profiles_select_own).
 */
authRouter.get('/me', requireSession, async (req, res, next) => {
  try {
    const data = await withUser(req.userId, readProfile);
    // Token bien firmado pero de una cuenta que ya no existe (se borró desde
    // otro teléfono o desde el panel): antes respondía 200 con todo en null,
    // y la app seguía "con sesión" sin poder guardar nada. Es una sesión
    // inválida, y así la trata la app (vuelve al login).
    if (!data.email || !data.public_id) {
      return res.status(401).json({ error: 'sesion_invalida' });
    }
    res.json({ id: req.userId, ...data });
  } catch (error) {
    next(error);
  }
});

/**
 * Edición parcial del perfil propio. Solo toca columnas con grant de update
 * para authenticated (display_name, locale, avatar_emoji, avatar_color, bio —
 * ver row_level_security.sql y public_profiles.sql): no hay forma de que esto
 * cambie `role` o `public_id`, ni siquiera si el cliente mandara más campos.
 */
authRouter.patch('/profile', requireSession, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const sets = [];
    const params = [];
    const set = (column, value) => { params.push(value); sets.push(`${column} = $${params.length}`); };

    if (body.displayName !== undefined) {
      const displayName = String(body.displayName ?? '').trim();
      if (codepoints(displayName) < 2 || codepoints(displayName) > 40) {
        return res.status(400).json({ error: 'nombre_invalido' });
      }
      set('display_name', displayName);
    }
    if (body.avatarEmoji !== undefined) {
      const emoji = typeof body.avatarEmoji === 'string' ? body.avatarEmoji.trim() : '';
      if (codepoints(emoji) < 1 || codepoints(emoji) > 8) return res.status(400).json({ error: 'avatar_invalido' });
      set('avatar_emoji', emoji);
    }
    if (body.avatarColor !== undefined) {
      if (!AVATAR_COLORS.includes(body.avatarColor)) return res.status(400).json({ error: 'avatar_invalido' });
      set('avatar_color', body.avatarColor);
    }
    if (body.bio !== undefined) {
      if (body.bio !== null && typeof body.bio !== 'string') return res.status(400).json({ error: 'bio_invalida' });
      const bio = (body.bio ?? '').trim();
      if (codepoints(bio) > 160) return res.status(400).json({ error: 'bio_invalida' });
      set('bio', bio || null);
    }
    if (body.locale !== undefined) {
      if (!['es', 'en'].includes(body.locale)) return res.status(400).json({ error: 'locale_invalido' });
      set('locale', body.locale);
    }
    // Compatibilidad v1: un PATCH vacío era "nombre inválido".
    if (sets.length === 0) return res.status(400).json({ error: 'nombre_invalido' });

    const profile = await withUser(req.userId, async (client) => {
      await client.query(`update public.profiles set ${sets.join(', ')} where id = auth.uid()`, params);
      return readProfile(client);
    });

    res.json({ ok: true, profile: { id: req.userId, ...profile } });
  } catch (error) {
    next(error);
  }
});

/**
 * Borrar la propia cuenta y TODO lo suyo: auth.users cae en cascada sobre
 * profiles, diario, publicaciones, comentarios, reacciones, guardados,
 * seguimientos, bloqueos y notificaciones.
 *
 * service_role porque authenticated no tiene (ni debe tener) delete sobre
 * auth.users. El id sale del token ya verificado por requireSession, nunca
 * del cuerpo: esta ruta solo puede borrar a quien la llama.
 *
 * moderation_actions.moderator_id es on delete restrict a propósito: quien
 * tiene historial de moderación no se borra así (409), para no vaciar la
 * bitácora de auditoría.
 */
authRouter.delete('/account', requireSession, async (req, res, next) => {
  try {
    await withServiceRole((client) =>
      client.query('delete from auth.users where id = $1', [req.userId]));
    res.json({ ok: true });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'tiene_historial_de_moderacion' });
    }
    next(error);
  }
});
