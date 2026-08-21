import nodemailer from 'nodemailer';

/**
 * Envío del código de acceso.
 *
 * No hay proveedor de correo institucional todavía (trámite aparte con la
 * UPB). Mientras tanto, cualquier cuenta SMTP sirve para el piloto — incluida
 * una cuenta de Gmail normal con una "contraseña de aplicación" generada en
 * https://myaccount.google.com/apppasswords. Configurar SMTP_HOST=smtp.gmail.com,
 * SMTP_PORT=465, SMTP_USER=<correo>, SMTP_PASS=<contraseña de aplicación>.
 * Ver api/.env.example. Cuando exista un remitente institucional, se cambian
 * esas variables — el código de acá no se toca.
 *
 * Sin SMTP configurado, en desarrollo el código se imprime en el log: permite
 * probar el flujo completo sin depender de nada externo. En producción, sin
 * SMTP configurado, falla ruidoso — es preferible a que el login parezca
 * funcionar y el correo nunca llegue.
 */

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransporter;
}

export async function sendCode({ email, code, lang = 'es' }) {
  const transporter = getTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'sendCode: falta configurar SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS. ' +
        'Ver api/src/mailer.js y api/.env.example.'
      );
    }
    console.log(`[mailer:dev] código para ${email}: ${code}`);
    return;
  }

  const subject = lang === 'en' ? 'Your Raíz access code' : 'Tu código de acceso a Raíz';
  const body = lang === 'en'
    ? `Your code is ${code}. It expires in 10 minutes.`
    : `Tu código es ${code}. Vence en 10 minutos.`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text: body,
  });
}
