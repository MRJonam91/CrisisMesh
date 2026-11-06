// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import { EventEmitter } from 'node:events';
import type { MeshPacket } from '../core/types.ts';
import type { MeshTransport, PacketHandler } from '../core/transports.ts';

export interface LoRaRadioConfig {
  frequencyMhz?: number; // e.g. 868.1 (EU) or 915.0 (US)
  spreadingFactor?: number; // SF7 - SF12
  bandwidthKhz?: number; // 125, 250, 500
  txPowerDbm?: number; // 14 - 22
}

export interface SerialStreamLike {
  write(data: Buffer): boolean;
  on(event: 'data', listener: (chunk: Buffer) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
}

/**
 * In-memory Mock Serial Stream for testing hardware LoRa transceivers without physical devices.
 */
export class MockSerialStream extends EventEmitter implements SerialStreamLike {
  public peerStream: MockSerialStream | null = null;

  public connectPeer(peer: MockSerialStream): void {
    this.peerStream = peer;
    peer.peerStream = this;
  }

  public write(data: Buffer): boolean {
    if (this.peerStream) {
      setTimeout(() => {
        this.peerStream?.emit('data', Buffer.from(data));
      }, 15);
    }
    return true;
  }
}

/**
 * Computes standard CRC-16-CCITT checksum for serial frame integrity.
 */
export function crc16Ccitt(buf: Buffer): number {
  let crc = 0xffff;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]!;
    crc ^= b << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

/**
 * SerialLoRaTransport: Hardware adapter for sub-GHz LoRa transceivers (SX1262 / SX1276)
 * operating over UART/Serial streams with framing, length-prefix and CRC16.
 */
export class SerialLoRaTransport implements MeshTransport {
  public readonly name = 'serial-lora';
  private stream: SerialStreamLike;
  private handler: PacketHandler | null = null;
  private buffer = Buffer.alloc(0);
  private isRunning = false;
  public readonly config: LoRaRadioConfig;

  constructor(stream: SerialStreamLike, config: LoRaRadioConfig = {}) {
    this.stream = stream;
    this.config = {
      frequencyMhz: config.frequencyMhz ?? 868.1,
      spreadingFactor: config.spreadingFactor ?? 9,
      bandwidthKhz: config.bandwidthKhz ?? 125,
      txPowerDbm: config.txPowerDbm ?? 14
    };
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.stream.on('data', (chunk: Buffer) => {
      this.handleIncomingChunk(chunk);
    });
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.buffer = Buffer.alloc(0);
  }

  public async broadcast(packet: MeshPacket): Promise<void> {
    if (!this.isRunning) return;
    const framed = this.framePacket(packet);
    this.stream.write(framed);
  }

  public async sendTo(packet: MeshPacket, _destinationAddress: string): Promise<void> {
    await this.broadcast(packet);
  }

  public onPacket(handler: PacketHandler): void {
    this.handler = handler;
  }

  private framePacket(packet: MeshPacket): Buffer {
    const payload = Buffer.from(JSON.stringify(packet), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt8(0xaa, 0); // Preamble byte 1
    header.writeUInt8(0x55, 1); // Preamble byte 2
    header.writeUInt16BE(payload.length, 2);

    const crc = crc16Ccitt(payload);
    const crcBuf = Buffer.alloc(2);
    crcBuf.writeUInt16BE(crc, 0);

    return Buffer.concat([header, payload, crcBuf]);
  }

  private handleIncomingChunk(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 6) {
      // Seek frame preamble 0xAA 0x55
      let syncIndex = -1;
      for (let i = 0; i < this.buffer.length - 1; i++) {
        if (this.buffer[i] === 0xaa && this.buffer[i + 1] === 0x55) {
          syncIndex = i;
          break;
        }
      }

      if (syncIndex === -1) {
        this.buffer = Buffer.alloc(0);
        return;
      }

      if (syncIndex > 0) {
        this.buffer = this.buffer.subarray(syncIndex);
      }

      if (this.buffer.length < 6) return;

      const payloadLen = this.buffer.readUInt16BE(2);
      const totalFrameLen = 4 + payloadLen + 2;

      if (this.buffer.length < totalFrameLen) {
        return; // Await rest of frame
      }

      const payloadBuf = this.buffer.subarray(4, 4 + payloadLen);
      const receivedCrc = this.buffer.readUInt16BE(4 + payloadLen);
      const computedCrc = crc16Ccitt(payloadBuf);

      this.buffer = this.buffer.subarray(totalFrameLen);

      if (receivedCrc === computedCrc) {
        try {
          const packet = JSON.parse(payloadBuf.toString('utf8')) as MeshPacket;
          if (this.handler) {
            this.handler(packet, 'lora://radio');
          }
        } catch {
          // Discard invalid JSON
        }
      }
    }
  }
}
