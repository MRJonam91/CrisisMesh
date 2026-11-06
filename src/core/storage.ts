// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import type {
  MeshPacket,
  SneakernetBundle
} from './types.ts';
import { CMSH_MAGIC, PRIORITY_WEIGHTS } from './types.ts';
import { verifyPacketSignature } from './identity.ts';

export interface StorageOptions {
  maxPackets?: number;
  seenCacheTtlSeconds?: number;
}

/**
 * Delay-Tolerant Store-and-Forward Queue with priority scheduling,
 * duplicate filtering and sneakernet bundle support.
 */
export class StoreAndForwardQueue {
  private queue: MeshPacket[] = [];
  private seenPackets = new Map<string, number>(); // packetId -> expiresAt
  private readonly maxPackets: number;
  private readonly seenTtlMs: number;

  constructor(options: StorageOptions = {}) {
    this.maxPackets = options.maxPackets ?? 500;
    this.seenTtlMs = (options.seenCacheTtlSeconds ?? 3600) * 1000;
  }

  public isDuplicate(packetId: string): boolean {
    this.purgeExpiredSeen();
    return this.seenPackets.has(packetId);
  }

  public markSeen(packetId: string): void {
    this.seenPackets.set(packetId, Date.now() + this.seenTtlMs);
  }

  public enqueue(packet: MeshPacket): boolean {
    if (this.isExpired(packet)) {
      return false;
    }

    if (this.queue.some((p) => p.header.id === packet.header.id)) {
      return false;
    }

    this.markSeen(packet.header.id);

    // If buffer is full, remove oldest lowest-priority item
    if (this.queue.length >= this.maxPackets) {
      this.evictLowestPriority();
    }

    this.queue.push(packet);
    this.sortQueue();
    return true;
  }

  public peek(): MeshPacket | undefined {
    this.purgeExpired();
    return this.queue[0];
  }

  public dequeue(): MeshPacket | undefined {
    this.purgeExpired();
    return this.queue.shift();
  }

  public getAll(): MeshPacket[] {
    this.purgeExpired();
    return [...this.queue];
  }

  public size(): number {
    this.purgeExpired();
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
  }

  public isExpired(packet: MeshPacket, now = Date.now()): boolean {
    const expiresAt = packet.header.timestamp + packet.header.ttl * 1000;
    return now > expiresAt;
  }

  public purgeExpired(now = Date.now()): number {
    const initial = this.queue.length;
    this.queue = this.queue.filter((p) => !this.isExpired(p, now));
    return initial - this.queue.length;
  }

  private purgeExpiredSeen(now = Date.now()): void {
    for (const [id, expiresAt] of this.seenPackets.entries()) {
      if (now > expiresAt) {
        this.seenPackets.delete(id);
      }
    }
  }

  private sortQueue(): void {
    // Sort by priority descending (critical first), then by timestamp ascending (FIFO for same priority)
    this.queue.sort((a, b) => {
      const weightA = PRIORITY_WEIGHTS[a.header.priority] ?? 50;
      const weightB = PRIORITY_WEIGHTS[b.header.priority] ?? 50;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return a.header.timestamp - b.header.timestamp;
    });
  }

  private evictLowestPriority(): void {
    // Evict lowest priority (last items in sorted queue)
    if (this.queue.length > 0) {
      this.queue.pop();
    }
  }

  /**
   * Serializes buffered packets into a portable sneakernet bundle.
   */
  public exportBundle(exporterNodeId: string, notes?: string): SneakernetBundle {
    this.purgeExpired();
    return {
      magic: CMSH_MAGIC,
      exportedAt: Date.now(),
      exporterNodeId,
      notes,
      packetCount: this.queue.length,
      packets: [...this.queue]
    };
  }

  /**
   * Imports packets from a sneakernet bundle, validating signatures and dropping duplicates.
   */
  public importBundle(bundle: SneakernetBundle): { imported: number; rejected: number } {
    if (bundle.magic !== CMSH_MAGIC || !Array.isArray(bundle.packets)) {
      throw new Error('[CMSH-ERR-3102] Invalid sneakernet bundle format or magic header');
    }
    let imported = 0;
    let rejected = 0;

    for (const packet of bundle.packets) {
      if (!verifyPacketSignature(packet)) {
        rejected++;
        continue;
      }
      if (this.enqueue(packet)) {
        imported++;
      } else {
        rejected++;
      }
    }

    return { imported, rejected };
  }
}
