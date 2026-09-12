import { Request, Response } from 'express';
import { videoRepository } from '../repositories/videoRepository';
import { fail, noStore, ok } from '../utils/http';

export const videoController = {
  async list(_req: Request, res: Response) {
    noStore(res);
    return ok(res, await videoRepository.all());
  },
  async revision(_req: Request, res: Response) {
    noStore(res);
    return ok(res, await videoRepository.revision());
  },
  async get(req: Request, res: Response) {
    noStore(res);
    const video = await videoRepository.byId(req.params.id);
    if (!video) return fail(res, 'Video not found', 404);
    return ok(res, video);
  },
  async categories(_req: Request, res: Response) {
    noStore(res);
    return ok(res, await videoRepository.categories());
  },
};
