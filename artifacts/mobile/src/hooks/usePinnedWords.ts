import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { clearPinnedIds, readPinnedIds } from "@/lib/pinnedWords";

function pinnedWordsQueryKey(scope: string) {
  return ["pinned-words", scope] as const;
}

function toggleSet(prev: Set<number>, ids: number[]): Set<number> {
  const next = new Set(prev);
  for (const id of ids) {
    if (next.has(id)) next.delete(id);
    else next.add(id);
  }
  return next;
}

async function fetchPinnedIds(scope: string): Promise<Set<number>> {
  const res = await apiFetch(
    `/api/pinned-words?scope=${encodeURIComponent(scope)}`,
  );
  if (!res.ok) throw new Error("Failed to load pinned words");
  const data = (await res.json()) as { wordIds: number[] };
  const dbIds = Array.isArray(data.wordIds) ? data.wordIds : [];
  const legacy = await readPinnedIds(scope);

  if (legacy.length === 0) return new Set(dbIds);

  if (dbIds.length > 0) {
    await clearPinnedIds(scope);
    return new Set(dbIds);
  }

  const importRes = await apiFetch("/api/pinned-words/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, wordIds: legacy }),
  });
  if (!importRes.ok) throw new Error("Failed to import pinned words");
  await clearPinnedIds(scope);
  const imported = (await importRes.json()) as { wordIds: number[] };
  return new Set(imported.wordIds);
}

export function usePinnedWords(scope: string) {
  const queryClient = useQueryClient();
  const queryKey = pinnedWordsQueryKey(scope);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchPinnedIds(scope),
    staleTime: 5 * 60_000,
  });

  const toggle = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiFetch("/api/pinned-words/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, wordIds: ids }),
      });
      if (!res.ok) throw new Error("Failed to update pinned words");
      const data = (await res.json()) as { wordIds: number[] };
      return new Set(data.wordIds);
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<number>>(queryKey);
      queryClient.setQueryData(
        queryKey,
        toggleSet(previous ?? new Set(), ids),
      );
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (wordIds) => {
      queryClient.setQueryData(queryKey, wordIds);
    },
  });

  const togglePinMany = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) return;
      toggle.mutate(ids);
    },
    [toggle],
  );

  const pinnedIds = query.data ?? new Set<number>();

  return {
    pinnedIds,
    togglePinMany,
    isPinned: (id: number) => pinnedIds.has(id),
    ready: query.isSuccess,
  };
}
