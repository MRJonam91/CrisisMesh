// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { CrisisNode } from '../src/core/node.ts';
import { createIdentity } from '../src/core/identity.ts';
import { VirtualRadioChannel, VirtualRadioTransport } from '../src/core/transports.ts';
import type { AckPayload } from '../src/core/types.ts';

test('End-to-End ACK: recipient automatically sends back signed delivery confirmation', async () => {
  const channel = new VirtualRadioChannel();
  const idA = createIdentity('sender-unit');
  const idB = createIdentity('hospital-base');

  const tA = new VirtualRadioTransport(idA.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });
  const tB = new VirtualRadioTransport(idB.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });

  const nodeA = new CrisisNode({ identity: idA });
  const nodeB = new CrisisNode({ identity: idB });

  nodeA.addTransport(tA);
  nodeB.addTransport(tB);

  await nodeA.start();
  await nodeB.start();

  let ackReceived: AckPayload | null = null;
  nodeA.on('message:acked', (ack: AckPayload) => {
    ackReceived = ack;
  });

  const sentPacket = await nodeA.sendDirect(idB.nodeId, { order: 'medical supplies' }, { priority: 'high' });

  // Allow roundtrip (A -> B direct, B -> A ack)
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.ok(ackReceived !== null);
  assert.equal((ackReceived as AckPayload).originalPacketId, sentPacket.header.id);
  assert.equal((ackReceived as AckPayload).recipientNodeId, idB.nodeId);
  assert.equal((ackReceived as AckPayload).originalSender, idA.nodeId);

  const acksList = nodeA.getAcks();
  assert.equal(acksList.length, 1);
  assert.equal(acksList[0]?.originalPacketId, sentPacket.header.id);

  await nodeA.stop();
  await nodeB.stop();
});

test('Distance-Vector Routing: nodes dynamically learn shortest hop distance to peers', async () => {
  const channel = new VirtualRadioChannel();
  const id1 = createIdentity('relay-1');
  const id2 = createIdentity('relay-2');

  const t1 = new VirtualRadioTransport(id1.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });
  const t2 = new VirtualRadioTransport(id2.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });

  const node1 = new CrisisNode({ identity: id1 });
  const node2 = new CrisisNode({ identity: id2 });

  node1.addTransport(t1);
  node2.addTransport(t2);

  await node1.start();
  await node2.start();

  await node1.sendHeartbeat();
  await new Promise((resolve) => setTimeout(resolve, 40));

  const routes = node2.getRoutes();
  const routeTo1 = routes.find((r) => r.destinationNodeId === id1.nodeId);
  assert.ok(routeTo1);
  assert.equal(routeTo1.distanceHops, 1);
  assert.equal(routeTo1.nextHopNodeId, id1.nodeId);

  await node1.stop();
  await node2.stop();
});
