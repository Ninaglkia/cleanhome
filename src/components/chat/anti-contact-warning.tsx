interface AntiContactWarningProps {
  visible: boolean;
}

export function AntiContactWarning({ visible }: AntiContactWarningProps) {
  if (!visible) return null;
  return (
    <div className="mx-4 mb-2 rounded-xl bg-[#fff7ed] border border-[#f6ad55] p-3 text-xs text-[#92400e]">
      Il tuo messaggio conteneva informazioni di contatto non consentite (numero di telefono,
      email, link o social) e sono state rimosse. Condividere contatti diretti non è permesso
      sulla piattaforma.
    </div>
  );
}
