name: Bug report
description: Segnala un malfunzionamento o anomalia in CrisisMesh
labels: [bug]
body:
  - type: markdown
    attributes:
      value: Grazie per segnalare un bug in CrisisMesh!
  - type: textarea
    id: description
    attributes:
      label: Descrizione / Description
      description: Cosa è successo inaspettatamente?
    validations:
      required: true
  - type: textarea
    id: reproduction
    attributes:
      label: Passi per riprodurre / Steps to reproduce
      description: Comandi o sequenza di test eseguiti
    validations:
      required: true
  - type: input
    id: environment
    attributes:
      label: Ambiente / Environment
      description: Versione Node.js, OS, tipo di trasporto (virtual / UDP)
    validations:
      required: true
