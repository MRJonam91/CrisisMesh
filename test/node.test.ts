// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { CrisisNode } from '../src/core/node.ts';
import { createIdentity } from '../src/core/identity.ts';
import { VirtualRadioChannel, VirtualRadioTransport } from '../src/core/transports.ts';
import type { DeliveredMessage } from '../src/core/types.ts';

test('CrisisNode: broadcast delivery between two nodes over virtual radio', async () => {
  const channel = new VirtualRadioChannel();
  const id1 = createIdentity('sender-node');
  const id2 = createIdentity('receiver-node');

  const t1 = new VirtualRadioTransport(id1.nodeId, channel, { latencyMs: 10, packetLossRate: 0 });
  const t2 = new VirtualRadioTransport(id2.nodeId, channel, { latencyMs: 10, packetLossRate: 0 });

  const node1 = new CrisisNode({ identity: id1 });
  const node2 = new CrisisNode({ identity: id2 });

  node1.addTransport(t1);
  node2.addTransport(t2);

  await node1.start();
  await node2.start();

  let receivedMessage: DeliveredMessage | null = null;
  node2.on('message', (msg: DeliveredMessage) => {
    receivedMessage = msg;
  });

  await node1.broadcast({ alert: 'Tsunami warning' }, { priority: 'critical' });

  // Wait for simulated transmission flight
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.ok(receivedMessage !== null);
  assert.equal((receivedMessage as DeliveredMessage).sender, id1.nodeId);
  assert.equal((receivedMessage as DeliveredMessage).priority, 'critical');
  assert.equal((receivedMessage as DeliveredMessage).signatureVerified, true);
  assert.deepEqual((receivedMessage as DeliveredMessage).payload, { alert: 'Tsunami warning' });

  await node1.stop();
  await node2.stop();
});

test('CrisisNode: direct message delivery only to targeted node', async () => {
  const channel = new VirtualRadioChannel();
  const idA = createIdentity('node-A');
  const idB = createIdentity('node-B');
  const idC = createIdentity('node-C');

  const tA = new VirtualRadioTransport(idA.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });
  const tB = new VirtualRadioTransport(idB.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });
  const tC = new VirtualRadioTransport(idC.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });

  const nodeA = new CrisisNode({ identity: idA });
  const nodeB = new CrisisNode({ identity: idB });
  const nodeC = new CrisisNode({ identity: idC });

  nodeA.addTransport(tA);
  nodeB.addTransport(tB);
  nodeC.addTransport(tC);

  await nodeA.start();
  await nodeB.start();
  await nodeC.start();

  await nodeA.sendDirect(idB.nodeId, { secret: 'coordinates-cache' });
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(nodeB.getInbox().length, 1);
  assert.equal(nodeC.getInbox().length, 0); // Not addressed to C!

  await nodeA.stop();
  await nodeB.stop();
  await nodeC.stop();
});

test('CrisisNode: detects tampering and discards invalid packet', async () => {
  const channel = new VirtualRadioChannel();
  const idA = createIdentity('node-A');
  const idB = createIdentity('node-B');

  const tA = new VirtualRadioTransport(idA.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });
  const tB = new VirtualRadioTransport(idB.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });

  const nodeA = new CrisisNode({ identity: idA });
  const nodeB = new CrisisNode({ identity: idB });

  nodeA.addTransport(tA);
  nodeB.addTransport(tB);

  await nodeA.start();
  await nodeB.start();

  let tamperedCaught = false;
  nodeB.on('packet:tampered', () => {
    tamperedCaught = true;
  });

  const packet = await nodeA.broadcast({ data: 'authentic' });
  // Tamper with packet
  const forged = JSON.parse(JSON.stringify(packet));
  forged.payload = { data: 'MALICIOUS_INJECTION' };
  tB.deliverIncoming(forged, 'virtual://radio');

  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(tamperedCaught, true);
  assert.equal(nodeB.getInbox().length, 1); // Only the authentic one was delivered
  assert.equal(nodeB.getMetrics().tamperedCount, 1);

  await nodeA.stop();
  await nodeB.stop();
});
