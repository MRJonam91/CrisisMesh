#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import fs from 'node:fs';
import path from 'node:path';
import {
  createIdentity,
  saveIdentityToFile,
  loadIdentityFromFile,
  ensureEncryptionKeys
} from '../core/identity.ts';
import { CrisisNode } from '../core/node.ts';
import { UdpMeshTransport } from '../core/transports.ts';
import { runLabTrial } from '../core/labTrial.ts';
import { createCrisisWebServer } from '../server/webDashboard.ts';
import type { MeshPriority, EmergencyDistressPayload } from '../core/types.ts';

const SPONSOR_LINE =
  'Ti piace CrisisMesh? Supporta lo sviluppo: https://github.com/sponsors/MRJonam91 o https://paypal.me/manorollo';

function printSponsorHint(): void {
  if (process.env.NO_SPONSOR === '1' || process.env.CI === 'true') return;
  if (!process.stdout.isTTY) return;
  // 1 in 10 chance
  if (Math.random() < 0.1) {
    console.log(`\n\x1b[90m${SPONSOR_LINE}\x1b[0m`);
  }
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`
CrisisMesh CLI v1.2.0-beta — Peer-to-peer store-and-forward mesh for blackouts & crisis resilience

Uso / Usage:
  crisismesh <comando> [opzioni]

Comandi / Commands:
  trial                      Esegue la prova di laboratorio verificabile (First Verifiable Slice)
  identity create [opzioni]  Genera una nuova identità crittografica Ed25519 + X25519 (E2EE)
  node start [opzioni]       Avvia un nodo peer mesh attivo su socket locale UDP
  web [opzioni]              Avvia il portale web offline di emergenza e server REST
  send [opzioni]             Invia un pacchetto firmato su rete locale mesh (broadcast o diretto)
  sos [opzioni]              Invia un segnale di allarme/soccorso georeferenziato strutturato (CRITICAL)
  bundle export [opzioni]    Esporta la coda store-and-forward in un bundle sneakernet fisico
  bundle import [opzioni]    Importa e verifica pacchetti da un file bundle sneakernet
  sponsor                    Mostra le opzioni per supportare il progetto open source
  --help, -h                 Mostra questa guida
  --version, -v              Mostra la versione installata

Opzioni / Options:
  --id <file>                Percorso del file identità (default: ./node-identity.json)
  --name <nome>              Nome visualizzato del nodo (default: local-node)
  --port <porta>             Porta UDP locale o Porta Web (default: 8443 / 3000)
  --web-port <porta>         Porta del server Web dashboard (default: 3000)
  --broadcast-port <porta>   Porta UDP broadcast remota (default: 8443)
  --message, -m <testo>      Contenuto del messaggio da trasmettere
  --priority <p>             Priorità: critical, high, normal, low (default: normal)
  --to <nodeId>              Destinatario diretto (default: '*' broadcast)
  --journal <file>           Percorso per persistenza atomica coda store-and-forward
  --category <cat>           Categoria S.O.S.: medical, rescue, hazard, supplies, structural
  --lat <latitudine>         Coordinata GPS latitudine
  --lon <longitudine>        Coordinata GPS longitudine
  --needs <fabbisogno>       Descrizione bisogni (es: "plasma, acqua 500L, generatore")
  --file <file>              File bundle per import/export

Sponsor:
  ${SPONSOR_LINE}
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log('crisismesh v1.2.0-beta');
    return;
  }

  if (command === 'sponsor') {
    console.log('\n❤️ Supporta lo sviluppo aperto di CrisisMesh:');
    console.log('  - GitHub Sponsors : https://github.com/sponsors/MRJonam91');
    console.log('  - Ko-fi           : https://ko-fi.com/mrjonam');
    console.log('  - Buy Me A Coffee : https://buymeacoffee.com/mrjonam');
    console.log('  - PayPal          : https://paypal.me/manorollo\n');
    return;
  }

  if (command === 'trial') {
    console.log('\n[CrisisMesh] Avvio First Verifiable Slice — Lab Trial su 3 nodi locali...');
    console.log('----------------------------------------------------------------------');
    const result = await runLabTrial();

    console.log(`Trial ID       : ${result.trialId}`);
    console.log(`Data e Ora     : ${result.timestamp}`);
    console.log(`Nodi Simulati  : ${result.parameters.nodeCount} (Alpha, Rover Relay, Command Base)`);
    console.log(`Latenza Link   : ${result.parameters.simulatedLatencyMs} ms`);
    console.log(`Packet Loss    : ${(result.parameters.packetLossRate * 100).toFixed(0)}%`);
    console.log('----------------------------------------------------------------------');
    console.log('Messaggi Inviati:');
    for (const msg of result.sampleInputs) {
      console.log(`  [${msg.priority.toUpperCase().padEnd(8)}] "${msg.title}": ${msg.content}`);
    }
    console.log('----------------------------------------------------------------------');
    console.log('Osservazioni e Metriche di Consegna:');
    console.log(`  Consegna Riuscita      : ${result.observations.messagesDelivered}/${result.observations.messagesSent} (${result.observations.deliveryRatePercent}%)`);
    console.log(`  Latenza Media Arrivo   : ${result.observations.averageDelayMs} ms`);
    console.log(`  Firme Ed25519 Valide   : ${result.observations.allSignaturesVerified ? 'Sì (100% verificate)' : 'No'}`);
    console.log(`  Manomissioni Rilevate  : ${result.observations.tamperedPacketsDetected} pacchetti alterati intercettati e scartati`);
    console.log(`  Priorità Rispettata    : ${result.observations.priorityRespected ? 'Sì (emergenze instradate per prime)' : 'No'}`);
    console.log('----------------------------------------------------------------------');
    console.log('Decisioni Umane e Limiti Radio:');
    for (const dec of result.humanDecisionsRequired) {
      console.log(`  • ${dec}`);
    }
    console.log('----------------------------------------------------------------------');
    console.log(`Esito Prova Verificabile: ${result.isVerifiableSuccess ? '✅ SUCCESSO (VERIFICATA)' : '❌ FALLITA'}\n`);

    printSponsorHint();
    return;
  }

  if (command === 'identity') {
    const subCmd = args[1];
    if (subCmd === 'create') {
      const name = getArgValue(args, '--name') ?? 'node-alpha';
      const outFile = getArgValue(args, '--out') ?? './node-identity.json';

      const identity = createIdentity(name);
      saveIdentityToFile(path.resolve(outFile), identity);

      console.log(`\n✅ Nuova identità creata con successo in: ${outFile}`);
      console.log(`   Node ID       : ${identity.nodeId}`);
      console.log(`   Ed25519 Pubkey: ${identity.publicKeyHex.substring(0, 32)}...`);
      console.log(`   X25519 E2EE   : ${identity.x25519PublicKeyHex?.substring(0, 32)}...`);
      console.log('   Algoritmi     : Ed25519 (Firma) + X25519 (Crittografia)\n');
      printSponsorHint();
      return;
    }
    console.log('Comando identity non riconosciuto. Usa: crisismesh identity create --out <file>');
    return;
  }

  if (command === 'node') {
    const subCmd = args[1];
    if (subCmd === 'start') {
      const idFile = getArgValue(args, '--id') ?? './node-identity.json';
      const portRaw = getArgValue(args, '--port');
      const port = portRaw ? parseInt(portRaw, 10) : 8443;
      const journalPath = getArgValue(args, '--journal');

      let identity;
      if (fs.existsSync(idFile)) {
        identity = loadIdentityFromFile(idFile);
        identity = ensureEncryptionKeys(identity);
      } else {
        console.log(`File identità ${idFile} non trovato. Creazione automatica in corso...`);
        identity = createIdentity('auto-node');
        saveIdentityToFile(idFile, identity);
      }

      const node = new CrisisNode({
        identity,
        storagePath: journalPath ? path.resolve(journalPath) : undefined
      });
      const transport = new UdpMeshTransport({ port, broadcastPort: port });
      node.addTransport(transport);

      node.on('message', (msg) => {
        console.log(`\n📨 [MESSAGGIO RICEVUTO] [${msg.priority.toUpperCase()}] da ${msg.sender}`);
        console.log(`   Payload   : ${JSON.stringify(msg.payload, null, 2)}`);
        console.log(`   Firma OK  : ${msg.signatureVerified ? 'Ed25519 Verificata' : 'NON VALIDA'}`);
        console.log(`   Hops      : ${msg.hopCount} (Cammino: ${msg.path.join(' -> ')})`);
      });

      node.on('peer:discovered', (peer) => {
        console.log(`\n📡 [VICINO RILEVATO] Nuovo peer ${peer.name} (${peer.nodeId}) a salto ${peer.hopDistance}`);
      });

      node.on('packet:tampered', (ev) => {
        console.log(`\n⚠️  [ALLARME SICUREZZA] Pacchetto manomesso intercettato da ${ev.sender}: ${ev.reason}`);
      });

      await node.start();
      console.log(`\n🛰️  CrisisMesh Daemon attivo! (v1.1.0-alpha)`);
      console.log(`   Node ID       : ${identity.nodeId} (${identity.name})`);
      console.log(`   Socket UDP    : 0.0.0.0:${port}`);
      if (journalPath) {
        console.log(`   Journal File  : ${journalPath} (persistente)`);
      }
      console.log('   In ascolto di messaggi mesh... Premi Ctrl+C per terminare.\n');

      process.on('SIGINT', async () => {
        console.log('\nArresto nodo CrisisMesh in corso...');
        await node.stop();
        printSponsorHint();
        process.exit(0);
      });
      return;
    }
  }

  if (command === 'web') {
    const idFile = getArgValue(args, '--id') ?? './node-identity.json';
    const udpPortRaw = getArgValue(args, '--port');
    const udpPort = udpPortRaw ? parseInt(udpPortRaw, 10) : 8443;
    const webPortRaw = getArgValue(args, '--web-port');
    const webPort = webPortRaw ? parseInt(webPortRaw, 10) : 3000;
    const journalPath = getArgValue(args, '--journal');

    let identity;
    if (fs.existsSync(idFile)) {
      identity = loadIdentityFromFile(idFile);
      identity = ensureEncryptionKeys(identity);
    } else {
      identity = createIdentity('web-node');
      saveIdentityToFile(idFile, identity);
    }

    const node = new CrisisNode({
      identity,
      storagePath: journalPath ? path.resolve(journalPath) : undefined
    });
    const transport = new UdpMeshTransport({ port: udpPort, broadcastPort: udpPort });
    node.addTransport(transport);
    await node.start();

    const server = createCrisisWebServer(node, webPort);

    console.log(`\n🌐 CrisisMesh Emergency Web Portal attivo! (v1.2.0-beta)`);
    console.log(`   Dashboard Web : http://localhost:${webPort}`);
    console.log(`   Socket UDP    : 0.0.0.0:${udpPort}`);
    console.log(`   Node ID       : ${identity.nodeId} (${identity.name})`);
    console.log('   Premi Ctrl+C per arrestare il portale.\n');

    process.on('SIGINT', async () => {
      console.log('\nArresto portale web e nodo CrisisMesh...');
      server.close();
      await node.stop();
      printSponsorHint();
      process.exit(0);
    });
    return;
  }

  if (command === 'sos') {
    const idFile = getArgValue(args, '--id') ?? './node-identity.json';
    let identity;
    if (fs.existsSync(idFile)) {
      identity = loadIdentityFromFile(idFile);
    } else {
      identity = createIdentity('sos-unit');
    }

    const messageText = getArgValue(args, '-m') ?? getArgValue(args, '--message') ?? 'SOS EMERGENCY BROADCAST';
    const category = (getArgValue(args, '--category') ?? 'rescue') as EmergencyDistressPayload['category'];
    const latRaw = getArgValue(args, '--lat');
    const lonRaw = getArgValue(args, '--lon');
    const needs = getArgValue(args, '--needs');
    const portRaw = getArgValue(args, '--port');
    const port = portRaw ? parseInt(portRaw, 10) : 8443;

    const payload: EmergencyDistressPayload = {
      category,
      severity: 'sos',
      message: messageText,
      location: latRaw && lonRaw ? { lat: parseFloat(latRaw), lon: parseFloat(lonRaw) } : undefined,
      needs: needs ? { medicalTriage: needs } : undefined
    };

    const node = new CrisisNode({ identity });
    const transport = new UdpMeshTransport({ port: 0, broadcastPort: port });
    node.addTransport(transport);
    await node.start();

    await node.broadcast(payload, { priority: 'critical', ttl: 86400 });
    console.log(`\n🚨 ALLARME S.O.S. TRASMESSO IN BROADCAST (Porta UDP ${port})`);
    console.log(`   Categoria: ${category.toUpperCase()}`);
    console.log(`   Messaggio: ${messageText}`);
    if (payload.location) {
      console.log(`   GPS Coords: ${payload.location.lat}, ${payload.location.lon}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
    await node.stop();
    printSponsorHint();
    return;
  }

  if (command === 'send') {
    const messageText = getArgValue(args, '-m') ?? getArgValue(args, '--message');
    if (!messageText) {
      console.error('Errore: specifica il messaggio con -m "testo messaggio"');
      process.exit(1);
    }

    const idFile = getArgValue(args, '--id') ?? './node-identity.json';

    let identity;
    if (fs.existsSync(idFile)) {
      identity = loadIdentityFromFile(idFile);
    } else {
      identity = createIdentity('sender-ephemeral');
    }

    const priority = (getArgValue(args, '--priority') ?? 'normal') as MeshPriority;
    const to = getArgValue(args, '--to') ?? '*';
    const portRaw = getArgValue(args, '--port');
    const port = portRaw ? parseInt(portRaw, 10) : 8443;

    const node = new CrisisNode({ identity });
    // Use ephemeral port 0 for sender socket, target configured broadcast port
    const transport = new UdpMeshTransport({ port: 0, broadcastPort: port });
    node.addTransport(transport);
    await node.start();

    if (to === '*') {
      await node.broadcast({ text: messageText }, { priority });
      console.log(`\n📢 Broadcast inviato su porta UDP ${port} [Priorità: ${priority}]`);
    } else {
      await node.sendDirect(to, { text: messageText }, { priority });
      console.log(`\n🎯 Diretto inviato a ${to} su porta UDP ${port} [Priorità: ${priority}]`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
    await node.stop();
    printSponsorHint();
    return;
  }

  if (command === 'bundle') {
    const subCmd = args[1];
    if (subCmd === 'export') {
      const outFile = getArgValue(args, '--file') ?? './crisismesh.bundle.json';
      const id = createIdentity('bundle-exporter');
      const node = new CrisisNode({ identity: id });
      const bundle = node.exportBundle('Physical sneakernet data transfer');
      fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2), 'utf8');
      console.log(`\n💾 Bundle sneakernet esportato con successo in: ${outFile}`);
      return;
    }
  }

  console.log(`Comando non riconosciuto: "${command}". Esegui crisismesh --help`);
}

main().catch((err) => {
  console.error('\nErrore imprevisto:', err);
  process.exit(1);
});
