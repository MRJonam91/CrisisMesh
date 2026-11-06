// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { runLabTrial } from '../src/core/labTrial.ts';

test('runLabTrial: First Verifiable Slice executes reproducibly under controlled conditions', async () => {
  const result = await runLabTrial();

  assert.equal(result.isVerifiableSuccess, true);
  assert.equal(result.parameters.nodeCount, 3);
  assert.equal(result.sampleInputs.length, 3);
  assert.equal(result.observations.messagesSent, 3);
  assert.equal(result.observations.messagesDelivered, 3);
  assert.equal(result.observations.deliveryRatePercent, 100);
  assert.equal(result.observations.allSignaturesVerified, true);
  assert.ok(result.observations.tamperedPacketsDetected >= 1);
  assert.equal(result.observations.priorityRespected, true);
  assert.ok(result.sampleOutputs.length === 3);

  // Verify threat model and limits are documented
  assert.ok(result.parameters.threatModel.length >= 2);
  assert.ok(result.parameters.radioLimits.length >= 2);
  assert.ok(result.estimations.length >= 2);
  assert.ok(result.humanDecisionsRequired.length >= 2);
});
