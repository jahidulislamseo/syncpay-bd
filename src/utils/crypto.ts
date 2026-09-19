import crypto from 'node:crypto';

export class CryptoUtil {
  /**
   * Generates a SHA-256 hash of an API key or device token for secure storage
   */
  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Generates an HMAC-SHA256 signature for webhook payload verification
   * Format: sha256=<hex_digest>
   */
  public static signWebhook(payload: Record<string, any> | string, secret: string): string {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
    return `sha256=${hmac}`;
  }

  /**
   * Constant-time comparison to prevent timing attacks when verifying webhook signatures
   */
  public static verifyWebhookSignature(payload: string, signatureHeader: string, secret: string): boolean {
    const expected = this.signWebhook(payload, secret);
    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /**
   * Generate secure random API key or webhook secret
   */
  public static generateSecret(prefix: string = 'whsec'): string {
    return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
  }
}
