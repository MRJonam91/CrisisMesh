// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentity } from '../src/core/identity.ts';
import { encryptPayload, decryptPayload, isEncryptedPayload } from '../src/core/encryption.ts';

test('E2EE: encrypts and decrypts payload between Alice and Bob using X25519 + AES-256-GCM', () => {
  const alice = createIdentity('alice');
  const bob = createIdentity('bob');

  assert.ok(alice.x25519PublicKeyHex);
  assert.ok(bob.x25519PublicKeyHex);
  assert.ok(bob.x25519PrivateKeyPem);

  const sensitiveData = {
    patientName: 'Jane Doe',
    triageLevel: 'red',
    bloodType: 'O_NEG',
    vitals: { hr: 120, bp: '80/50' }
  };

  const encrypted = encryptPayload(
    bob.x25519PublicKeyHex,
    sensitiveData,
    alice.x25519PrivateKeyPem
  );

  assert.equal(isEncryptedPayload(encrypted), true);
  assert.equal(encrypted.algorithm, 'aes-256-gcm-x25519');
  assert.notDeepEqual(encrypted, sensitiveData);

  // Bob decrypts with his private key
  const decrypted = decryptPayload<typeof sensitiveData>(
    encrypted,
    bob.x25519PrivateKeyPem
  );

  assert.deepEqual(decrypted, sensitiveData);
});

test('E2EE: rejects tampered ciphertext or altered auth tag', () => {
  const alice = createIdentity('alice');
  const bob = createIdentity('bob');

  const encrypted = encryptPayload(
    bob.x25519PublicKeyHex!,
    { alert: 'secret' },
    alice.x25519PrivateKeyPem
  );

  // Alter 1 byte in ciphertext
  const tampered = {
    ...encrypted,
    ciphertextHex: encrypted.ciphertextHex.slice(0, -2) + 'ff'
  };

  assert.throws(() => {
    decryptPayload(tampered, bob.x25519PrivateKeyPem!);
  });
});
