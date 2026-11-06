// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { CrisisNode } from '../src/core/node.ts';
import { createIdentity } from '../src/core/identity.ts';
import { VirtualRadioChannel, VirtualRadioTransport } from '../src/core/transports.ts';

test('Epidemic Sync: nodes reconcile missing packets via sync_offer and sync_request handshake', async () => {
  const channel = new VirtualRadioChannel();
  const idA = createIdentity('sync-node-A');
  const idB = createIdentity('sync-node-B');

  const tA = new VirtualRadioTransport(idA.nodeId, channel, { latencyMs: 10, packetLossRate: 0 });
  const tB = new VirtualRadioTransport(idB.nodeId, channel, { latencyMs: 10, packetLossRate: 0 });

  const nodeA = new CrisisNode({ identity: idA });
  const nodeB = new CrisisNode({ identity: idB });

  nodeA.addTransport(tA);
  nodeB.addTransport(tB);

  await nodeA.start();
  await nodeB.start();

  // Node A broadcasts a packet while Node B is offline/not started
  // Stop B's transport temporarily to simulate partition
  await tB.stop();

  await nodeA.broadcast({ data: 'Packet-1-Disaster' }, { priority: 'high' });
  await nodeA.broadcast({ data: 'Packet-2-Medical' }, { priority: 'critical' });

  // Re-enable B's transport (partition heals)
  await tB.start();

  // Node B has 0 delivered messages so far
  assert.equal(nodeB.getInbox().length, 0);

  // Node A broadcasts sync offer
  await nodeA.broadcastSyncOffer();

  // Allow roundtrip sync handshake (offer -> request -> transmit)
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Node B should now have received the missing packets
  const inboxB = nodeB.getInbox();
  assert.equal(inboxB.length, 2);

  await nodeA.stop();
  await nodeB.stop();
});
