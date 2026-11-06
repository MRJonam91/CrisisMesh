// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import crypto from 'node:crypto';
import type { EncryptedPayload } from './types.ts';
import { canonicalJson } from './identity.ts';

/**
 * End-to-End Authenticated Encryption for sensitive direct payloads
 * using X25519 ECDH key exchange and AES-256-GCM.
 */
export function encryptPayload(
  recipientX25519PubHex: string,
  payload: unknown,
  senderX25519PrivPem?: string
): EncryptedPayload {
  const recipientPub = crypto.createPublicKey({
    key: Buffer.from(recipientX25519PubHex, 'hex'),
    format: 'der',
    type: 'spki'
  });

  // Use sender's existing key or generate an ephemeral X25519 key for forward secrecy
  let senderPriv: crypto.KeyObject;
  let ephemeralPublicKeyHex: string;

  if (senderX25519PrivPem) {
    senderPriv = crypto.createPrivateKey(senderX25519PrivPem);
    const pub = crypto.createPublicKey(senderPriv);
    ephemeralPublicKeyHex = pub.export({ type: 'spki', format: 'der' }).toString('hex');
  } else {
    const pair = crypto.generateKeyPairSync('x25519');
    senderPriv = pair.privateKey;
    ephemeralPublicKeyHex = pair.publicKey
      .export({ type: 'spki', format: 'der' })
      .toString('hex');
  }

  const rawSecret = crypto.diffieHellman({
    privateKey: senderPriv,
    publicKey: recipientPub
  });

  // HKDF derivation of 32-byte symmetric AES key
  const aesKey = crypto.hkdfSync('sha256', rawSecret, Buffer.alloc(0), Buffer.from('cmesh-e2ee-v1'), 32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(aesKey), iv);
  const plaintext = Buffer.from(canonicalJson(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    isEncrypted: true,
    algorithm: 'aes-256-gcm-x25519',
    ephemeralPublicKeyHex,
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    ciphertextHex: ciphertext.toString('hex')
  };
}

/**
 * Decrypts an authenticated encrypted payload using recipient's X25519 private key.
 */
export function decryptPayload<T = unknown>(
  encrypted: EncryptedPayload,
  recipientX25519PrivPem: string
): T {
  const senderPub = crypto.createPublicKey({
    key: Buffer.from(encrypted.ephemeralPublicKeyHex, 'hex'),
    format: 'der',
    type: 'spki'
  });

  const recipientPriv = crypto.createPrivateKey(recipientX25519PrivPem);
  const rawSecret = crypto.diffieHellman({
    privateKey: recipientPriv,
    publicKey: senderPub
  });

  const aesKey = crypto.hkdfSync('sha256', rawSecret, Buffer.alloc(0), Buffer.from('cmesh-e2ee-v1'), 32);
  const iv = Buffer.from(encrypted.ivHex, 'hex');
  const authTag = Buffer.from(encrypted.authTagHex, 'hex');
  const ciphertext = Buffer.from(encrypted.ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(aesKey), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function isEncryptedPayload(payload: unknown): payload is EncryptedPayload {
  return (
    payload !== null &&
    typeof payload === 'object' &&
    (payload as Record<string, unknown>)['isEncrypted'] === true &&
    (payload as Record<string, unknown>)['algorithm'] === 'aes-256-gcm-x25519'
  );
}
