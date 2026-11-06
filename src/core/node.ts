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
  SneakernetBundle,
  NeighborPeer,
  SyncOfferPayload,
  SyncRequestPayload,
  AckPayload,
  RouteEntry
} from './types.ts';
import { CMSH_MAGIC, CMSH_VERSION } from './types.ts';
import { signPacketEnvelope, verifyPacketSignature } from './identity.ts';
import { encryptPayload, decryptPayload, isEncryptedPayload } from './encryption.ts';
import { StoreAndForwardQueue } from './storage.ts';
import type { MeshTransport } from './transports.ts';

export interface NodeOptions {
  identity: MeshIdentity;
  maxHopsDefault?: number;
  ttlSecondsDefault?: number;
  maxQueuePackets?: number;
  storagePath?: string;
}

/**
 * CrisisNode: Standalone, resilient store-and-forward peer node.
 */
export class CrisisNode extends EventEmitter {
  public readonly identity: MeshIdentity;
  private queue: StoreAndForwardQueue;
  private transports: MeshTransport[] = [];
  private inbox: DeliveredMessage[] = [];
  private peers = new Map<string, NeighborPeer>();
  private acks: AckPayload[] = [];
  private routes = new Map<string, RouteEntry>();
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
      maxPackets: options.maxQueuePackets ?? 500,
      storagePath: options.storagePath
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
   * Sends an End-to-End Encrypted (E2EE) direct message using X25519 ECDH + AES-256-GCM.
   */
  public async sendDirectEncrypted<T = unknown>(
    recipientNodeId: string,
    recipientX25519PubHex: string,
    payload: T,
    options: { priority?: MeshPriority; ttl?: number; maxHops?: number } = {}
  ): Promise<MeshPacket> {
    const encrypted = encryptPayload(
      recipientX25519PubHex,
      payload,
      this.identity.x25519PrivateKeyPem
    );
    return this.sendDirect(recipientNodeId, encrypted, options);
  }

  /**
   * Broadcasts a heartbeat beacon for neighbor discovery.
   */
  public async sendHeartbeat(): Promise<MeshPacket> {
    const packet = this.createPacket(
      'heartbeat',
      '*',
      { name: this.identity.name, seq: Date.now() },
      'low',
      300,
      1 // Neighbor discovery is 1 hop only
    );
    await this.dispatchPacket(packet);
    return packet;
  }

