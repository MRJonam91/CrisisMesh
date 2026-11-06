name: Proposta di funzionalità / Feature Request
description: Suggerisci un miglioramento o nuovo trasporto per CrisisMesh
labels: [enhancement]
body:
  - type: markdown
    attributes:
      value: Condividi la tua proposta per migliorare la resilienza e le capacità mesh di CrisisMesh.
  - type: textarea
    id: feature
    attributes:
      label: Descrizione della proposta / Proposed feature
      description: Quale problema risolve e come dovrebbe comportarsi?
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternative considerate / Alternatives considered
      description: Hai valutato altre soluzioni o protocolli?
    validations:
      false
