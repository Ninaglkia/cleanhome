const SUPABASE_STORAGE_PATTERN = /supabase\.co\/storage\/v1\/object\/(public|sign)/;

export function thumbUrl(url: string | null | undefined, w: number): string | undefined {
  if (!url) return undefined;
  if (!SUPABASE_STORAGE_PATTERN.test(url)) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}width=${w}&quality=70`;
}
