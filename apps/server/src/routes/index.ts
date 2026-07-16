import { Router } from 'express';
import { healthRoutes } from '../modules/health/health.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { usersRoutes } from '../modules/users/users.routes';
import { projectsRoutes } from '../modules/projects/projects.routes';
import { templatesRoutes } from '../modules/templates/templates.routes';
import { dataRoutes } from '../modules/data/data.routes';
import { lookupRoutes } from '../modules/lookup/lookup.routes';
import { campaignsRoutes } from '../modules/campaigns/campaigns.routes';
import { shareRoutes } from '../modules/share/share.routes';
import { uploadRoutes } from '../modules/upload/upload.routes';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => res.json({ name: 'mediakit-api', version: '0.1.0' }));

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/admin/users', usersRoutes);
apiRouter.use('/projects', projectsRoutes);
apiRouter.use('/templates', templatesRoutes);
apiRouter.use('/data', dataRoutes);
apiRouter.use('/lookup', lookupRoutes);
apiRouter.use('/campaigns', campaignsRoutes);
apiRouter.use('/share', shareRoutes);
apiRouter.use('/uploads', uploadRoutes);
