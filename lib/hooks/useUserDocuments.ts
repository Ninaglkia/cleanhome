import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchUserDocuments,
  deleteUserDocument,
  uploadUserDocument,
  type UserDocument,
  type DocumentKind,
} from "../api";

export type { UserDocument, DocumentKind };

export function useUserDocuments(userId: string | null | undefined) {
  const [data, setData] = useState<UserDocument[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetch = useCallback(async () => {
    if (!userId) {
      setData([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const docs = await fetchUserDocuments(userId);
      if (isMountedRef.current) setData(docs);
    } catch (e) {
      if (isMountedRef.current) {
        setError(e instanceof Error ? e : new Error("Impossibile caricare i documenti"));
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [userId]);

  const upload = useCallback(
    async (
      localUri: string,
      mimeType: string,
      fileName: string,
      kind: DocumentKind,
      onProgress?: (percent: number) => void
    ): Promise<UserDocument> => {
      if (!userId) throw new Error("Utente non autenticato");
      const doc = await uploadUserDocument(
        userId,
        localUri,
        mimeType,
        fileName,
        kind,
        onProgress
      );
      setData((prev) => (prev ? [doc, ...prev] : [doc]));
      return doc;
    },
    [userId]
  );

  const remove = useCallback(async (documentId: string) => {
    if (!userId) throw new Error("Utente non autenticato");
    // Optimistic
    setData((prev) => (prev ? prev.filter((d) => d.id !== documentId) : prev));
    try {
      await deleteUserDocument(documentId, userId);
    } catch (e) {
      // Revert on failure
      if (isMountedRef.current) fetch();
      throw e;
    }
  }, [fetch, userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch, upload, remove };
}
