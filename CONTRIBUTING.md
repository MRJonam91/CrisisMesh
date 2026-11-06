# Contributing to CrisisMesh / Contribuire a CrisisMesh

Grazie per l'interesse a contribuire a CrisisMesh! / Thank you for your interest in contributing to CrisisMesh!

## 🇮🇹 Linee guida
1. **DCO (Developer Certificate of Origin)**: firma ogni commit con `git commit -s`. Confermando che il codice è tuo o che hai il diritto di distribuirlo con licenza Apache-2.0.
2. **Architettura snella**: mantieni il core (`src/core/`) modulare e conciso (< 1.500 righe totali).
3. **Zero dipendenze esterne**: CrisisMesh è progettato per funzionare con moduli standard Node.js (`node:crypto`, `node:dgram`, `node:events`), massimizzando affidabilità e portabilità in scenari di crisi.
4. **Verificabilità e sicurezza crittografica**: ogni pacchetto deve essere firmato con Ed25519 e verificabile determinamente; i test devono verificare la resilienza a manomissioni e loop.
5. **Confini etici**: CrisisMesh è un prototipo di resilienza delay-tolerant per ricerca e lab trial; non presentarlo come canale salvavita certificato.

## 🇬🇧 Guidelines
1. **DCO (Developer Certificate of Origin)**: sign off every commit with `git commit -s`. This certifies you have the right to submit the code under the Apache-2.0 license.
2. **Lean Architecture**: keep the core engine (`src/core/`) modular and concise (< 1,500 LOC).
3. **Zero runtime dependencies**: CrisisMesh relies exclusively on Node.js standard modules (`node:crypto`, `node:dgram`, `node:events`) to maximize resilience, auditability and cross-platform reliability during emergencies.
4. **Verifiability & Cryptographic Integrity**: all packets are Ed25519-signed and strictly verified; test suites must validate tamper rejection, loop prevention, and priority queue ordering.
5. **Ethical Boundaries**: CrisisMesh is an experimental delay-tolerant mesh communication prototype; do not market it as a certified life-safety emergency system.

## Sviluppo locale / Local Development
```bash
git clone https://github.com/MRJonam91/CrisisMesh.git
cd CrisisMesh
npm install
npm test
npm run build
npm start -- --help
```
