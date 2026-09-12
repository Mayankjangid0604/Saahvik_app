import { useState, useEffect } from 'react';
import api from '@/lib/api';

/**
 * Hook that fetches authenticated images/files by attaching JWT to requests.
 * Returns a blob URL for display. Used for ALL resident photos, ID docs, PDF receipts.
 * NEVER use static img src for authenticated files.
 */
export function useAuthImage(fileKey: string | null | undefined): {
  url: string | null;
  isLoading: boolean;
  error: string | null;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileKey) {
      setUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let revoked = false;
    let blobUrl: string | null = null;
    setIsLoading(true);
    setError(null);

    api
      .get(`/files/${encodeURIComponent(fileKey)}`, {
        responseType: 'blob',
      })
      .then((response) => {
        if (revoked) return;
        const blob = response.data as Blob;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
        setIsLoading(false);
      })
      .catch((err) => {
        if (revoked) return;
        setError(err?.response?.data?.message || 'Failed to load file');
        setIsLoading(false);
      });

    return () => {
      revoked = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileKey]);

  return { url, isLoading, error };
}

/**
 * Fetch an authenticated file and trigger a download.
 */
export async function downloadAuthFile(
  fileKey: string,
  filename: string,
): Promise<void> {
  const response = await api.get(`/files/${encodeURIComponent(fileKey)}`, {
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
