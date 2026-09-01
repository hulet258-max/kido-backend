import { randomUUID } from 'crypto';
import { rm } from 'fs/promises';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Video, VideoCategory } from '../models/types';
import { videoRepository } from '../repositories/videoRepository';
import { probeVideo, segmentToHls } from '../services/hlsService';
import { deleteVideoObjects, uploadHlsDirectory } from '../services/minioService';
import { fail, ok } from '../utils/http';

const categories = [
  'animals', 'science', 'education', 'drawing', 'stories', 'sports',
  'ethiopia', 'language', 'music', 'religious', 'nature', 'entertainment',
] as const satisfies readonly VideoCategory[];

const booleanField = z.preprocess((value) => value === true || value === 'true', z.boolean());
const tagsField = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}, z.array(z.string().min(1)).max(30));

const uploadSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(2000),
  category: z.enum(categories),
  language: z.enum(['en', 'am', 'om', 'ti', 'so']).default('en'),
  minAge: z.coerce.number().int().min(3).max(15),
  maxAge: z.coerce.number().int().min(3).max(15),
  isShort: booleanField.default(false),
  isEducational: booleanField.default(false),
  isReligious: booleanField.default(false),
  creator: z.string().trim().min(1).max(120),
  tags: tagsField,
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
});

export const adminVideoController = {
  async list(_req: Request, res: Response) {
    return ok(res, await videoRepository.all());
  },

  async upload(req: Request, res: Response) {
    if (!req.file) return fail(res, 'A video file is required', 422);
    let outputDir: string | undefined;
    let videoId: string | undefined;
    try {
      const parsed = uploadSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 'Video metadata is invalid', 422, parsed.error.flatten());
      if (parsed.data.minAge > parsed.data.maxAge) return fail(res, 'Minimum age cannot exceed maximum age', 422);

      const id = `video_${randomUUID()}`;
      videoId = id;
      const probe = await probeVideo(req.file.path);
      outputDir = await segmentToHls(req.file.path);
      const playlistUrl = await uploadHlsDirectory(id, outputDir);
      const video: Video = {
        id,
        title: parsed.data.title,
        description: parsed.data.description,
        videoUrl: playlistUrl,
        thumbnailUrl: parsed.data.thumbnailUrl || '',
        category: parsed.data.category,
        language: parsed.data.language,
        minAge: parsed.data.minAge,
        maxAge: parsed.data.maxAge,
        durationSeconds: probe.durationSeconds,
        orientation: probe.orientation,
        isShort: parsed.data.isShort,
        isEducational: parsed.data.isEducational,
        isReligious: parsed.data.isReligious,
        creator: parsed.data.creator,
        tags: parsed.data.tags,
      };
      await videoRepository.save(video);
      return ok(res, video, 201);
    } catch (error) {
      if (videoId) {
        try { await deleteVideoObjects(videoId); } catch {}
      }
      throw error;
    } finally {
      await rm(req.file.path, { force: true });
      if (outputDir) await rm(outputDir, { recursive: true, force: true });
    }
  },

  async remove(req: Request, res: Response) {
    const video = await videoRepository.byId(req.params.id);
    if (!video) return fail(res, 'Video not found', 404);
    if (video.videoUrl.endsWith('.m3u8')) await deleteVideoObjects(video.id);
    await videoRepository.delete(video.id);
    return ok(res, { id: video.id });
  },
};
