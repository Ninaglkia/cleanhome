# Dati dei suggerimenti città

I nomi dei comuni, le province e le coordinate usati dalla ricerca locale derivano dal dataset [RP92/comuni-italiani](https://github.com/RP92/comuni-italiani). Crediti: ISTAT per l’anagrafica e i dati territoriali; Garda Informatica, “Database dei comuni italiani”, per le coordinate; RP92 per la raccolta e normalizzazione.

Il dataset è distribuito con licenza [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Le fonti originali e la relativa attribuzione sono documentate nella [licenza dei dati](https://github.com/RP92/comuni-italiani/blob/main/LICENSE-DATA). Le coordinate di Garda Informatica sono dichiarate dal produttore del dataset come fonte MIT.

CleanHome seleziona solo i campi necessari alla ricerca dei comuni, arrotonda le coordinate a sei decimali ed esclude coordinate mancanti o fuori dall’area italiana. La provenienza, la data di acquisizione e l’impronta del file sorgente sono conservate in `lib/data/italian-cities.source.json`. I suggerimenti vengono ricercati localmente sul dispositivo. Le coordinate rappresentano il comune e non l’indirizzo di una casa o di una persona.
