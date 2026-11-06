// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrisisWebServer } from '../src/server/webDashboard.ts';
import { CrisisNode } from '../src/core/node.ts';
import { createIdentity } from '../src/core/identity.ts';
import type { AddressInfo } from 'node:net';

test('CrisisWebServer: serves health, HTML dashboard and REST APIs', async () => {
  const id = createIdentity('web-test-node');
  const node = new CrisisNode({ identity: id });
  await node.start();

  // Listen on random free port
  const server = createCrisisWebServer(node, 0);
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'ok');
    assert.equal(healthData.nodeId, id.nodeId);

    // 2. HTML portal
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.ok(html.includes('CrisisMesh'));
    assert.ok(html.includes(id.nodeId));

    // 3. API status
    const statusRes = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(statusData.nodeId, id.nodeId);
    assert.equal(statusData.queueSize, 0);

    // 4. API SOS dispatch
    const sosRes = await fetch(`${baseUrl}/api/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'medical',
        message: 'Ambulance needed',
        lat: 45.07,
        lon: 7.68,
        needs: 'Oxygen'
      })
    });
    assert.equal(sosRes.status, 200);
    const sosData = await sosRes.json();
    assert.equal(sosData.success, true);
    assert.ok(sosData.packetId);
    assert.equal(sosData.payload.category, 'medical');

    // 5. API send direct message
    const sendRes = await fetch(`${baseUrl}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '*',
        text: 'Radio test broadcast',
        priority: 'high'
      })
    });
    assert.equal(sendRes.status, 200);
    const sendData = await sendRes.json();
    assert.equal(sendData.success, true);

    // 6. Bundle export
    const bundleRes = await fetch(`${baseUrl}/api/bundle/export`);
    assert.equal(bundleRes.status, 200);
    const bundle = await bundleRes.json();
    assert.equal(bundle.exporterNodeId, id.nodeId);

    // 7. Routes API
    const routesRes = await fetch(`${baseUrl}/api/routes`);
    assert.equal(routesRes.status, 200);
    const routes = await routesRes.json();
    assert.ok(Array.isArray(routes));

    // 8. Validation error on empty text
    const emptyRes = await fetch(`${baseUrl}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' })
    });
    assert.equal(emptyRes.status, 400);
  } finally {
    server.close();
    await node.stop();
  }
});
