"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, LogOut, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClientProfileFormProps {
  userId: string;
  initialName: string;
  initialAvatarUrl: string | null;
  email: string;
}

export function ClientProfileForm({
  userId,
  initialName,
  initialAvatarUrl,
  email,
}: ClientProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAvatarBlob(file);
      setAvatarPreview(URL.createObjectURL(file));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!fullName.trim()) {
      setError("Il nome non può essere vuoto.");
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
  }, [fullName, avatarBlob, avatarUrl, userId, router]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const displayAvatar = avatarPreview ?? avatarUrl ?? undefined;
  const initials = fullName.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex flex-col gap-6">
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

      {/* Divider */}
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
