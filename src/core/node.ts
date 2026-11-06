// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type {
  MeshIdentity,
  MeshPacket,
  MeshPacketHeader,
  MeshPriority,
  DeliveredMessage,
  MeshMetrics,
  SneakernetBundle
} from './types.ts';
import { CMSH_MAGIC, CMSH_VERSION } from './types.ts';
import { signPacketEnvelope, verifyPacketSignature } from './identity.ts';
import { StoreAndForwardQueue } from './storage.ts';
import type { MeshTransport } from './transports.ts';

export interface NodeOptions {
  identity: MeshIdentity;
  maxHopsDefault?: number;
  ttlSecondsDefault?: number;
  maxQueuePackets?: number;
}

/**
 * CrisisNode: Standalone, resilient store-and-forward peer node.
 */
export class CrisisNode extends EventEmitter {
  public readonly identity: MeshIdentity;
  private queue: StoreAndForwardQueue;
  private transports: MeshTransport[] = [];
  private inbox: DeliveredMessage[] = [];
  private defaultMaxHops: number;
  private defaultTtlSeconds: number;
  private isRunning = false;
  private metrics: MeshMetrics = {
    sentCount: 0,
    receivedCount: 0,
    deliveredCount: 0,
    relayedCount: 0,
    expiredCount: 0,
    duplicateCount: 0,
    invalidSignatureCount: 0,
    tamperedCount: 0
  };

  constructor(options: NodeOptions) {
    super();
    this.identity = options.identity;
    this.defaultMaxHops = options.maxHopsDefault ?? 5;
    this.defaultTtlSeconds = options.ttlSecondsDefault ?? 86400; // 24 hours default DTN TTL
    this.queue = new StoreAndForwardQueue({
      maxPackets: options.maxQueuePackets ?? 500
    });
  }

