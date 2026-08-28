import { Router } from 'express';
import { childController, childCreateSchema } from '../controllers/childController';
import { eventController, eventSchema } from '../controllers/eventController';
import { parentController } from '../controllers/parentController';
import { videoController } from '../controllers/videoController';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';

export const router = Router();

router.get('/health', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { status: 'ok', name: 'KIDO', database: 'kido' } });
}));

router.get('/videos', asyncHandler(videoController.list));
router.get('/videos/:id', asyncHandler(videoController.get));
router.get('/categories', asyncHandler(videoController.categories));

router.get('/recommendations/:childId', asyncHandler(parentController.recommendations));

router.get('/children/:id', asyncHandler(childController.get));
router.post('/children', validate(childCreateSchema), asyncHandler(childController.create));
router.put('/children/:id', asyncHandler(childController.update));

router.post('/events', validate(eventSchema), asyncHandler(eventController.create));

router.get('/reports/:childId', asyncHandler(parentController.reports));
router.get('/interests/:childId', asyncHandler(parentController.interests));

router.get('/parent/preferences/:childId', asyncHandler(parentController.getPreferences));
router.put('/parent/preferences/:childId', asyncHandler(parentController.putPreferences));

router.get('/schedules/:childId', asyncHandler(parentController.getSchedule));
router.put('/schedules/:childId', asyncHandler(parentController.putSchedule));

router.post('/parent/pin', asyncHandler(parentController.verifyPin));
