/**
 * Recursos de crisis — ÚNICA fuente de verdad para los contactos del SOS.
 *
 * IMPORTANTE: cada número aquí debe estar verificado contra una fuente oficial
 * antes de publicarse. No agregues números "de memoria".
 *
 * Verificado el 2026-08-09:
 *  - 106 · Minsalud, línea nacional de salud mental, gratuita 24/7.
 *    https://www.minsalud.gov.co/salud/publica/salud-mental/Paginas/linea-106.aspx
 *  - 123 · Línea nacional de emergencias.
 *  - Espérame · Alcaldía de Bucaramanga, WhatsApp gratuito (lanzada 2026-04-28).
 *    https://www.vanguardia.com/area-metropolitana/bucaramanga/2026/04/28/
 *
 * PENDIENTE: reemplazar el recurso `upb` con los datos reales que entregue
 * Bienestar Universitario UPB Bucaramanga (teléfono, horario, sede).
 */

// kind: 'tel'      -> marca el número
//       'whatsapp' -> abre wa.me (funciona con o sin la app instalada)
//       'pending'  -> se muestra sin acción, marcado como no disponible aún
// target  -> lo que se marca / el número internacional sin '+' para wa.me
// display -> el mismo dato legible, para mostrarlo si falla abrir la app
export const CRISIS_RESOURCES = [
  {
    id: 'linea106',
    kind: 'tel',
    target: '106',
    display: '106',
    tone: 'rose',
    icon: '📞',
    es: {
      title: 'Línea 106 · Salud mental',
      sub: 'Nacional · Gratuita · 24/7',
      action: 'Llamar',
    },
    en: {
      title: 'Line 106 · Mental health',
      sub: 'Nationwide · Free · 24/7',
      action: 'Call',
    },
  },
  {
    id: 'esperame',
    kind: 'whatsapp',
    target: '573229643755',
    display: '+57 322 964 3755',
    tone: 'sky',
    icon: '💬',
    es: {
      title: 'Espérame · Bucaramanga',
      sub: 'WhatsApp · Gratuito · Alcaldía',
      action: 'Escribir',
    },
    en: {
      title: 'Espérame · Bucaramanga',
      sub: 'WhatsApp · Free · City hall',
      action: 'Message',
    },
  },
  {
    id: 'emergencias',
    kind: 'tel',
    target: '123',
    display: '123',
    tone: 'peach',
    icon: '🚑',
    es: {
      title: 'Línea 123 · Emergencias',
      sub: 'Si hay riesgo inmediato para tu vida',
      action: 'Llamar',
    },
    en: {
      title: 'Line 123 · Emergencies',
      sub: 'If your life is at immediate risk',
      action: 'Call',
    },
  },
  {
    id: 'upb',
    kind: 'pending',
    tone: 'mint',
    icon: '🏛️',
    es: {
      title: 'Consejería UPB',
      sub: 'Estamos coordinando con Bienestar',
      action: 'Pronto',
    },
    en: {
      title: 'UPB counseling',
      sub: 'Being set up with Student Services',
      action: 'Soon',
    },
  },
];