  public addTransport(transport: MeshTransport): void {
    this.transports.push(transport);
    transport.onPacket((packet, fromAddress) => {
      this.handleIncomingPacket(packet, fromAddress);
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    for (const transport of this.transports) {
      await transport.start();
    }
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    for (const transport of this.transports) {
      await transport.stop();
    }
    this.isRunning = false;
  }

  /**
   * Broadcasts a message to all reachable nodes on the mesh.
   */
  public async broadcast<T = unknown>(
    payload: T,
    options: { priority?: MeshPriority; ttl?: number; maxHops?: number } = {}
  ): Promise<MeshPacket<T>> {
    const packet = this.createPacket(
      'alert',
      '*',
      payload,
      options.priority ?? 'normal',
      options.ttl,
      options.maxHops
    );
    await this.dispatchPacket(packet);
    return packet;
  }

  /**
   * Sends an end-to-end directed message to a specific node ID.
   */
  public async sendDirect<T = unknown>(
    recipientNodeId: string,
    payload: T,
    options: { priority?: MeshPriority; ttl?: number; maxHops?: number } = {}
  ): Promise<MeshPacket<T>> {
    const packet = this.createPacket(
      'direct',
      recipientNodeId,
      payload,
      options.priority ?? 'normal',
      options.ttl,
      options.maxHops
    );
    await this.dispatchPacket(packet);
    return packet;
  }

  /**
   * Dispatches buffered store-and-forward queue to connected peers.
   */
  public async flushQueue(): Promise<number> {
    const packets = this.queue.getAll();
    let flushed = 0;
    for (const packet of packets) {
      for (const transport of this.transports) {
        await transport.broadcast(packet);
      }
      flushed++;
    }
    return flushed;
  }

  public getInbox(): DeliveredMessage[] {
    return [...this.inbox];
  }

  public getMetrics(): MeshMetrics {
    return { ...this.metrics };
  }

  public getQueueSize(): number {
    return this.queue.size();
  }

  public exportBundle(notes?: string): SneakernetBundle {
    return this.queue.exportBundle(this.identity.nodeId, notes);
  }

  public importBundle(bundle: SneakernetBundle): { imported: number; rejected: number } {
    const result = this.queue.importBundle(bundle);
    return result;
  }

  private createPacket<T>(
    type: 'alert' | 'direct',
    recipient: string,
    payload: T,
    priority: MeshPriority,
    ttlSeconds?: number,
    maxHops?: number
  ): MeshPacket<T> {
    const timestamp = Date.now();
    const packetId = `pkt_${crypto.randomBytes(8).toString('hex')}`;
    const header: MeshPacketHeader = {
      id: packetId,
      type,
      sender: this.identity.nodeId,
      senderPubkey: this.identity.publicKeyHex,
      recipient,
      timestamp,
      ttl: ttlSeconds ?? this.defaultTtlSeconds,
      maxHops: maxHops ?? this.defaultMaxHops,
      hopCount: 0,
      path: [this.identity.nodeId],
      priority
    };

    const signature = signPacketEnvelope(header, payload, this.identity.privateKeyPem);

    return {
      magic: CMSH_MAGIC,
      version: CMSH_VERSION,
      header,
      payload,
      signature
    };
  }

  private async dispatchPacket(packet: MeshPacket): Promise<void> {
    this.queue.markSeen(packet.header.id);
    this.metrics.sentCount++;

    for (const transport of this.transports) {
      await transport.broadcast(packet);
    }
  }

  private handleIncomingPacket(packet: MeshPacket, _fromAddress: string): void {
    this.metrics.receivedCount++;

    // 1. Verify Magic
    if (packet.magic !== CMSH_MAGIC) {
      return;
    }

    // 2. Duplicate Detection
    if (this.queue.isDuplicate(packet.header.id)) {
      this.metrics.duplicateCount++;
      return;
    }

    // 3. Cryptographic Signature Verification
    const isValidSignature = verifyPacketSignature(packet);
    if (!isValidSignature) {
      this.metrics.invalidSignatureCount++;
      this.metrics.tamperedCount++;
      this.emit('packet:tampered', {
        packetId: packet.header.id,
        sender: packet.header.sender,
        reason: '[CMSH-ERR-7104] Invalid cryptographic Ed25519 signature'
      });
      return;
    }

    // 4. TTL Expiration Check
    if (this.queue.isExpired(packet)) {
      this.metrics.expiredCount++;
      this.emit('packet:expired', { packetId: packet.header.id });
      return;
    }

    // Mark as seen immediately
    this.queue.markSeen(packet.header.id);

    // 5. Destination Delivery Check
    const isForMe =
      packet.header.recipient === '*' || packet.header.recipient === this.identity.nodeId;

    if (isForMe) {
      const deliveryDelayMs = Math.max(0, Date.now() - packet.header.timestamp);
      const delivered: DeliveredMessage = {
        packetId: packet.header.id,
        sender: packet.header.sender,
        senderPubkey: packet.header.senderPubkey,
        recipient: packet.header.recipient,
        priority: packet.header.priority,
        timestamp: packet.header.timestamp,
        receivedAt: Date.now(),
        deliveryDelayMs,
        hopCount: packet.header.hopCount,
        path: [...packet.header.path],
        payload: packet.payload,
        signatureVerified: true
      };

      this.inbox.push(delivered);
      this.metrics.deliveredCount++;
      this.emit('message', delivered);
    }

    // 6. Store-and-Forward Relay Decision
    // Relay if broadcast OR not destined exclusively to this node, AND hopCount has not exceeded maxHops
    const shouldRelay =
      packet.header.recipient !== this.identity.nodeId || packet.header.recipient === '*';
    const canHop = packet.header.hopCount < packet.header.maxHops;
    const notAlreadyInPath = !packet.header.path.includes(this.identity.nodeId);

    if (shouldRelay && canHop && notAlreadyInPath) {
      const forwardedPacket: MeshPacket = {
        ...packet,
        header: {
          ...packet.header,
          hopCount: packet.header.hopCount + 1,
          path: [...packet.header.path, this.identity.nodeId]
        }
      };

      this.queue.enqueue(forwardedPacket);
      this.metrics.relayedCount++;
      this.emit('packet:relayed', forwardedPacket);

      // Opportunistically broadcast forwarded packet over transports
      for (const transport of this.transports) {
        void transport.broadcast(forwardedPacket);
      }
    }
  }
}
