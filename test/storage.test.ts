// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { StoreAndForwardQueue } from '../src/core/storage.ts';
import { createIdentity, signPacketEnvelope } from '../src/core/identity.ts';
import { CMSH_MAGIC, CMSH_VERSION, type MeshPacket, type MeshPriority } from '../src/core/types.ts';

function makeMockPacket(id: string, priority: MeshPriority, ttlSeconds = 3600): MeshPacket {
  const node = createIdentity('mock');
  const header = {
    id,
    type: 'alert' as const,
    sender: node.nodeId,
    senderPubkey: node.publicKeyHex,
    recipient: '*',
    timestamp: Date.now(),
    ttl: ttlSeconds,
    maxHops: 5,
    hopCount: 0,
    path: [node.nodeId],
    priority
  };
  const payload = { test: true };
  const signature = signPacketEnvelope(header, payload, node.privateKeyPem);
  return {
    magic: CMSH_MAGIC,
    version: CMSH_VERSION,
    header,
    payload,
    signature
  };
}

test('StoreAndForwardQueue: prioritizes critical over normal packets', () => {
  const queue = new StoreAndForwardQueue();
  const normalPkt = makeMockPacket('pkt_norm', 'normal');
  const criticalPkt = makeMockPacket('pkt_crit', 'critical');
  const lowPkt = makeMockPacket('pkt_low', 'low');

  queue.enqueue(normalPkt);
  queue.enqueue(lowPkt);
  queue.enqueue(criticalPkt);

  // Dequeue must return critical first, then normal, then low
  assert.equal(queue.dequeue()?.header.id, 'pkt_crit');
  assert.equal(queue.dequeue()?.header.id, 'pkt_norm');
  assert.equal(queue.dequeue()?.header.id, 'pkt_low');
});

test('StoreAndForwardQueue: rejects duplicate packets', () => {
  const queue = new StoreAndForwardQueue();
  const pkt = makeMockPacket('pkt_dup', 'high');

  assert.equal(queue.enqueue(pkt), true);
  assert.equal(queue.enqueue(pkt), false);
  assert.equal(queue.size(), 1);
});

test('StoreAndForwardQueue: purges expired packets', () => {
  const queue = new StoreAndForwardQueue();
  const expiredPkt = makeMockPacket('pkt_exp', 'normal', -10); // already expired 10s ago
  const validPkt = makeMockPacket('pkt_val', 'normal', 3600);

  // Enqueue should reject expired packet or purge on access
  queue.enqueue(expiredPkt);
  queue.enqueue(validPkt);

  assert.equal(queue.size(), 1);
  assert.equal(queue.peek()?.header.id, 'pkt_val');
});

test('StoreAndForwardQueue: export and import sneakernet bundle', () => {
  const queue1 = new StoreAndForwardQueue();
  const pkt1 = makeMockPacket('pkt_b1', 'critical');
  const pkt2 = makeMockPacket('pkt_b2', 'high');

  queue1.enqueue(pkt1);
  queue1.enqueue(pkt2);

  const bundle = queue1.exportBundle('mule-node', 'Emergency courier dispatch');
  assert.equal(bundle.packetCount, 2);
  assert.equal(bundle.packets.length, 2);

  const queue2 = new StoreAndForwardQueue();
  const res = queue2.importBundle(bundle);
  assert.equal(res.imported, 2);
  assert.equal(res.rejected, 0);
  assert.equal(queue2.size(), 2);
});
