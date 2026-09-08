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

function describeError(error: unknown, depth = 0): string {
  if (!(error instanceof Error)) return 'Unexpected error';
  const code = 'code' in error && typeof error.code === 'string' ? `${error.code}: ` : '';
  const summary = `${code}${error.message.trim() || error.name || 'Error without a message'}`;
  if (depth >= 3) return summary;
  const children: unknown[] = error instanceof AggregateError ? error.errors.slice(0, 4) : [];
  if (error.cause !== undefined) children.push(error.cause);
  return children.length ? `${summary} [${children.map((child) => describeError(child, depth + 1)).join('; ')}]` : summary;
}

export function logError(service: string, operation: string, error: unknown) {
  console.error(`[${service}] ${sanitize(`${operation}: ${describeError(error)}`)}`);
}
