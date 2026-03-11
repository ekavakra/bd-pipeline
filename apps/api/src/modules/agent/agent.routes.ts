/**
 * Agent Routes
 *
 * Admin-only endpoints for monitoring, configuring, and
 * triggering the autonomous AI agent system.
 *
 * All routes require authentication + ADMIN role.
 */

import { Router } from 'express';
import { agentController } from './agent.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

// All agent routes require ADMIN
router.use(authenticate, requireRole('ADMIN'));

// Status overview
router.get('/status', agentController.getStatus);

// Activity logs
router.get('/activity', agentController.getActivity);

// Config CRUD
router.get('/config', agentController.getAllConfigs);
router.get('/config/:agentName', agentController.getConfig);
router.patch('/config/:agentName', agentController.updateConfig);

// Manual trigger
router.post('/trigger/:agentName', agentController.triggerAgent);

// Event feed
router.get('/events', agentController.getEvents);

export default router;
