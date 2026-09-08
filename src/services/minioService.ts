import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { Client } from 'minio';
import { env } from '../config/env';
import { retryableOnce } from '../utils/retry';
import { timeoutTransport } from '../utils/timeoutTransport';
import { logError } from '../utils/logger';

const clientOptions = {
  endPoint: env.minioEndpoint,
  port: env.minioPort,
  useSSL: env.minioUseSsl,
  accessKey: env.minioAccessKey,
  secretKey: env.minioSecretKey,
};
const client = new Client(clientOptions);
const startupClient = new Client({
  ...clientOptions,
  transport: timeoutTransport(env.minioUseSsl),
  retryOptions: { disableRetry: true },
});

export const ensureVideoBucket = retryableOnce(async () => {
    if (!(await startupClient.bucketExists(env.minioBucket))) {
      await startupClient.makeBucket(env.minioBucket);
    }
    await startupClient.setBucketPolicy(
      env.minioBucket,
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${env.minioBucket}/*`],
        }],
      }),
    );
});

async function uploadDirectory(videoId: string, directory: string) {
  await ensureVideoBucket();
  const names = await readdir(directory);
  for (const name of names) {
    const filePath = path.join(directory, name);
    const info = await stat(filePath);
    if (!info.isFile()) continue;
    const contentType = name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
    await client.putObject(
      env.minioBucket,
      `${videoId}/${name}`,
      createReadStream(filePath),
      info.size,
      { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
    );
  }
  return `${env.minioPublicUrl.replace(/\/$/, '')}/${env.minioBucket}/${videoId}/playlist.m3u8`;
}

async function deleteObjects(videoId: string) {
  await ensureVideoBucket();
  const names: string[] = [];
  const stream = client.listObjectsV2(env.minioBucket, `${videoId}/`, true);
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (item) => item.name && names.push(item.name));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  if (names.length) await client.removeObjects(env.minioBucket, names);
}

export async function uploadHlsDirectory(videoId: string, directory: string) {
  try { return await uploadDirectory(videoId, directory); }
  catch (error) {
    logError('MinIO', 'Upload HLS objects failed', error);
    throw error;
  }
}

export async function deleteVideoObjects(videoId: string) {
  try { await deleteObjects(videoId); }
  catch (error) {
    logError('MinIO', 'Delete video objects failed', error);
    throw error;
  }
}
