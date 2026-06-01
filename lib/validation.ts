/**
 * Pure input-validation helpers (no UI). Extracted from the auth screens so the
 * registration/login rules can be unit-tested independently of React.
 */

// RFC 5322 simplified — good enough to catch typos client-side.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationError {
  valid: false;
  title: string;
  message: string;
}
export type ValidationResult = { valid: true } | ValidationError;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim().toLowerCase());
}

/**
 * Validate the sign-up form. Returns the FIRST failure (title + Italian message)
 * or { valid: true }. Mirrors the rules used by app/(auth)/register.tsx.
 */
export function validateRegistration(input: {
  fullName: string;
  email: string;
  password: string;
}): ValidationResult {
  const trimmedName = input.fullName.trim();
  const trimmedEmail = input.email.trim().toLowerCase();

  if (trimmedName.length < 2) {
    return {
      valid: false,
      title: "Errore",
      message: "Inserisci il tuo nome completo (min. 2 caratteri)",
    };
  }
  if (!EMAIL_RE.test(trimmedEmail)) {
    return {
      valid: false,
      title: "Email non valida",
      message: "Controlla l'indirizzo email inserito",
    };
  }
  if (input.password.length < 8) {
    return {
      valid: false,
      title: "Password troppo corta",
      message: "Usa almeno 8 caratteri per proteggere il tuo account",
    };
  }
  // Require at least one letter and one digit.
  if (!/[a-zA-Z]/.test(input.password) || !/\d/.test(input.password)) {
    return {
      valid: false,
      title: "Password debole",
      message: "La password deve contenere almeno una lettera e un numero",
    };
  }
  return { valid: true };
}
