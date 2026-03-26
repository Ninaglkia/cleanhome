"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, LogOut, Mail, User, MapPin, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StripeConnectButton } from "@/components/stripe/stripe-connect-button";
import { usePlacesAutocomplete } from "@/hooks/use-places-autocomplete";
import { ALL_SERVICES } from "@/types/cleaner";
import { cn } from "@/lib/utils";

const MAX_BIO = 500;

interface CleanerProfileEditFormProps {
  userId: string;
  email: string;
  initialName: string;
  initialAvatarUrl: string | null;
  initialBio: string;
  initialCity: string;
  initialCityLat: number | null;
  initialCityLng: number | null;
  initialCleanerType: "privato" | "azienda";
  initialHourlyRate: number;
  initialServices: string[];
  initialIsAvailable: boolean;
  hasStripeAccount: boolean;
}

export function CleanerProfileEditForm({
  userId,
  email,
  initialName,
  initialAvatarUrl,
  initialBio,
  initialCity,
  initialCityLat,
  initialCityLng,
  initialCleanerType,
  initialHourlyRate,
  initialServices,
  initialIsAvailable,
  hasStripeAccount,
}: CleanerProfileEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [city, setCity] = useState(initialCity);
  const [cityLat, setCityLat] = useState(initialCityLat);
  const [cityLng, setCityLng] = useState(initialCityLng);
  const [cleanerType, setCleanerType] = useState<"privato" | "azienda">(initialCleanerType);
  const [hourlyRate, setHourlyRate] = useState(String(initialHourlyRate || ""));
  const [services, setServices] = useState<string[]>(initialServices);
  const [isAvailable, setIsAvailable] = useState(initialIsAvailable);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  usePlacesAutocomplete({
    inputRef: cityInputRef,
    onSelect: ({ address, lat, lng }) => {
      setCity(address);
      setCityLat(lat);
      setCityLng(lng);
      if (cityInputRef.current) cityInputRef.current.value = address;
    },
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAvatarBlob(file);
      setAvatarPreview(URL.createObjectURL(file));
    },
    []
  );

  const toggleService = useCallback((service: string) => {
    setServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  }, []);

  const handleAvailabilityToggle = useCallback(async (value: boolean) => {
    setIsAvailable(value);
    // Optimistically update availability immediately
    const supabase = createClient();
    await supabase.from("profiles").update({ is_available: value }).eq("id", userId);
    router.refresh();
  }, [userId, router]);

  const handleSave = useCallback(async () => {
    if (!fullName.trim()) {
      setError("Il nome non può essere vuoto.");
      return;
    }
    if (services.length === 0) {
      setError("Seleziona almeno un servizio.");
      return;
    }
    if (!hourlyRate || Number(hourlyRate) <= 0) {
      setError("Inserisci una tariffa oraria valida.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();
      let newAvatarUrl = avatarUrl;

      if (avatarBlob) {
        const ext = avatarBlob.type.split("/")[1] ?? "jpg";
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarBlob, { upsert: true, contentType: avatarBlob.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        newAvatarUrl = urlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          bio: bio.trim() || null,
          city: city || null,
          lat: cityLat,
          lng: cityLng,
          cleaner_type: cleanerType,
          hourly_rate: Number(hourlyRate),
          services,
          is_available: isAvailable,
          ...(newAvatarUrl !== avatarUrl ? { avatar_url: newAvatarUrl } : {}),
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      setAvatarUrl(newAvatarUrl);
      setAvatarBlob(null);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }, [
    fullName, bio, city, cityLat, cityLng, cleanerType,
    hourlyRate, services, isAvailable, avatarBlob, avatarUrl, userId, router,
  ]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const displayAvatar = avatarPreview ?? avatarUrl ?? undefined;
  const initials = fullName.charAt(0).toUpperCase() || "P";

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Availability toggle — prominent at top */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-primary">Disponibile per prenotazioni</p>
          <p className="text-xs text-muted-foreground">
            {isAvailable ? "I clienti possono prenotarti" : "Non visibile ai clienti"}
          </p>
        </div>
        <Switch
          checked={isAvailable}
          onCheckedChange={handleAvailabilityToggle}
        />
      </div>

      {/* Stripe Connect */}
      <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-3">
        <p className="text-sm font-semibold text-primary">Pagamenti</p>
        <p className="text-xs text-muted-foreground">
          {hasStripeAccount
            ? "Account Stripe collegato. Configura o aggiorna i tuoi dati di pagamento."
            : "Collega il tuo account Stripe per ricevere i pagamenti dalle prenotazioni."}
        </p>
        <StripeConnectButton hasAccount={hasStripeAccount} />
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative focus-visible:outline-none"
          aria-label="Modifica foto profilo"
        >
          <Avatar className="h-24 w-24 border-2 border-dashed border-accent/50">
            <AvatarImage src={displayAvatar} />
            <AvatarFallback className="bg-accent/15 text-2xl font-bold text-accent">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-accent shadow">
            <Camera className="h-3.5 w-3.5 text-white" />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-xs text-muted-foreground">Tocca per cambiare foto</p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="flex items-center gap-2 text-sm font-medium text-primary">
          <User className="h-4 w-4 text-accent" />
          Nome completo
        </label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Il tuo nome"
        />
      </div>

      {/* Email (read-only) */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-sm font-medium text-primary">
          <Mail className="h-4 w-4 text-accent" />
          Email
        </label>
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          {email}
        </div>
      </div>

      {/* City */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="city" className="flex items-center gap-2 text-sm font-medium text-primary">
          <MapPin className="h-4 w-4 text-accent" />
          Città / zona
        </label>
        <Input
          id="city"
          ref={cityInputRef}
          defaultValue={city}
          placeholder="Roma, Milano..."
          autoComplete="off"
        />
      </div>

      {/* Bio */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium text-primary">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => {
            if (e.target.value.length <= MAX_BIO) setBio(e.target.value);
          }}
          rows={4}
          placeholder="Descrivi la tua esperienza e i tuoi punti di forza..."
          className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <p className="text-right text-xs text-muted-foreground">
          {bio.length} / {MAX_BIO}
        </p>
      </div>

      {/* Type */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Tipo</p>
        <div className="flex gap-2">
          {(["privato", "azienda"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCleanerType(t)}
              className={cn(
                "flex-1 rounded-xl border px-4 py-2 text-sm font-medium capitalize transition-colors",
                cleanerType === t
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Hourly rate */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="hourlyRate" className="flex items-center gap-2 text-sm font-medium text-primary">
          <DollarSign className="h-4 w-4 text-accent" />
          Tariffa oraria (€/ora)
        </label>
        <Input
          id="hourlyRate"
          type="number"
          min="1"
          max="500"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          placeholder="es. 18"
        />
      </div>

      {/* Services */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Servizi offerti</p>
        <div className="flex flex-wrap gap-2">
          {ALL_SERVICES.map((service) => {
            const selected = services.includes(service);
            return (
              <button
                key={service}
                type="button"
                onClick={() => toggleService(service)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                {service}
              </button>
            );
          })}
        </div>
        {services.length === 0 && (
          <p className="text-xs text-error">Seleziona almeno un servizio</p>
        )}
      </div>

      {/* Feedback */}
      {error && (
        <p className="rounded-xl bg-error/10 px-4 py-2 text-sm text-error">{error}</p>
      )}
      {success && (
        <p className="rounded-xl bg-success/10 px-4 py-2 text-sm text-success">
          Profilo aggiornato con successo.
        </p>
      )}

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Salvataggio..." : "Salva modifiche"}
      </Button>

      {/* Sign out */}
      <div className="border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full gap-2 text-error border-error/30 hover:bg-error/5"
        >
          <LogOut className="h-4 w-4" />
          Esci dall&apos;account
        </Button>
      </div>
    </div>
  );
}
