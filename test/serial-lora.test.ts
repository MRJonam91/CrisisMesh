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

test('SerialLoRaTransport: reassembles frame across fragmented chunks and preamble split', async () => {
  const stream = new MockSerialStream();
  const transport = new SerialLoRaTransport(stream);
  await transport.start();

  const id = createIdentity('frag-node');
  const header = {
    id: 'pkt_frag_1',
    type: 'alert' as const,
    sender: id.nodeId,
    senderPubkey: id.publicKeyHex,
    recipient: '*',
    timestamp: Date.now(),
    ttl: 3600,
    maxHops: 3,
    hopCount: 0,
    path: [id.nodeId],
    priority: 'normal' as const
  };
  const payload = { frag: true };
  const signature = signPacketEnvelope(header, payload, id.privateKeyPem);
  const packet: MeshPacket = {
    magic: CMSH_MAGIC,
    version: CMSH_VERSION,
    header,
    payload,
    signature
  };

  const payloadBuf = Buffer.from(JSON.stringify(packet), 'utf8');
  const headerBuf = Buffer.alloc(4);
  headerBuf.writeUInt8(0xaa, 0);
  headerBuf.writeUInt8(0x55, 1);
  headerBuf.writeUInt16BE(payloadBuf.length, 2);
  const crcBuf = Buffer.alloc(2);
  crcBuf.writeUInt16BE(crc16Ccitt(payloadBuf), 0);
  const fullFrame = Buffer.concat([headerBuf, payloadBuf, crcBuf]);

  let received: MeshPacket | null = null;
  transport.onPacket((pkt) => {
    received = pkt;
  });

  // Chunk 1: includes garbage noise + preamble byte 1 (0xaa)
  const chunk1 = Buffer.concat([Buffer.from([0x00, 0x11, 0x22, 0xaa])]);
  // Chunk 2: preamble byte 2 (0x55) + rest of the frame
  const chunk2 = fullFrame.subarray(1);

  stream.emit('data', chunk1);
  stream.emit('data', chunk2);

  assert.ok(received !== null);
  assert.equal((received as MeshPacket).header.id, 'pkt_frag_1');

  await transport.stop();
});
