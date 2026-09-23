import { CryptoUtil } from './crypto.js';
/**
 * Signs a JWT using CryptoUtil HMAC-SHA256.
 */
export function signJwt(payload, secret, expiresInHours = 72) {
    return CryptoUtil.signJwt(payload, secret, expiresInHours);
}
/**
 * Verifies a JWT using CryptoUtil HMAC-SHA256.
 */
export function verifyJwt(token, secret) {
    return CryptoUtil.verifyJwt(token, secret);
}
