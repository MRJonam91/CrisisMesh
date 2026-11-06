# CrisisMesh — Rete Mesh Store-and-Forward Resiliente per Blackout e Calamità

[Italiano](README.it.md) · [English](README.md) · [Architettura](docs/ARCHITECTURE.md) · [Checklist di Lancio](docs/LAUNCH.md)

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![CI](https://github.com/MRJonam91/CrisisMesh/actions/workflows/ci.yml/badge.svg)](https://github.com/MRJonam91/CrisisMesh/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.18-brightgreen)](package.json)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-success)](package.json)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-MRJonam91-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/MRJonam91)

Protocollo di comunicazione peer-to-peer autonomo, zero-dipendenze con motore tollerante ai ritardi (DTN) e architettura store-and-forward, progettato per blackout della rete elettrica, interruzioni infrastrutturali e partizioni geografiche. Include firme crittografiche asimmetriche Ed25519, coda outbox prioritizzata per emergenze, soppressione dei loop e scambio bundle sneakernet per data mule offline.

```
┌─────────────────────────────────┐               ┌─────────────────────────────────┐
│        Avamposto Alpha          │               │      Ospedale / Campo Base      │
│  (Isolato da blackout di rete)  │ ◄── PARTIZIONE ─► │ (In attesa dei referti triage)  │
└────────────────┬────────────────┘ (Canale perso)└────────────────▲────────────────┘
                 │ Envelope Firmato                                │ Triage Verificato
                 ▼                                                 │
        ┌──────────────────────────────────────────────────────────┴┐
        │                 Rover Mule Relay (Nodo B)                 │
        │  • Mantiene i pacchetti nella Coda Store-and-Forward     │
        │  • Si sposta attraverso il territorio partizionato        │
        │  • Scarica opportunamente al Campo Base appena in portata │
        └───────────────────────────────────────────────────────────┘
```

---

## 🎯 Il Problema

Quando le infrastrutture di telecomunicazione collassano a seguito di terremoti, nubifragi, blackout prolungati della rete elettrica o crisi civili, le comunicazioni tradizionali si interrompono all'istante:
- **Dipendenza da Servizi Centralizzati**: Ripetitori cellulari, fibra e provider dipendono dalla rete elettrica primaria, da resolver DNS remoti e server cloud.
- **Scarto Immediato dei Pacchetti (Packet Drop)**: Il routing IP tradizionale scarta istantaneamente i pacchetti quando non trova un percorso end-to-end attivo, perdendo richieste di aiuto vitali.
- **Spoofing e Manipolazione**: I canali radio analogici privi di autenticazione sono vulnerabili a falsi allarmi, manomissioni dei messaggi e impersonificazione dei soccorritori.
- **Tempeste di Broadcast (Storms)**: Il reinoltro incontrollato satura in pochi secondi canali radio a bassa frequenza e banda ridotta in loop infiniti.

---

## 🛰️ La Soluzione: CrisisMesh

CrisisMesh implementa una rete mesh resiliente e opportunistica adatta a condizioni estreme:
- **Identità Crittografica Deterministica ed E2EE**: Ciascun nodo genera chiavi asimmetriche Ed25519 (firma) e X25519 (cifratura). Il Node ID è l'impronta SHA-256 della chiave pubblica (`cm_<pubkey_hash>`). I messaggi diretti supportano la crittografia end-to-end autenticata (AES-256-GCM via X25519 ECDH), garantendo riservatezza totale anche attraverso relay intermedi sconosciuti.
- **Busta Crittografica Immutabile**: Ogni messaggio (sia broadcast che diretto) è protetto da firma digitale Ed25519 sul digest canonico SHA-256 dell'intestazione e del payload. Qualsiasi manomissione in transito genera l'errore `[CMSH-ERR-7104]` e lo scarto immediato.
- **Coda Store-and-Forward Tollerante ai Ritardi (DTN)**: Se il nodo destinatario è fuori portata o isolato, i messaggi restano bufferizzati in memoria o persistiti su journal atomico anti-crash (`--journal`), ordinati per priorità (`CRITICAL` > `HIGH` > `NORMAL` > `LOW`).
- **Sincronizzazione Epidemica Delta**: Handshake `sync_offer` e `sync_request` per scambiare unicamente i pacchetti mancanti ad ogni incontro, preservando canali radio a bassa velocità (LoRa, VHF).
- **Scoperta Vicini e Beacons**: Beacons heartbeat a 1 salto per mappare automaticamente la topologia locale e rilevare i nodi nei paraggi (`peer:discovered`).
- **Mitigazione di Loop e Amplificazioni**: La cache di deduplicazione `SeenCache` (LRU scorrevole) e il limite massimo di salti (`maxHops`) impediscono tempeste di broadcast nella rete mesh.
- **Trasporti Modulari**:
  - `VirtualRadioTransport`: Canale radio in-memory con latenza simulata, perdita pacchetti regolabile e partizioni per prove di laboratorio e test CI riproducibili.
  - `UdpMeshTransport`: Trasporto reale broadcast UDP su rete locale, per consentire a terminali, PC e dispositivi sulla stessa LAN o hotspot Wi-Fi di scambiarsi messaggi senza internet.
  - `SneakernetBundle`: Esportazione e importazione di bundle su file per trasferimento fisico via chiavette USB, memorie SD o droni.
- **Zero Dipendenze Runtime**: Sviluppato in TypeScript moderno affidandosi esclusivamente ai moduli standard di Node.js (`node:crypto`, `node:dgram`, `node:events`).
- **Guardia Architetturale Core**: Codice core strettamente contenuto sotto le 1.500 righe di codice (< 1.000 LOC attuali).

---

## ⚠️ Limiti Operativi e Avvertenza di Sicurezza

> [!CAUTION]
> **AVVERTENZA IMPORTANTE**: CrisisMesh è un prototipo sperimentale per la ricerca e lo sviluppo di protocolli di comunicazione tolleranti ai ritardi. **NON** è certificato per comunicazioni di emergenza salvavita, non sostituisce il Numero Unico di Emergenza 112/911 né i canali radio regolamentati della Protezione Civile. Nelle emergenze reali fare sempre riferimento alle frequenze e alle procedure delle autorità autorizzate.

---

## 🚀 Avvio Rapido​‌​​‌‌​‌​‌​‌​​‌​​‌​​‌​‌​​​‌‌‌​​‌​​‌‌​​​‌​​‌​‌‌​‌​‌‌​​​​‌​‌‌‌​​‌‌​‌‌​‌​​​​​‌​‌‌​‌​​‌‌‌​​‌​‌‌​​‌‌​​​‌‌​​‌​​‌‌​​​‌​​​‌‌​‌‌‌​​‌‌​​​‌

Esegui la prova di laboratorio verificabile in pochi secondi:

```bash
# 1. Esegui la prova di laboratorio verificabile (First Verifiable Slice)
npx crisismesh trial

# 2. Genera una nuova identità crittografica di nodo
npx crisismesh identity create --name "avamposto-1" --out ./node.json

# 3. Avvia il demone peer mesh su socket UDP locale
npx crisismesh node start --id ./node.json --port 8443

# 4. Invia un allarme prioritario firmato in broadcast
npx crisismesh send -m "Richiesta acqua potabile Settore 4" --priority critical --port 8443
```

---

## 🧪 Prima Prova Verificabile: Lab Trial

CrisisMesh include uno scenario automatizzato e deterministico (`src/core/labTrial.ts`) che simula una situazione di soccorso a 3 nodi:
- **Avamposto Alpha**: Isolato nell'area colpita, invia 3 comunicazioni a diversa priorità.
- **Rover Mule (Relay mobile)**: Riceve i messaggi e li bufferizza nella coda store-and-forward, attraversando la partizione radio simulata (140 ms di latenza, 5% di perdita).
- **Campo Base (Ospedale)**: Riceve i messaggi ritrasmessi, convalida il 100% delle firme Ed25519, preserva l'ordine di triage e respinge un tentativo di iniezione di un pacchetto manomesso.

Esegui la prova in qualsiasi momento:
```bash
npm run trial
```

---

## 💻 Utilizzo Programmabile (SDK TypeScript)

```typescript
import {
  createIdentity,
  CrisisNode,
  UdpMeshTransport
} from 'crisismesh';

// 1. Genera identità crittografica Ed25519
const identity = createIdentity('soccorso-alpino-1');

// 2. Inizializza il nodo
const node = new CrisisNode({ identity });

// 3. Collega il trasporto broadcast UDP
node.addTransport(new UdpMeshTransport({ port: 8443 }));

// 4. Ricezione e verifica automatica
node.on('message', (msg) => {
  console.log(`[${msg.priority.toUpperCase()}] Da ${msg.sender}:`, msg.payload);
  console.log(`Firma autentica verificata: ${msg.signatureVerified}`);
});

// 5. Avvio e trasmissione allarme prioritario
await node.start();
await node.broadcast(
  { emergenza: 'Guasto generatore', autonomiaMinuti: 45 },
  { priority: 'critical', ttl: 7200 }
);
```

---

## ☕ Supporto e Donazioni

CrisisMesh è software 100% libero e open source sotto licenza permissiva **Apache-2.0**. Se questo progetto ti è utile per la ricerca sulla resilienza o l'implementazione di reti d'emergenza comunitarie, sostienine lo sviluppo:

- **GitHub Sponsors:** [sponsor @MRJonam91](https://github.com/sponsors/MRJonam91)
- **Ko-fi:** [ko-fi.com/mrjonam](https://ko-fi.com/mrjonam)
- **Buy Me a Coffee:** [buymeacoffee.com/mrjonam](https://buymeacoffee.com/mrjonam)
- **PayPal:** [paypal.me/manorollo](https://paypal.me/manorollo)

---

## 📄 Licenza e Attribuzione

- **Codice Sorgente**: [Apache-2.0](LICENSE) — Copyright (c) 2026 Manoj Rollo ([@MRJonam91](https://github.com/MRJonam91)). Consulta [NOTICE](NOTICE) e [LICENSING.md](LICENSING.md).
- **Documentazione**: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