  /**
   * Broadcasts a sync offer containing buffered packet IDs for epidemic delta reconciliation.
   */
  public async broadcastSyncOffer(): Promise<MeshPacket<SyncOfferPayload>> {
    const offerPacketIds = this.queue.getAll().map((p) => p.header.id);
    const packet = this.createPacket(
      'sync_offer',
      '*',
      { offerPacketIds, senderNodeId: this.identity.nodeId },
      'low',
      600,
      1
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

  public getPeers(): NeighborPeer[] {
    return [...this.peers.values()];
  }

  public getAcks(): AckPayload[] {
    return [...this.acks];
  }

  public getRoutes(): RouteEntry[] {
    return [...this.routes.values()];
  }

  public exportBundle(notes?: string): SneakernetBundle {
    return this.queue.exportBundle(this.identity.nodeId, notes);
  }

  public importBundle(bundle: SneakernetBundle): { imported: number; rejected: number } {
    return this.queue.importBundle(bundle);
  }

  private createPacket<T>(
    type: 'alert' | 'direct' | 'heartbeat' | 'sync_offer' | 'sync_request' | 'ack',
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
    this.queue.enqueue(packet);
    this.metrics.sentCount++;

    for (const transport of this.transports) {
      await transport.broadcast(packet);
    }
  }

  private handleIncomingPacket(packet: MeshPacket, fromAddress: string): void {
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

    // Track neighbor peer in peer discovery table
    const isNewPeer = !this.peers.has(packet.header.sender);
    const peerInfo: NeighborPeer = {
      nodeId: packet.header.sender,
      name:
        typeof packet.payload === 'object' && packet.payload !== null && 'name' in packet.payload
          ? String((packet.payload as Record<string, unknown>)['name'])
          : packet.header.sender,
      lastSeen: Date.now(),
      hopDistance: packet.header.hopCount + 1,
      viaAddress: fromAddress
    };
    this.peers.set(packet.header.sender, peerInfo);
    if (isNewPeer) {
      this.emit('peer:discovered', peerInfo);
    }

    // Distance-vector routing table update: record shortest known route to sender
    const distance = packet.header.hopCount + 1;
    const immediateHop = packet.header.path[packet.header.path.length - 1] ?? packet.header.sender;
    const existingRoute = this.routes.get(packet.header.sender);
    if (!existingRoute || distance <= existingRoute.distanceHops) {
      this.routes.set(packet.header.sender, {
        destinationNodeId: packet.header.sender,
        nextHopNodeId: immediateHop,
        distanceHops: distance,
        lastUpdated: Date.now()
      });
    }

    // Mark as seen immediately
    this.queue.markSeen(packet.header.id);

    // Handle end-to-end delivery ACK packets
    if (packet.header.type === 'ack' && (packet.header.recipient === '*' || packet.header.recipient === this.identity.nodeId)) {
      const ack = packet.payload as AckPayload;
      if (ack?.originalPacketId) {
        this.acks.push(ack);
        this.emit('message:acked', ack);
      }
      return;
    }

    // 5. Handle Epidemic Sync Protocol packets
    if (packet.header.type === 'sync_offer') {
      const offer = packet.payload as SyncOfferPayload;
      if (Array.isArray(offer?.offerPacketIds) && offer.senderNodeId !== this.identity.nodeId) {
        const missing = offer.offerPacketIds.filter((id) => !this.queue.isDuplicate(id));
        if (missing.length > 0) {
          const reqPacket = this.createPacket(
            'sync_request',
            offer.senderNodeId,
            { requestedPacketIds: missing, requesterNodeId: this.identity.nodeId } satisfies SyncRequestPayload,
            'normal',
            300,
            1
          );
          void this.dispatchPacket(reqPacket);
        }
      }
      return;
    }

    if (packet.header.type === 'sync_request') {
      const req = packet.payload as SyncRequestPayload;
      if (
        req?.requesterNodeId &&
        (packet.header.recipient === '*' || packet.header.recipient === this.identity.nodeId)
      ) {
        const packetsToSend = this.queue
          .getAll()
          .filter((p) => req.requestedPacketIds.includes(p.header.id));
        for (const p of packetsToSend) {
          for (const transport of this.transports) {
            void transport.sendTo(p, fromAddress);
          }
        }
      }
      return;
    }

    // 6. Destination Delivery Check
    const isForMe =
      packet.header.recipient === '*' || packet.header.recipient === this.identity.nodeId;

    if (isForMe && packet.header.type !== 'heartbeat') {
      const deliveryDelayMs = Math.max(0, Date.now() - packet.header.timestamp);
      let payloadToDeliver = packet.payload;

      // Automatic E2EE payload decryption if encrypted and targeted to this node
      if (
        packet.header.recipient === this.identity.nodeId &&
        isEncryptedPayload(packet.payload) &&
        this.identity.x25519PrivateKeyPem
      ) {
        try {
          payloadToDeliver = decryptPayload(packet.payload, this.identity.x25519PrivateKeyPem);
        } catch {
          // Payload was not decryptable with our key
        }
      }

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
        payload: payloadToDeliver,
        signatureVerified: true
      };

      this.inbox.push(delivered);
      this.metrics.deliveredCount++;
      this.emit('message', delivered);

      // Send automatic authenticated delivery ACK for directed messages
      if (packet.header.recipient === this.identity.nodeId && packet.header.type === 'direct') {
        const ackPayload: AckPayload = {
          originalPacketId: packet.header.id,
          originalSender: packet.header.sender,
          recipientNodeId: this.identity.nodeId,
          deliveredAt: Date.now()
        };
        const ackPacket = this.createPacket(
          'ack',
          packet.header.sender,
          ackPayload,
          'high',
          1800,
          packet.header.maxHops
        );
        void this.dispatchPacket(ackPacket);
      }
    }

    // 7. Store-and-Forward Relay Decision
    const shouldRelay =
      packet.header.recipient !== this.identity.nodeId || packet.header.recipient === '*';
    const canHop = packet.header.hopCount < packet.header.maxHops;
    const notAlreadyInPath = !packet.header.path.includes(this.identity.nodeId);

    if (shouldRelay && canHop && notAlreadyInPath && packet.header.type !== 'heartbeat') {
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
