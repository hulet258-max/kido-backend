import { paymentController, checkoutSchema, verifyCheckoutSchema } from '../controllers/paymentController';
import { Router } from 'express';
import { authController, loginSchema, signupSchema } from '../controllers/authController';
import { activityController } from '../controllers/activityController';
import { childController, childCreateSchema } from '../controllers/childController';
import { eventController, eventSchema } from '../controllers/eventController';
import { parentController } from '../controllers/parentController';
import { videoController } from '../controllers/videoController';
import { adminVideoController } from '../controllers/adminVideoController';
import { requireAdmin } from '../middleware/adminAuth';
import { videoUpload } from '../middleware/videoUpload';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';

export const router = Router();

router.get('/health', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { status: 'ok', name: 'KIDO', database: 'kido' } });
}));

router.get('/payments/plans', asyncHandler(paymentController.plans));
router.post('/payments/initialize', validate(checkoutSchema), asyncHandler(paymentController.initialize));
router.post('/payments/verify', validate(verifyCheckoutSchema), asyncHandler(paymentController.verify));
router.post('/payments/finalize', validate(verifyCheckoutSchema), asyncHandler(paymentController.finalize));
router.post('/v1/public/chapa/finalize', validate(verifyCheckoutSchema), asyncHandler(paymentController.finalize));
router.get('/v1/public/chapa/return', asyncHandler(paymentController.returned));
router.get('/payments/return', asyncHandler(paymentController.returned));

router.post('/auth/signup', validate(signupSchema), asyncHandler(authController.signup));
router.post('/auth/login', validate(loginSchema), asyncHandler(authController.login));

router.get('/videos', asyncHandler(videoController.list));
router.get('/videos/:id', asyncHandler(videoController.get));
router.get('/categories', asyncHandler(videoController.categories));
router.get('/activities', asyncHandler(activityController.list));

router.get('/admin/videos', requireAdmin, asyncHandler(adminVideoController.list));
router.post('/admin/videos', requireAdmin, videoUpload.single('video'), asyncHandler(adminVideoController.upload));
router.post('/admin/videos/from-folder', requireAdmin, asyncHandler(adminVideoController.fromFolder));
router.delete('/admin/videos/:id', requireAdmin, asyncHandler(adminVideoController.remove));
router.get('/admin/activities', requireAdmin, asyncHandler(activityController.list));
router.post('/admin/activities', requireAdmin, asyncHandler(activityController.create));
router.put('/admin/activities/:id', requireAdmin, asyncHandler(activityController.update));
router.delete('/admin/activities/:id', requireAdmin, asyncHandler(activityController.remove));

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
