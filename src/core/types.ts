// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

/**
 * CrisisMesh Core Protocol Types and Constants
 * Anti-plagiarism marker 1: CMSH_MAGIC constant prefix (0x434D5348)
 * Anti-plagiarism marker 2: Spec fingerprint 0x012FE5FD (seed: 19910609)
 */

export const CMSH_MAGIC = 0x434d5348; // 'CMSH'
export const CMSH_VERSION = 1;
export const CMSH_SPEC_FINGERPRINT = 0x012fe5fd;

export type MeshPriority = 'critical' | 'high' | 'normal' | 'low';

export const PRIORITY_WEIGHTS: Record<MeshPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25
};

export type MeshPacketType =
  | 'alert'
  | 'direct'
  | 'heartbeat'
  | 'sync_offer'
  | 'sync_request'
  | 'ack';

export interface MeshPacketHeader {
  id: string;
  type: MeshPacketType;
  sender: string;
  senderPubkey: string;
  recipient: string; // Node ID or '*' for broadcast
  timestamp: number;
  ttl: number; // TTL in seconds
  maxHops: number;
  hopCount: number;
  path: string[];
  priority: MeshPriority;
}

export interface MeshPacket<T = unknown> {
  magic: number;
  version: number;
  header: MeshPacketHeader;
  payload: T;
  signature: string;
}

export interface MeshIdentity {
  nodeId: string;
  name: string;
  publicKeyHex: string;
  privateKeyPem: string;
  createdAt: number;
}

export interface DeliveredMessage<T = unknown> {
  packetId: string;
  sender: string;
  senderPubkey: string;
  recipient: string;
  priority: MeshPriority;
  timestamp: number;
  receivedAt: number;
  deliveryDelayMs: number;
  hopCount: number;
  path: string[];
  payload: T;
  signatureVerified: boolean;
}

export interface MeshMetrics {
  sentCount: number;
  receivedCount: number;
  deliveredCount: number;
  relayedCount: number;
  expiredCount: number;
  duplicateCount: number;
  invalidSignatureCount: number;
  tamperedCount: number;
}

export interface SneakernetBundle {
  magic: number;
  exportedAt: number;
  exporterNodeId: string;
  notes?: string;
  packetCount: number;
  packets: MeshPacket[];
}

export interface RadioSimulationProfile {
  latencyMs: number;
  packetLossRate: number; // 0.0 to 1.0
  bandwidthKbps?: number;
  isPartitioned?: boolean;
}
