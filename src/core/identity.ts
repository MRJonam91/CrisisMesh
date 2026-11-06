// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import crypto from 'node:crypto';
import fs from 'node:fs';
import type { MeshIdentity, MeshPacketHeader, MeshPacket } from './types.ts';

/**
 * Deterministic JSON stringifier to ensure reproducible cryptographic digests.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJson(item)).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`
  );
  return '{' + entries.join(',') + '}';
}

/**
 * Generates a new cryptographic Ed25519 identity for a mesh node.
 */
export function createIdentity(name = 'cmesh-node'): MeshIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  const pubDer = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyHex = pubDer.toString('hex');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  // Node ID derived deterministically from SHA-256 of public key
  const pubHash = crypto.createHash('sha256').update(pubDer).digest('hex');
  const nodeId = `cm_${pubHash.substring(0, 16)}`;

  // Generate companion X25519 keypair for authenticated E2EE payload confidentiality
  const xPair = crypto.generateKeyPairSync('x25519');
  const xPubDer = xPair.publicKey.export({ type: 'spki', format: 'der' });
  const x25519PublicKeyHex = xPubDer.toString('hex');
  const x25519PrivateKeyPem = xPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  return {
    nodeId,
    name,
    publicKeyHex,
    privateKeyPem,
    x25519PublicKeyHex,
    x25519PrivateKeyPem,
    createdAt: Date.now()
  };
}

/**
 * Ensures an identity contains X25519 encryption keys, generating them if migrating from legacy.
 */
export function ensureEncryptionKeys(identity: MeshIdentity): MeshIdentity {
  if (identity.x25519PublicKeyHex && identity.x25519PrivateKeyPem) {
    return identity;
  }
  const xPair = crypto.generateKeyPairSync('x25519');
  identity.x25519PublicKeyHex = xPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('hex');
  identity.x25519PrivateKeyPem = xPair.privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();
  return identity;
}

/**
 * Computes canonical payload digest bytes for signing.
 */
export function computeEnvelopeDigest(header: MeshPacketHeader, payload: unknown): Buffer {
  const canonicalString = canonicalJson({
    id: header.id,
    type: header.type,
    sender: header.sender,
    senderPubkey: header.senderPubkey,
    recipient: header.recipient,
    timestamp: header.timestamp,
    ttl: header.ttl,
    maxHops: header.maxHops,
    priority: header.priority,
    payload
  });
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest();
}

/**
 * Signs packet header and payload with node's private Ed25519 key.
 */
export function signPacketEnvelope(
  header: MeshPacketHeader,
  payload: unknown,
  privateKeyPem: string
): string {
  const digest = computeEnvelopeDigest(header, payload);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, digest, privateKey);
  return signature.toString('hex');
}

/**
 * Verifies Ed25519 cryptographic signature of a mesh packet.
 */
export function verifyPacketSignature(packet: MeshPacket): boolean {
  try {
    if (!packet.header || !packet.header.senderPubkey || !packet.signature) {
      return false;
    }
    const digest = computeEnvelopeDigest(packet.header, packet.payload);
    const pubDer = Buffer.from(packet.header.senderPubkey, 'hex');
    const publicKey = crypto.createPublicKey({
      key: pubDer,
      format: 'der',
      type: 'spki'
    });
    return crypto.verify(null, digest, publicKey, Buffer.from(packet.signature, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Saves identity to local JSON file with restricted permission mode.
 */
export function saveIdentityToFile(filePath: string, identity: MeshIdentity): void {
  fs.writeFileSync(filePath, JSON.stringify(identity, null, 2), {
    mode: 0o600,
    encoding: 'utf8'
  });
}

/**
 * Loads identity from local JSON file.
 */
export function loadIdentityFromFile(filePath: string): MeshIdentity {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as MeshIdentity;
  if (!parsed.nodeId || !parsed.publicKeyHex || !parsed.privateKeyPem) {
    throw new Error(`[CMSH-ERR-2101] Invalid identity file schema in ${filePath}`);
  }
  return parsed;
}
