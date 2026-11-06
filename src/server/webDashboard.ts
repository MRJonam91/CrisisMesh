// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import http from 'node:http';
import type { CrisisNode } from '../core/node.ts';
import type { EmergencyDistressPayload, MeshPriority } from '../core/types.ts';

export function createCrisisWebServer(node: CrisisNode, port = 3000): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // 1. Health endpoint
      if (pathname === '/health' && method === 'GET') {
        const metrics = node.getMetrics();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            service: 'CrisisMesh Emergency Node',
            version: '1.0.0',
            nodeId: node.identity.nodeId,
            uptimeSeconds: Math.floor(process.uptime()),
            metrics
          })
        );
        return;
      }

      // 2. Status API
      if (pathname === '/api/status' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            nodeId: node.identity.nodeId,
            name: node.identity.name,
            publicKeyHex: node.identity.publicKeyHex,
            x25519PublicKeyHex: node.identity.x25519PublicKeyHex,
            queueSize: node.getQueueSize(),
            inboxCount: node.getInbox().length,
            peersCount: node.getPeers().length,
            metrics: node.getMetrics()
          })
        );
        return;
      }

      // 3. Inbox API
      if (pathname === '/api/inbox' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(node.getInbox()));
        return;
      }

      // 4. Peers API
      if (pathname === '/api/peers' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(node.getPeers()));
        return;
      }

      // 5. Routes API
      if (pathname === '/api/routes' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(node.getRoutes()));
        return;
      }

      // 6. Send Message API
      if (pathname === '/api/send' && method === 'POST') {
        const body = await parseJsonBody(req);
        const text = String(body['text'] || '');
        const to = String(body['to'] || '*');
        const priority = (body['priority'] || 'normal') as MeshPriority;

        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing text content' }));
          return;
        }

        if (to === '*') {
          const pkt = await node.broadcast({ text }, { priority });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, packetId: pkt.header.id }));
        } else {
          const pkt = await node.sendDirect(to, { text }, { priority });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, packetId: pkt.header.id }));
        }
        return;
      }

      // 7. S.O.S. Distress Alert API
      if (pathname === '/api/sos' && method === 'POST') {
        const body = await parseJsonBody(req);
        const category = (body['category'] || 'rescue') as EmergencyDistressPayload['category'];
        const message = String(body['message'] || 'EMERGENCY S.O.S. ALERT');
        const lat = typeof body['lat'] === 'number' ? body['lat'] : undefined;
        const lon = typeof body['lon'] === 'number' ? body['lon'] : undefined;
        const needs = body['needs'] ? String(body['needs']) : undefined;

        const payload: EmergencyDistressPayload = {
          category,
          severity: 'sos',
          message,
          location: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
          needs: needs ? { medicalTriage: needs } : undefined
        };

        const pkt = await node.broadcast(payload, { priority: 'critical', ttl: 86400 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, packetId: pkt.header.id, payload }));
        return;
      }

      // 8. Sneakernet Bundle Export
      if (pathname === '/api/bundle/export' && method === 'GET') {
        const bundle = node.exportBundle('Emergency HTTP portal export');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="crisismesh.bundle.json"'
        });
        res.end(JSON.stringify(bundle, null, 2));
        return;
      }

      // 9. Sneakernet Bundle Import
      if (pathname === '/api/bundle/import' && method === 'POST') {
        const bundle = await parseJsonBody(req);
        const result = node.importBundle(bundle as unknown as import('../core/types.ts').SneakernetBundle);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      // 10. Embedded Emergency Web Portal (HTML Dashboard)
      if (pathname === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderDashboardHtml(node));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: msg }));
    }
  });

  server.listen(port);
  return server;
}

function parseJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function renderDashboardHtml(node: CrisisNode): string {
  const identity = node.identity;
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CrisisMesh — Emergency Portal</title>
  <style>
    :root {
      --bg: #0f141c;
      --card: #18202c;
      --border: #283548;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --red: #ef4444;
      --amber: #f59e0b;
      --blue: #3b82f6;
      --green: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 1.5rem; line-height: 1.5; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
    .badge-sos { background: var(--red); color: #fff; animation: pulse 2s infinite; }
    .badge-high { background: var(--amber); color: #000; }
    .badge-normal { background: var(--blue); color: #fff; }
    .badge-ok { background: var(--green); color: #000; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; }
    h2 { font-size: 1.1rem; margin-bottom: 0.75rem; color: #fff; }
    button { background: var(--blue); color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
    button.btn-sos { background: var(--red); width: 100%; font-size: 1.1rem; padding: 0.9rem; margin-top: 0.5rem; }
    button:hover { opacity: 0.9; }
    input, textarea, select { width: 100%; background: #0b0f15; border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 0.6rem; margin-bottom: 0.6rem; }
    .msg-item { border-left: 4px solid var(--blue); background: #121924; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; }
    .msg-critical { border-left-color: var(--red); }
    .msg-high { border-left-color: var(--amber); }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>CrisisMesh <span class="badge badge-sos">OFFLINE EMERGENCY NODE</span></h1>
      <p style="color:var(--muted); font-size:0.85rem;">ID: <code>${identity.nodeId}</code> (${identity.name}) · v1.0.0</p>
    </div>
    <div>
      <span class="badge badge-ok">RADIO PEERS: <span id="peer-count">0</span></span>
    </div>
  </header>

  <div class="grid">
    <div class="card" style="border-color: var(--red);">
      <h2>🚨 Invia Segnale S.O.S. Immediato</h2>
      <select id="sos-cat">
        <option value="medical">Emergenza Sanitaria (Medical)</option>
        <option value="rescue">Ricerca e Soccorso (SAR Rescue)</option>
        <option value="hazard">Pericolo Crollo / Incendio (Hazard)</option>
        <option value="supplies">Rifornimento Acqua / Cibo (Supplies)</option>
      </select>
      <input type="text" id="sos-msg" placeholder="Descrivi emergenza (es: 3 feriti, crollo edificio B)">
      <input type="text" id="sos-needs" placeholder="Fabbisogno (es: plasma, barella, acqua 200L)">
      <button class="btn-sos" onclick="sendSos()">TRASMETTI S.O.S. IN RETE MESH</button>
    </div>

    <div class="card">
      <h2>📢 Trasmetti Messaggio Mesh</h2>
      <input type="text" id="msg-to" placeholder="Destinatario (* per broadcast radio)" value="*">
      <textarea id="msg-text" rows="3" placeholder="Testo messaggio operativo..."></textarea>
      <select id="msg-priority">
        <option value="normal">Priorità: Normale</option>
        <option value="high">Priorità: Alta</option>
        <option value="critical">Priorità: Critica</option>
      </select>
      <button onclick="sendMessage()">Invia Pacchetto Firmato Ed25519</button>
    </div>
  </div>

  <div class="card">
    <h2>📥 Messaggi Ricevuti dalla Rete Mesh</h2>
    <div id="inbox-list"><p style="color:var(--muted)">In ascolto di pacchetti radio...</p></div>
  </div>

  <script>
    async function refreshInbox() {
      try {
        const res = await fetch('/api/inbox');
        const msgs = await res.json();
        const list = document.getElementById('inbox-list');
        if (msgs.length === 0) return;
        list.innerHTML = msgs.reverse().map(m => {
          const cls = m.priority === 'critical' ? 'msg-critical' : (m.priority === 'high' ? 'msg-high' : '');
          return '<div class="msg-item ' + cls + '">' +
            '<strong>[' + m.priority.toUpperCase() + ']</strong> da ' + m.sender + ' (' + m.hopCount + ' salti)<br>' +
            '<p>' + JSON.stringify(m.payload) + '</p>' +
            '<small style="color:var(--muted)">Firma Ed25519: Verificata ✓ · Ritardo: ' + m.deliveryDelayMs + 'ms</small>' +
          '</div>';
        }).join('');
      } catch(e) {}
    }

    async function sendSos() {
      const cat = document.getElementById('sos-cat').value;
      const msg = document.getElementById('sos-msg').value || 'URGENT SOS';
      const needs = document.getElementById('sos-needs').value;
      await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, message: msg, needs })
      });
      alert('S.O.S. trasmesso in broadcast su tutta la maglia mesh!');
      refreshInbox();
    }

    async function sendMessage() {
      const to = document.getElementById('msg-to').value;
      const text = document.getElementById('msg-text').value;
      const priority = document.getElementById('msg-priority').value;
      await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, text, priority })
      });
      document.getElementById('msg-text').value = '';
      refreshInbox();
    }

    setInterval(refreshInbox, 3000);
    refreshInbox();
  </script>
</body>
</html>`;
}
