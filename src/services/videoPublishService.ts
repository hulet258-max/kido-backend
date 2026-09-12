import { randomUUID } from 'crypto';
import { rm } from 'fs/promises';
import { Video, VideoCategory, LanguageCode } from '../models/types';
import { videoRepository } from '../repositories/videoRepository';
import { probeVideo, segmentToHls } from './hlsService';
import { deleteVideoObjects, uploadHlsDirectory } from './minioService';

export type VideoPublishMetadata = {
  title: string;
  description: string;
  category: VideoCategory;
  language: LanguageCode;
  minAge: number;
  maxAge: number;
  isShort: boolean;
  isEducational: boolean;
  isReligious: boolean;
  creator: string;
  tags: string[];
  thumbnailUrl?: string;
};

export async function publishVideoFromPath(filePath: string, metadata: VideoPublishMetadata) {
  let outputDir: string | undefined;
  const id = `video_${randomUUID()}`;
  try {
    const probe = await probeVideo(filePath);
    outputDir = await segmentToHls(filePath);
    const playlistUrl = await uploadHlsDirectory(id, outputDir);
    const video: Video = {
      id,
      title: metadata.title,
      description: metadata.description,
      videoUrl: playlistUrl,
      thumbnailUrl: metadata.thumbnailUrl || '',
      category: metadata.category,
      language: metadata.language,
      minAge: metadata.minAge,
      maxAge: metadata.maxAge,
      durationSeconds: probe.durationSeconds,
      orientation: probe.orientation,
      isShort: metadata.isShort,
      isEducational: metadata.isEducational,
      isReligious: metadata.isReligious,
      creator: metadata.creator,
      tags: metadata.tags,
      createdAt: new Date().toISOString(),
    };
    await videoRepository.save(video);
    return video;
  } catch (error) {
    try { await deleteVideoObjects(id); } catch {}
    throw error;
  } finally {
    if (outputDir) await rm(outputDir, { recursive: true, force: true });
  }
}
