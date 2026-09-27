/**
 * Configuración desde el entorno.
 *
 * Falla al arrancar si falta algo, en vez de fallar en la primera petición de
 * un estudiante. Un contenedor que no levanta se nota; uno que levanta y
 * responde 500 a la tercera persona, no.
 */

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${name}. Ver api/.env.example.`
    );
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

export const config = {
  port: Number(optional('PORT', '3000')),
  env: optional('NODE_ENV', 'development'),

  // Cadena del rol de aplicación (raiz_app), NO la del dueño de la base.
  // El dueño no está sujeto a las políticas de seguridad; ver deploy/README.md.
  databaseUrl: required('DATABASE_URL'),

  // Firma de los tokens de sesión. Generar con: openssl rand -base64 48
  jwtSecret: required('JWT_SECRET'),

  // Solo se aceptan correos de este dominio al pedir código de acceso.
  allowedEmailDomain: optional('ALLOWED_EMAIL_DOMAIN', 'upb.edu.co'),

  // URL pública del APK de Android, para /descargar. '' (no definida) es un
  // valor válido a propósito: esa página avisa que la descarga no está lista
  // en vez de ofrecer un botón roto.
  apkUrl: optional('APK_URL', ''),

  // Límites de frecuencia de la comunidad (por persona, por hora). Frenan el
  // spam y la avalancha de acoso sin estorbar a quien escribe de verdad. Se
  // pueden subir por entorno para las pruebas que crean mucho contenido.
  limits: {
    postsPerHour: Number(optional('RATE_LIMIT_POSTS_PER_HOUR', '10')),
    commentsPerHour: Number(optional('RATE_LIMIT_COMMENTS_PER_HOUR', '30')),
    // Mensajes privados (api/src/messages.js): conversaciones NUEVAS por día
    // (frena el "barrido" de contactos) y mensajes por hora (frena el spam
    // dentro de una conversación ya aceptada).
    dmRequestsPerDay: Number(optional('RATE_LIMIT_DM_REQUESTS_PER_DAY', '5')),
    messagesPerHour: Number(optional('RATE_LIMIT_MESSAGES_PER_HOUR', '60')),
  },

  // URL pública del panel de moderación, para el enlace de las alertas de
  // crisis por correo (api/src/alerts.js). Sin definir, el correo igual sale
  // — solo con un enlace vacío — porque la alerta nunca debe fallar por esto.
  panelUrl: optional('PANEL_URL', ''),

  // Apaga el resumen periódico (cada hora) de crisis sin atender. Encendido
  // por defecto; poner MOD_ALERTS=false lo desactiva. La alerta inmediata al
  // retener algo por crisis no depende de esta variable — solo el resumen.
  modAlertsEnabled: optional('MOD_ALERTS', 'true') !== 'false',

  // Apaga las notificaciones push (api/src/push.js) sin tocar nada más: el
  // canal en tiempo real (/ws) sigue funcionando igual. Encendido por
  // defecto; poner PUSH_ENABLED=false lo desactiva.
  pushEnabled: optional('PUSH_ENABLED', 'true') !== 'false',
};

export const isProduction = config.env === 'production';
