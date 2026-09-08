import { logError } from './logger';

export async function retryConnection(
  service: string,
  connect: () => Promise<unknown>,
  options: { attempts?: number; delayMs?: number; report?: typeof logError } = {},
) {
  const { attempts = 5, delayMs = 5000, report = logError } = options;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await connect();
      return;
    } catch (error) {
      report(service, `Connection attempt ${attempt}/${attempts} failed`, error);
      if (attempt === attempts) throw new Error(`${service} initialization failed after ${attempts} attempts`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Share successful initialization, but never retain a failed attempt.
export function retryableOnce(initialize: () => Promise<void>) {
  let ready: Promise<void> | undefined;
  return () => {
    ready ??= initialize().catch((error) => {
      ready = undefined;
      throw error;
    });
    return ready;
  };
}
