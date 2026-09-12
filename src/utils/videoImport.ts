import { readdir, stat } from 'fs/promises';
import path from 'path';

const videoExtensions = new Set(['.mp4', '.mov', '.m4v']);

export function isVideoFileName(name: string) {
  return videoExtensions.has(path.extname(name).toLowerCase());
}

export function incrementedTitle(base: string, index: number) {
  const suffix = ` ${index}`;
  return `${base.slice(0, Math.max(1, 160 - suffix.length))}${suffix}`;
}

export async function listVideoFilesInFolder(folder: string) {
  const resolved = path.resolve(folder);
  const info = await stat(resolved);
  if (!info.isDirectory()) {
    throw new Error('The given path is not a folder');
  }
  const entries = await readdir(resolved, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && isVideoFileName(entry.name))
    .map((entry) => path.join(resolved, entry.name))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right), undefined, { numeric: true, sensitivity: 'base' }));
}
