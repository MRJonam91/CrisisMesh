// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SerialLoRaTransport,
  MockSerialStream,
  crc16Ccitt
} from '../src/adapters/serialLoRa.ts';
import { createIdentity, signPacketEnvelope } from '../src/core/identity.ts';
import { CMSH_MAGIC, CMSH_VERSION, type MeshPacket } from '../src/core/types.ts';

test('CRC16: calculates deterministic CCITT checksum', () => {
  const sample = Buffer.from('123456789', 'utf8');
  const crc = crc16Ccitt(sample);
  assert.equal(crc, 0x29b1); // Standard CRC-16 CCITT test vector
});

test('SerialLoRaTransport: frames and transmits packet over mock serial stream', async () => {
  const streamA = new MockSerialStream();
  const streamB = new MockSerialStream();
  streamA.connectPeer(streamB);

  const transportA = new SerialLoRaTransport(streamA, { frequencyMhz: 868.1, spreadingFactor: 9 });
  const transportB = new SerialLoRaTransport(streamB, { frequencyMhz: 868.1, spreadingFactor: 9 });

  await transportA.start();
  await transportB.start();

  const id = createIdentity('lora-node');
  const header = {
    id: 'pkt_lora_1',
    type: 'alert' as const,
    sender: id.nodeId,
    senderPubkey: id.publicKeyHex,
    recipient: '*',
    timestamp: Date.now(),
    ttl: 3600,
    maxHops: 3,
    hopCount: 0,
    path: [id.nodeId],
    priority: 'high' as const
  };
  const payload = { lora: 'Sub-GHz frame OK' };
  const signature = signPacketEnvelope(header, payload, id.privateKeyPem);
  const packet: MeshPacket = {
    magic: CMSH_MAGIC,
    version: CMSH_VERSION,
    header,
    payload,
    signature
  };

  let receivedPacket: MeshPacket | null = null;
  transportB.onPacket((pkt) => {
    receivedPacket = pkt;
  });

  await transportA.broadcast(packet);

  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.ok(receivedPacket !== null);
  assert.equal((receivedPacket as MeshPacket).header.id, 'pkt_lora_1');
  assert.deepEqual((receivedPacket as MeshPacket).payload, payload);

  await transportA.stop();
  await transportB.stop();
});
