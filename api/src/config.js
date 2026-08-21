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
};

export const isProduction = config.env === 'production';
