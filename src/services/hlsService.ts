import { spawn } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { env } from '../config/env';

function run(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const process = spawn(command, args, { shell: false, windowsHide: true });
    let output = '';
    let errors = '';
    process.stdout.on('data', (chunk) => (output += chunk.toString()));
    process.stderr.on('data', (chunk) => (errors += chunk.toString()));
    process.on('error', reject);
    process.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Video processing failed${errors ? `: ${errors.slice(-1200)}` : ''}`));
    });
  });
}

export async function segmentToHls(inputPath: string) {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'kido-hls-'));
  try {
    await run(env.ffmpegPath, [
      '-hide_banner', '-y', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a?', '-c', 'copy',
      '-start_number', '0', '-hls_time', '4', '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(outputDir, 'segment%03d.ts'),
      path.join(outputDir, 'playlist.m3u8'),
    ]);
    await readFile(path.join(outputDir, 'playlist.m3u8'), 'utf8');
    return outputDir;
  } catch (error) {
    await rm(outputDir, { recursive: true, force: true });
    throw error;
  }
}

export async function probeVideo(inputPath: string) {
  const output = await run(env.ffprobePath, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', inputPath,
  ]);
  const parsed = JSON.parse(output) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];
  return {
    durationSeconds: Math.max(1, Math.round(Number(parsed.format?.duration ?? 0))),
    orientation: (stream?.height ?? 0) > (stream?.width ?? 0) ? 'vertical' as const : 'horizontal' as const,
  };
}
