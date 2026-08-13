import { useQueryClient } from "@tanstack/react-query";
import {
  useListThemes,
  useGetTheme,
  useDeleteTheme,
  useReplaceThemeWords,
  useAddThemeWords,
  useRemoveThemeWord,
  getListThemesQueryKey,
  getGetThemeQueryKey,
} from "@workspace/api-client-react";
import type {
  ThemeInput,
  ThemeUpdate,
  ThemeQuestionsInput,
  ThemeSummary,
  ThemeDetail,
} from "@workspace/api-client-react";
import { apiFetch } from "@/lib/apiFetch";

function normalizeIconSvg(iconSvg?: string | null): string | null {
  if (iconSvg == null) return null;
  const trimmed = iconSvg.trim();
  return trimmed || null;
}

export type { ThemeSummary, ThemeDetail };

type ThemeInputWithIcon = ThemeInput & { iconSvg?: string | null };
type ThemeUpdateWithIcon = ThemeUpdate & { iconSvg?: string | null };

export function useThemes() {
  const queryClient = useQueryClient();
  const listQuery = useListThemes();

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });

  const deleteMutation = useDeleteTheme({
    mutation: { onSuccess: invalidateList },
  });

  return {
    themes: (listQuery.data ?? []) as ThemeSummary[],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    createTheme: async (data: ThemeInputWithIcon) => {
      const res = await apiFetch("/api/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          wordIds: data.wordIds ?? [],
          iconSvg: normalizeIconSvg(data.iconSvg),
        }),
      });
      if (!res.ok) throw new Error("Failed to create theme");
      const theme = await res.json();
      invalidateList();
      return theme as ThemeDetail;
    },
    updateTheme: async (id: number, data: ThemeUpdateWithIcon) => {
      const res = await apiFetch(`/api/themes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.iconSvg !== undefined
            ? { iconSvg: normalizeIconSvg(data.iconSvg) }
            : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed to update theme");
      const theme = await res.json();
      queryClient.invalidateQueries({ queryKey: getGetThemeQueryKey(id) });
      invalidateList();
      return theme as ThemeDetail;
    },
    deleteTheme: (id: number) => deleteMutation.mutateAsync({ id }),
    isSaving: deleteMutation.isPending,
  };
}

export function useTheme(id: number) {
  const queryClient = useQueryClient();
  const query = useGetTheme(id, {
    query: {
      queryKey: getGetThemeQueryKey(id),
      enabled: Number.isFinite(id) && id > 0,
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetThemeQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });
  };

  const replaceWordsMutation = useReplaceThemeWords({
    mutation: { onSuccess: invalidate },
  });
  const addWordsMutation = useAddThemeWords({
    mutation: { onSuccess: invalidate },
  });
  const removeWordMutation = useRemoveThemeWord({
    mutation: { onSuccess: invalidate },
  });
  const deleteMutation = useDeleteTheme({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });
      },
    },
  });

  return {
    theme: query.data as ThemeDetail | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    updateTheme: async (data: ThemeUpdateWithIcon) => {
      const res = await apiFetch(`/api/themes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.iconSvg !== undefined
            ? { iconSvg: normalizeIconSvg(data.iconSvg) }
            : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed to update theme");
      const theme = await res.json();
      invalidate();
      return theme as ThemeDetail;
    },
    deleteTheme: () => deleteMutation.mutateAsync({ id }),
    replaceThemeWords: (wordIds: number[]) =>
      replaceWordsMutation.mutateAsync({ id, data: { wordIds } }),
    addThemeWords: (wordIds: number[]) =>
      addWordsMutation.mutateAsync({ id, data: { wordIds } }),
    removeThemeWord: (wordId: number) =>
      removeWordMutation.mutateAsync({ id, wordId }),
    saveThemeQuestions: (data: ThemeQuestionsInput) =>
      apiFetch(`/api/themes/${id}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to save questions");
        invalidate();
      }),
    isSaving:
      replaceWordsMutation.isPending ||
      addWordsMutation.isPending ||
      removeWordMutation.isPending,
  };
}
