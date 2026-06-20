export function friendlyPaymentError(raw: string): string {
  if (__DEV__) console.log("[payment error]", raw);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === "string") raw = parsed.error;
  } catch { /* not JSON — use raw as-is */ }
  const m = (raw || "").toLowerCase();
  // Keep already-friendly Italian messages thrown internally.
  if (/indirizzo richiesto|casa non trovata|impossibile avviare il pagamento/.test(m)) {
    return raw;
  }
  if (/network|timeout|connection|failed to fetch|offline|internet/.test(m))
    return "Connessione assente o instabile. Controlla la rete e riprova.";
  if (/insufficient/.test(m)) return "Fondi insufficienti sulla carta.";
  if (/expired/.test(m)) return "La carta è scaduta. Prova con un'altra carta.";
  if (/cvc|security code|incorrect_number|invalid_number|incorrect|invalid/.test(m))
    return "Dati della carta non corretti. Controlla numero, scadenza e CVC.";
  if (/declined|do_not_honor|card_declined|generic_decline|decline/.test(m))
    return "La carta è stata rifiutata. Prova con un'altra carta o un altro metodo.";
  if (/processing_error/.test(m))
    return "Errore durante il pagamento. Riprova tra qualche momento.";
  if (/requires_payment_method/.test(m))
    return "Metodo di pagamento non valido. Riprova.";
  return "Non è stato possibile completare il pagamento. Riprova tra poco o scrivi a info@cleanhomeapp.com.";
}
