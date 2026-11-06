// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { CrisisNode } from '../src/core/node.ts';
import { createIdentity } from '../src/core/identity.ts';
import { VirtualRadioChannel, VirtualRadioTransport } from '../src/core/transports.ts';

test('E2EE Node: direct encrypted message is decrypted by recipient and unreadable by relay', async () => {
  const channel = new VirtualRadioChannel();
  const idA = createIdentity('sender-alice');
  const idRelay = createIdentity('relay-rover');
  const idB = createIdentity('recipient-bob');

  const tA = new VirtualRadioTransport(idA.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });
  const tRelay = new VirtualRadioTransport(idRelay.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });
  const tB = new VirtualRadioTransport(idB.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });

  const nodeA = new CrisisNode({ identity: idA });
  const nodeRelay = new CrisisNode({ identity: idRelay });
  const nodeB = new CrisisNode({ identity: idB });

  nodeA.addTransport(tA);
  nodeRelay.addTransport(tRelay);
  nodeB.addTransport(tB);

  await nodeA.start();
  await nodeRelay.start();
  await nodeB.start();

  const secretDiagnosis = { patientId: 'PT-99', status: 'critical', diagnosis: 'tension pneumothorax' };

  await nodeA.sendDirectEncrypted(
    idB.nodeId,
    idB.x25519PublicKeyHex!,
    secretDiagnosis,
    { priority: 'critical' }
  );

  await new Promise((resolve) => setTimeout(resolve, 80));

  // 1. Relay should not have received it in its inbox (targeted only to Bob)
  assert.equal(nodeRelay.getInbox().length, 0);

  // 2. Bob should have received it and automatically decrypted it
  const bobInbox = nodeB.getInbox();
  assert.equal(bobInbox.length, 1);
  assert.deepEqual(bobInbox[0]?.payload, secretDiagnosis);
  assert.equal(bobInbox[0]?.sender, idA.nodeId);
  assert.equal(bobInbox[0]?.signatureVerified, true);

  await nodeA.stop();
  await nodeRelay.stop();
  await nodeB.stop();
});

test('Neighbor discovery: node broadcasts heartbeat and registers in neighbor table', async () => {
  const channel = new VirtualRadioChannel();
  const id1 = createIdentity('beacon-unit');
  const id2 = createIdentity('listening-post');

  const t1 = new VirtualRadioTransport(id1.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });
  const t2 = new VirtualRadioTransport(id2.nodeId, channel, { latencyMs: 5, packetLossRate: 0 });

  const node1 = new CrisisNode({ identity: id1 });
  const node2 = new CrisisNode({ identity: id2 });

  node1.addTransport(t1);
  node2.addTransport(t2);

  await node1.start();
  await node2.start();

  let discoveredPeerId: string | null = null;
  node2.on('peer:discovered', (p) => {
    discoveredPeerId = p.nodeId;
  });

  await node1.sendHeartbeat();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(discoveredPeerId, id1.nodeId);
  const peers = node2.getPeers();
  assert.equal(peers.length, 1);
  assert.equal(peers[0]?.nodeId, id1.nodeId);
  assert.equal(peers[0]?.name, 'beacon-unit');

  await node1.stop();
  await node2.stop();
});
