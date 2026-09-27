// Fixture para push-disabled.test.mjs: corre en un proceso propio (spawnSync)
// a propósito. api/src/config.js lee process.env UNA sola vez al importarse,
// y `node --test archivo1 archivo2 ...` corre todos los archivos en el MISMO
// proceso — fijar PUSH_ENABLED=false en un test normal alcanzaría a los
// demás archivos que ya importaron config.js con el valor por defecto. Un
// proceso hijo aparte, con su propio módulo config.js desde cero, es la
// única forma honesta de probar esta variable de entorno.
//
// No toca la base: con PUSH_ENABLED=false, sendPushForNotification() vuelve
// antes de llegar a withServiceRole() (ver api/src/push.js), así que ni
// siquiera hace falta un Postgres real detrás de DATABASE_URL.

import { sendPushForNotification, __setFetchForTests } from '../../src/push.js';

let called = false;
__setFetchForTests(async () => {
  called = true;
  return { json: async () => ({ data: [] }) };
});

await sendPushForNotification('00000000-0000-0000-0000-000000000000', 'post_reaction', {});
process.stdout.write(called ? 'CALLED' : 'NOT_CALLED');
