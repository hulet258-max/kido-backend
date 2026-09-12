export function validateEnvironment(source: NodeJS.ProcessEnv = process.env) {
  if (source.SUBSCRIPTION_MONTHLY_BIRR !== undefined &&
      (!Number.isSafeInteger(Number(source.SUBSCRIPTION_MONTHLY_BIRR)) || Number(source.SUBSCRIPTION_MONTHLY_BIRR) <= 0)) {
    throw new Error('SUBSCRIPTION_MONTHLY_BIRR must be a positive whole number');
  }
  if (source.CHAPA_RETURN_URL?.trim()) {
    let url: URL;
    try { url = new URL(source.CHAPA_RETURN_URL); }
    catch { throw new Error('CHAPA_RETURN_URL must be a public HTTPS URL'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
      throw new Error('CHAPA_RETURN_URL must be a public HTTPS URL without credentials or a fragment');
    }
  }
  if (source.NODE_ENV !== 'production') return;
  const usesFields = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].some((key) => source[key]?.trim());
  const required = [
    ...(usesFields || !source.DATABASE_URL ? ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] : ['DATABASE_URL']),
    'ADMIN_API_KEY', 'MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET', 'MINIO_PUBLIC_URL',
  ];
  for (const key of required) {
    const value = source[key]?.trim();
    if (!value || /REPLACE_WITH|YOUR[_-]|CHANGE[_-]?ME/i.test(value)) {
      throw new Error(`Set ${key} to a real production value in the container environment`);
    }
  }
  for (const key of ['PORT', 'DB_PORT', 'MINIO_PORT']) {
    if (source[key] !== undefined && (!/^\d+$/.test(source[key]!) || Number(source[key]) < 1 || Number(source[key]) > 65535)) {
      throw new Error(`${key} must be a port between 1 and 65535`);
    }
  }
  if (source.MINIO_USE_SSL !== undefined && !/^(true|false)$/i.test(source.MINIO_USE_SSL)) {
    throw new Error('MINIO_USE_SSL must be true or false');
  }
  if (source.MINIO_ENDPOINT && /[\s/:]/.test(source.MINIO_ENDPOINT)) {
    throw new Error('MINIO_ENDPOINT must be an internal hostname without protocol, port, or path');
  }
  let publicUrl: URL;
  try { publicUrl = new URL(source.MINIO_PUBLIC_URL!); }
  catch { throw new Error('MINIO_PUBLIC_URL must be the public HTTP(S) storage API origin'); }
  if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/') {
    throw new Error('MINIO_PUBLIC_URL must be an HTTP(S) origin without credentials, query, or path');
  }
  if (publicUrl.port === '9001' || publicUrl.hostname === 'console-mgnot-minio.v3rao3.easypanel.host') {
    throw new Error('MINIO_PUBLIC_URL points to the management console; use an HTTPS domain routed to MinIO API port 9000');
  }
}
