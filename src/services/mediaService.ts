import { createWriteStream, existsSync, mkdirSync } from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Video } from '../models/types';

export const mediaDir = path.resolve(process.cwd(), 'media');

function follow(url: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'KIDO/1.0' } }, (res) => {
      const code = res.statusCode ?? 0;
      const location = res.headers.location;
      if (code >= 300 && code < 400 && location) {
        res.resume();
        follow(location).then(resolve).catch(reject);
        return;
      }
      resolve(res);
    });
    req.on('error', reject);
  });
}

export function localMediaPath(id: string) {
  return path.join(mediaDir, `${id}.mp4`);
}

export function withLocalPlayback(video: Video): Video {
  if (existsSync(localMediaPath(video.id))) {
    return {
      ...video,
      fallbackVideoUrl: video.fallbackVideoUrl ?? video.videoUrl,
      videoUrl: `/media/${video.id}.mp4`,
    };
  }
  return video;
}

export async function downloadVideo(video: Video): Promise<boolean> {
  mkdirSync(mediaDir, { recursive: true });
  const dest = localMediaPath(video.id);
  if (existsSync(dest)) return true;
  const tmp = `${dest}.part`;
  try {
    const res = await follow(video.videoUrl);
    if ((res.statusCode ?? 0) >= 400) {
      res.resume();
      return false;
    }
    await pipeline(res, createWriteStream(tmp));
    const { renameSync } = await import('fs');
    renameSync(tmp, dest);
    return true;
  } catch (err) {
    console.error(`Failed to download ${video.id}`, err);
    return false;
  }
}

export async function ingestCatalog(videos: Video[]) {
  mkdirSync(mediaDir, { recursive: true });
  for (const video of videos) {
    const ok = await downloadVideo(video);
    if (ok) console.log(`Cached public clip ${video.id} -> media/${video.id}.mp4`);
  }
}
