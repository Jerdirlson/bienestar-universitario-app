import { Router } from 'express';
import { withUser } from './db.js';
import { requireSession } from './auth.js';

/**
 * Lo que ve la pestaña Explorar de la app. Solo lectura — administrar este
 * contenido es cosa del panel de administración (ver admin.js), no de la app
 * ni de este router.
 */
export const exploreRouter = Router();
exploreRouter.use(requireSession);

exploreRouter.get('/', async (req, res, next) => {
  try {
    const resources = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select id, category, title, platform, url, image_url
           from public.explore_resources
           order by category, position`
      );
      return rows;
    });
    res.json({ resources });
  } catch (error) {
    next(error);
  }
});
