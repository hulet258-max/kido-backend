const secretNames = ['DB_PASSWORD', 'DATABASE_URL', 'ADMIN_API_KEY', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'];

export function sanitize(message: string, source: NodeJS.ProcessEnv = process.env) {
  let result = message.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1[REDACTED]@');
  const secrets = secretNames.flatMap((name) => source[name] ? [source[name]!, encodeURIComponent(source[name]!)] : [])
    .sort((a, b) => b.length - a.length);
  for (const secret of secrets) result = result.split(secret).join('[REDACTED]');
  return result.replace(/[\r\n\t]/g, ' ').slice(0, 1000);
}

export function logInfo(service: string, message: string) {
  console.info(`[${service}] ${sanitize(message)}`);
}

export function logError(service: string, operation: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Unexpected error';
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? `${error.code}: ` : '';
  console.error(`[${service}] ${sanitize(`${operation}: ${code}${detail}`)}`);
}
