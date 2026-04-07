import { useMutation, useQueryClient } from '@tanstack/react-query';

async function saveInfluencer(username: string): Promise<void> {
  const res = await fetch('/api/save-influencer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

export function useSaveInfluencer() {
  return useMutation({ mutationFn: saveInfluencer });
}

async function unsaveInfluencer(username: string): Promise<void> {
  const res = await fetch('/api/saved-influencers', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

export function useUnsaveInfluencer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unsaveInfluencer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-influencers'] });
    },
  });
}
