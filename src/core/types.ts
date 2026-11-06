// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

/**
 * CrisisMesh Core Protocol Types and Constants
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
  x25519PublicKeyHex?: string;
  x25519PrivateKeyPem?: string;
  createdAt: number;
}

export interface EncryptedPayload {
  isEncrypted: true;
  algorithm: 'aes-256-gcm-x25519';
  ephemeralPublicKeyHex: string;
  ivHex: string;
  authTagHex: string;
  ciphertextHex: string;
}

export interface NeighborPeer {
  nodeId: string;
  name: string;
  lastSeen: number;
  hopDistance: number;
  viaAddress?: string;
}

export interface EmergencyDistressPayload {
  category: 'medical' | 'rescue' | 'hazard' | 'supplies' | 'evacuation' | 'structural';
  severity: 'sos' | 'urgent' | 'advisory';
  message: string;
  location?: { lat: number; lon: number; description?: string };
  needs?: { waterLitres?: number; rations?: number; powerKw?: number; medicalTriage?: string };
  casualties?: { injured: number; trapped: number; deceased: number };
}

export interface SyncOfferPayload {
  offerPacketIds: string[];
  senderNodeId: string;
}

export interface SyncRequestPayload {
  requestedPacketIds: string[];
  requesterNodeId: string;
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

export interface AckPayload {
  originalPacketId: string;
  originalSender: string;
  recipientNodeId: string;
  deliveredAt: number;
}

export interface RouteEntry {
  destinationNodeId: string;
  nextHopNodeId: string;
  distanceHops: number;
  lastUpdated: number;
}
