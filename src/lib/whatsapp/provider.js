import { createMockWhatsAppProvider } from '@/lib/whatsapp/mock';
import { createOgensyncWhatsAppProvider } from '@/lib/whatsapp/ogensync';

/**
 * Read a configuration variable from Worker `env` or Node `process.env` safely.
 *
 * @param {Record<string, unknown>} workerEnv
 * @param {string} key
 * @param {string} [fallback]
 * @returns {string | undefined}
 */
export function readConfigString(workerEnv, key, fallback) {
  const fromWorker = workerEnv?.[key];
  if (typeof fromWorker === 'string' && fromWorker.trim().length > 0) {
    return fromWorker.trim();
  }
  const fromProcess = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }
  return fallback;
}

/**
 * Resolve the configured WhatsApp OTP provider (`MOCK` or `OGENSYNC`) per request.
 *
 * @param {Record<string, unknown>} [workerEnv]
 */
export function createWhatsAppProvider(workerEnv = {}) {
  const providerName = (readConfigString(workerEnv, 'WHATSAPP_PROVIDER', 'MOCK') || 'MOCK').toUpperCase();
  const environment = readConfigString(workerEnv, 'ENVIRONMENT', readConfigString(workerEnv, 'NODE_ENV', 'development'));
  const instituteName = readConfigString(workerEnv, 'NEXT_PUBLIC_INSTITUTE_NAME', 'Apex Coaching Institute');

  if (providerName === 'MOCK') {
    if (environment === 'production') {
      throw new Error('WHATSAPP_PROVIDER="MOCK" is forbidden in production environments.');
    }
    return createMockWhatsAppProvider({ environment });
  }

  if (providerName === 'OGENSYNC') {
    const apiKey = readConfigString(workerEnv, 'WHATSAPP_API_KEY') || readConfigString(workerEnv, 'TRANSPORT_API_KEY');
    const baseUrl = readConfigString(workerEnv, 'OGENSYNC_BASE_URL', 'https://transport.ogensync.com');
    return createOgensyncWhatsAppProvider({
      apiKey: apiKey ?? '',
      baseUrl,
      instituteName,
    });
  }

  throw new Error(`Unsupported WHATSAPP_PROVIDER "${providerName}". Expected MOCK or OGENSYNC.`);
}
