import { Request, Response } from 'express';
import { videoRepository } from '../repositories/videoRepository';
import { fail, ok } from '../utils/http';

export const videoController = {
  async list(_req: Request, res: Response) {
    return ok(res, await videoRepository.all());
  },
  async get(req: Request, res: Response) {
    const video = await videoRepository.byId(req.params.id);
    if (!video) return fail(res, 'Video not found', 404);
    return ok(res, video);
  },
  async categories(_req: Request, res: Response) {
    return ok(res, await videoRepository.categories());
  },
};
