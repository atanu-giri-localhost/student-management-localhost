/**
 * Mock WhatsApp OTP provider for local development and automated test suites.
 * Never incurs external API charges; never writes OTP values in production environments.
 */

/**
 * Create a mock WhatsApp OTP provider instance.
 *
 * @param {{ environment?: string, onOtpSent?: (payload: { phoneNormalized: string, otpCode: string, challengeId: string, expiryMinutes: number }) => void }} [options]
 */
export function createMockWhatsAppProvider(options = {}) {
  const { environment = 'development', onOtpSent } = options;

  return {
    name: 'MOCK',

    /**
     * Record a mock OTP dispatch without making external network requests.
     *
     * @param {{ phoneNormalized: string, otpCode: string, challengeId: string, expiryMinutes: number }} params
     * @returns {Promise<{ ok: boolean, providerJobId: string | null, status: string, errorCode?: string }>}
     */
    async sendOtp({ phoneNormalized, otpCode, challengeId, expiryMinutes }) {
      const mockJobId = `mock_${challengeId}`;

      if (typeof onOtpSent === 'function') {
        onOtpSent({ phoneNormalized, otpCode, challengeId, expiryMinutes });
      } else if (environment === 'development') {
        const masked = `${phoneNormalized.slice(0, 4)}••••${phoneNormalized.slice(-3)}`;
        console.info(`[SMS:MOCK_OTP] Dispatched challenge ${challengeId} to ${masked} (OTP: ${otpCode}, expires in ${expiryMinutes}m)`);
      }

      return {
        ok: true,
        providerJobId: mockJobId,
        status: 'queued',
      };
    },

    /**
     * Report mock WhatsApp socket session health.
     */
    async checkSessionStatus() {
      return {
        ok: true,
        connected: true,
        state: 'mock_ready',
      };
    },
  };
}
