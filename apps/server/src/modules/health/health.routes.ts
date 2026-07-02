import { Router } from 'express';

export const healthRoutes = Router().get('/', (_req, res) => {
  res.json({ status: 'ok' });
});
