// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createIdentity,
  signPacketEnvelope,
  verifyPacketSignature,
  saveIdentityToFile,
  loadIdentityFromFile
} from '../src/core/identity.ts';
import { CMSH_MAGIC, CMSH_VERSION, type MeshPacket, type MeshPacketHeader } from '../src/core/types.ts';

test('createIdentity: generates valid Ed25519 identity with deterministic nodeId', () => {
  const id = createIdentity('test-node');
  assert.ok(id.nodeId.startsWith('cm_'));
  assert.equal(id.name, 'test-node');
  assert.equal(typeof id.publicKeyHex, 'string');
  assert.ok(id.publicKeyHex.length >= 64);
  assert.ok(id.privateKeyPem.includes('BEGIN PRIVATE KEY'));
});

test('sign and verify: validates authentic packet envelope', () => {
  const id = createIdentity('signer');
  const header: MeshPacketHeader = {
    id: 'pkt_test_123',
    type: 'alert',
    sender: id.nodeId,
    senderPubkey: id.publicKeyHex,
    recipient: '*',
    timestamp: Date.now(),
    ttl: 3600,
    maxHops: 5,
    hopCount: 0,
    path: [id.nodeId],
    priority: 'critical'
  };
  const payload = { alert: 'Flood alarm', level: 3 };

  const signature = signPacketEnvelope(header, payload, id.privateKeyPem);
  const packet: MeshPacket = {
    magic: CMSH_MAGIC,
    version: CMSH_VERSION,
    header,
    payload,
    signature
  };

  const isValid = verifyPacketSignature(packet);
  assert.equal(isValid, true);
});

test('verify: rejects tampered packet payload', () => {
  const id = createIdentity('victim');
  const header: MeshPacketHeader = {
    id: 'pkt_test_tamper',
    type: 'alert',
    sender: id.nodeId,
    senderPubkey: id.publicKeyHex,
    recipient: '*',
    timestamp: Date.now(),
    ttl: 3600,
    maxHops: 5,
    hopCount: 0,
    path: [id.nodeId],
    priority: 'high'
  };
  const originalPayload = { coordinates: [45.07, 7.68] };
  const signature = signPacketEnvelope(header, originalPayload, id.privateKeyPem);

  const tamperedPacket: MeshPacket = {
    magic: CMSH_MAGIC,
    version: CMSH_VERSION,
    header,
    payload: { coordinates: [0.0, 0.0] }, // Attacker modified coords!
    signature
  };

  const isValid = verifyPacketSignature(tamperedPacket);
  assert.equal(isValid, false);
});

test('save and load identity: roundtrip file storage', () => {
  const original = createIdentity('persisted-node');
  const tmpFile = path.join(os.tmpdir(), `cmesh-id-${Date.now()}.json`);

  try {
    saveIdentityToFile(tmpFile, original);
    const loaded = loadIdentityFromFile(tmpFile);
    assert.equal(loaded.nodeId, original.nodeId);
    assert.equal(loaded.publicKeyHex, original.publicKeyHex);
    assert.equal(loaded.privateKeyPem, original.privateKeyPem);
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
});
