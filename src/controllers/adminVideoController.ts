import { rm } from 'fs/promises';
import path from 'path';
import { Request, Response } from 'express';
import { z } from 'zod';
import { VideoCategory } from '../models/types';
import { videoRepository } from '../repositories/videoRepository';
import { deleteVideoObjects } from '../services/minioService';
import { publishVideoFromPath } from '../services/videoPublishService';
import { incrementedTitle, listVideoFilesInFolder } from '../utils/videoImport';
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
  orientation: z.enum(['vertical', 'horizontal']).optional(),
  creator: z.string().trim().min(1).max(120),
  tags: tagsField,
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
});

const folderSchema = uploadSchema.extend({
  folder: z.string().trim().min(1).max(500),
});

function metadataError(parsed: z.SafeParseReturnType<unknown, { minAge: number; maxAge: number }>) {
  if (!parsed.success) return 'Video metadata is invalid';
  if (parsed.data.minAge > parsed.data.maxAge) return 'Minimum age cannot exceed maximum age';
  return null;
}

export const adminVideoController = {
  async list(_req: Request, res: Response) {
    return ok(res, await videoRepository.all());
  },

  async upload(req: Request, res: Response) {
    if (!req.file) return fail(res, 'A video file is required', 422);
    try {
      const parsed = uploadSchema.safeParse(req.body);
      const error = metadataError(parsed);
      if (error || !parsed.success) return fail(res, error ?? 'Video metadata is invalid', 422, parsed.success ? undefined : parsed.error.flatten());
      const video = await publishVideoFromPath(req.file.path, parsed.data);
      return ok(res, video, 201);
    } finally {
      await rm(req.file.path, { force: true });
    }
  },

  async fromFolder(req: Request, res: Response) {
    const parsed = folderSchema.safeParse(req.body);
    const error = metadataError(parsed);
    if (error || !parsed.success) return fail(res, error ?? 'Video metadata is invalid', 422, parsed.success ? undefined : parsed.error.flatten());

    let files: string[];
    try {
      files = await listVideoFilesInFolder(parsed.data.folder);
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
      const message = cause instanceof Error ? cause.message : '';
      if (code === 'ENOENT' || message.includes('not a folder')) {
        return fail(res, 'That folder does not exist or is not a directory', 422);
      }
      throw cause;
    }
    if (files.length === 0) return fail(res, 'No MP4, MOV, or M4V videos were found in that folder', 422);

    const published = [];
    const failed: Array<{ file: string; error: string }> = [];
    for (let index = 0; index < files.length; index += 1) {
      const filePath = files[index];
      try {
        published.push(await publishVideoFromPath(filePath, {
          ...parsed.data,
          title: incrementedTitle(parsed.data.title, index + 1),
        }));
      } catch (cause) {
        failed.push({
          file: path.basename(filePath),
          error: cause instanceof Error ? cause.message : 'Upload failed',
        });
      }
    }
    if (published.length === 0) {
      return fail(res, 'None of the videos in that folder could be published', 422, { failed });
    }
    return ok(res, { published, failed, total: files.length }, 201);
  },

  async remove(req: Request, res: Response) {
    const video = await videoRepository.byId(req.params.id);
    if (!video) return fail(res, 'Video not found', 404);
    if (video.videoUrl.endsWith('.m3u8')) await deleteVideoObjects(video.id);
    await videoRepository.delete(video.id);
    return ok(res, { id: video.id });
  },
};
