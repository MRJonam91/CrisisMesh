// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { StoreAndForwardQueue } from '../src/core/storage.ts';
import { createIdentity, signPacketEnvelope } from '../src/core/identity.ts';
import { CMSH_MAGIC, CMSH_VERSION, type MeshPacket, type MeshPriority } from '../src/core/types.ts';

function createSignedPacket(id: string, priority: MeshPriority): MeshPacket {
  const node = createIdentity('persisted-sender');
  const header = {
    id,
    type: 'alert' as const,
    sender: node.nodeId,
    senderPubkey: node.publicKeyHex,
    recipient: '*',
    timestamp: Date.now(),
    ttl: 3600,
    maxHops: 5,
    hopCount: 0,
    path: [node.nodeId],
    priority
  };
  const payload = { persisted: true, seq: id };
  const signature = signPacketEnvelope(header, payload, node.privateKeyPem);
  return {
    magic: CMSH_MAGIC,
    version: CMSH_VERSION,
    header,
    payload,
    signature
  };
}

test('Persistence: queue preserves packets across simulated node restart via journal file', () => {
  const journalFile = path.join(os.tmpdir(), `cmesh-journal-${Date.now()}.json`);

  try {
    const queue1 = new StoreAndForwardQueue({ storagePath: journalFile });
    queue1.enqueue(createSignedPacket('pkt_norm_1', 'normal'));
    queue1.enqueue(createSignedPacket('pkt_crit_1', 'critical'));

    assert.equal(queue1.size(), 2);
    assert.equal(fs.existsSync(journalFile), true);

    // Simulate node restart: instantiate brand new queue with same journal file
    const queue2 = new StoreAndForwardQueue({ storagePath: journalFile });
    assert.equal(queue2.size(), 2);

    // Priority ordering must be preserved on restoration
    const firstOut = queue2.dequeue();
    assert.equal(firstOut?.header.id, 'pkt_crit_1');
    assert.equal(firstOut?.header.priority, 'critical');

    const secondOut = queue2.dequeue();
    assert.equal(secondOut?.header.id, 'pkt_norm_1');
  } finally {
    if (fs.existsSync(journalFile)) {
      fs.unlinkSync(journalFile);
    }
  }
});
