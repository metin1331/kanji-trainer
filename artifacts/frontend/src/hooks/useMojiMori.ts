import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiOrigin";
import type {
  MojiMoriDashboard,
  MojiMoriLevelCount,
  MojiMoriObjectType,
  MojiMoriSubjectDetail,
  MojiMoriSubjectSummary,
} from "../lib/mojiMori";

export type MojiMoriListParams = {
  type?: MojiMoriObjectType | string;
  level?: number;
  levelMin?: number;
  levelMax?: number;
  q?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : res.statusText;
    throw new Error(msg || "Request failed");
  }
  return data as T;
}

export function mojiMoriDashboardQuery() {
  return {
    queryKey: ["mojimori", "dashboard"] as const,
    queryFn: async (): Promise<MojiMoriDashboard> => {
      const res = await apiFetch("/api/mojimori/dashboard");
      return parseJson<MojiMoriDashboard>(res);
    },
  };
}

export function useMojiMoriDashboard() {
  return useQuery(mojiMoriDashboardQuery());
}

export function mojiMoriLevelsQuery() {
  return {
    queryKey: ["mojimori", "levels"] as const,
    queryFn: async (): Promise<MojiMoriLevelCount[]> => {
      const res = await apiFetch("/api/mojimori/levels");
      const data = await parseJson<{ levels: MojiMoriLevelCount[] }>(res);
      return data.levels;
    },
  };
}

export function useMojiMoriLevels() {
  return useQuery(mojiMoriLevelsQuery());
}

export function mojiMoriSubjectsQuery(params: MojiMoriListParams) {
  return {
    queryKey: ["mojimori", "subjects", params] as const,
    queryFn: async (): Promise<MojiMoriSubjectSummary[]> => {
      const search = new URLSearchParams();
      if (params.type) search.set("type", params.type);
      if (params.level) search.set("level", String(params.level));
      if (params.levelMin) search.set("levelMin", String(params.levelMin));
      if (params.levelMax) search.set("levelMax", String(params.levelMax));
      if (params.q) search.set("q", params.q);
      const qs = search.toString();
      const res = await apiFetch(
        `/api/mojimori/subjects${qs ? `?${qs}` : ""}`,
      );
      const data = await parseJson<{ subjects: MojiMoriSubjectSummary[] }>(
        res,
      );
      return data.subjects;
    },
  };
}

export function useMojiMoriSubjects(params: MojiMoriListParams, enabled = true) {
  return useQuery({
    ...mojiMoriSubjectsQuery(params),
    enabled,
  });
}

export function mojiMoriSubjectQuery(id: number) {
  return {
    queryKey: ["mojimori", "subject", id] as const,
    queryFn: async (): Promise<MojiMoriSubjectDetail> => {
      const res = await apiFetch(`/api/mojimori/subjects/${id}`);
      return parseJson<MojiMoriSubjectDetail>(res);
    },
  };
}

export function useMojiMoriSubject(id: number | null) {
  return useQuery({
    ...mojiMoriSubjectQuery(id ?? 0),
    enabled: id != null && id > 0,
  });
}

export function mojiMoriSubjectByKeyQuery(objectType: string, key: string) {
  return {
    queryKey: ["mojimori", "subject", objectType, key] as const,
    retry: false as const,
    queryFn: async (): Promise<MojiMoriSubjectDetail> => {
      const params = new URLSearchParams({ type: objectType });
      const res = await apiFetch(
        `/api/mojimori/subjects/${encodeURIComponent(key)}?${params}`,
      );
      return parseJson<MojiMoriSubjectDetail>(res);
    },
  };
}

export function useMojiMoriSubjectByKey(objectType: string | null, key: string) {
  return useQuery({
    ...mojiMoriSubjectByKeyQuery(objectType ?? "", key),
    enabled: Boolean(objectType && key),
  });
}

export function useSetMojiMoriStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, srsStage }: { id: number; srsStage: number }) => {
      const res = await apiFetch(`/api/mojimori/subjects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srsStage }),
      });
      return parseJson<MojiMoriSubjectSummary>(res);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["mojimori"] });
      queryClient.invalidateQueries({
        queryKey: ["mojimori", "subject", vars.id],
      });
    },
  });
}

export type PromptCheck = {
  correct: boolean;
  shake: boolean;
  wantedType: string | null;
  multipleMeanings: boolean;
  multipleReadings: boolean;
  lenient: boolean;
  exception: "kanjiReading" | "unusualSpelling" | null;
  homophone?: boolean;
};

export type StudyGrade = {
  meaningCorrect: boolean | null;
  readingCorrect: boolean | null;
  shake: boolean;
  wantedType: string | null;
  passed: boolean;
  srsStage: number;
  level: number;
  leveledUp: boolean;
};

export function mojiMoriLessonsQuery(ids?: number[]) {
  const key = ids && ids.length > 0 ? ids.join(",") : "";
  return {
    queryKey: ["mojimori", "lessons", key] as const,
    queryFn: async () => {
      const res = await apiFetch(
        key ? `/api/mojimori/study/lessons?ids=${key}` : "/api/mojimori/study/lessons",
      );
      return parseJson<{
        available: number;
        dailyRemaining: number | null;
        batchSize: number;
        items: import("../lib/mojiMori").MojiMoriStudyCard[];
      }>(res);
    },
  };
}

export function useMojiMoriLessons(ids?: number[]) {
  return useQuery(mojiMoriLessonsQuery(ids));
}

export function mojiMoriLessonPickerQuery() {
  return {
    queryKey: ["mojimori", "lesson-picker"] as const,
    queryFn: async () => {
      const res = await apiFetch("/api/mojimori/study/lessons/picker");
      return parseJson<import("../lib/mojiMori").MojiMoriLessonPicker>(res);
    },
  };
}

export function useMojiMoriLessonPicker() {
  return useQuery(mojiMoriLessonPickerQuery());
}

export function mojiMoriReviewsQuery() {
  return {
    queryKey: ["mojimori", "reviews"] as const,
    queryFn: async () => {
      const res = await apiFetch("/api/mojimori/study/reviews");
      return parseJson<{
        due: number;
        apprenticeDue: number;
        items: import("../lib/mojiMori").MojiMoriStudyCard[];
      }>(res);
    },
  };
}

export function useMojiMoriReviews(enabled = true) {
  return useQuery({
    ...mojiMoriReviewsQuery(),
    enabled,
  });
}

export function mojiMoriExtraQuery(mode: string) {
  return {
    queryKey: ["mojimori", "extra", mode] as const,
    queryFn: async () => {
      const res = await apiFetch(`/api/mojimori/study/extra?mode=${mode}`);
      return parseJson<{ items: import("../lib/mojiMori").MojiMoriStudyCard[] }>(res);
    },
  };
}

export function useMojiMoriExtra(mode: string, enabled = true) {
  return useQuery({
    ...mojiMoriExtraQuery(mode),
    enabled:
      enabled &&
      (mode === "recent-lessons" || mode === "recent-mistakes" || mode === "cooked"),
  });
}

export function useCheckMojiMori() {
  return useMutation({
    mutationFn: async (body: {
      subjectId: number;
      prompt: "meaning" | "reading" | "word";
      answer: string;
      method?: "meaning" | "kanji";
    }) => {
      const res = await apiFetch("/api/mojimori/study/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return parseJson<PromptCheck>(res);
    },
  });
}

export type StudyBatchItem = {
  subjectId: number;
  meaning?: string;
  reading?: string;
  word?: string;
  expectedStage?: number;
};

export function useStudyFlush(kind: "lesson" | "review" | "extra") {
  const queryClient = useQueryClient();
  const pending = useRef<StudyBatchItem[]>([]);
  const flushing = useRef<Promise<void> | null>(null);

  const flush = useCallback(async () => {
    while (pending.current.length > 0 || flushing.current) {
      if (flushing.current) {
        await flushing.current;
        continue;
      }
      const items = pending.current.splice(0);
      if (items.length === 0) return;
      const run = (async () => {
        let applied = 0;
        let failed: Error | null = null;
        try {
          const res = await apiFetch("/api/mojimori/study/grade-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, items }),
            keepalive: true,
          });
          const body = await parseJson<{ results: unknown[]; error?: string }>(res);
          applied = body.results?.length ?? items.length;
          if (body.error) failed = new Error(body.error);
        } catch (err) {
          failed = err instanceof Error ? err : new Error("Could not save");
        }
        if (failed) {
          pending.current = [...items.slice(applied), ...pending.current];
          throw failed;
        }
        await queryClient.invalidateQueries({ queryKey: ["mojimori"] });
      })();
      flushing.current = run.finally(() => {
        flushing.current = null;
      });
      await flushing.current;
    }
  }, [kind, queryClient]);

  useEffect(() => {
    const save = () => {
      void flush();
    };
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      void flush();
    };
  }, [flush]);

  return useMemo(
    () => ({
      queue(item: StudyBatchItem) {
        pending.current.push(item);
      },
      flush,
    }),
    [flush],
  );
}

export function useGradeMojiMori() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      kind: "lesson" | "review" | "extra";
      subjectId: number;
      meaning?: string;
      reading?: string;
      word?: string;
    }) => {
      const res = await apiFetch("/api/mojimori/study/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return parseJson<StudyGrade>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mojimori"] });
    },
  });
}

export type MojiMoriSettings = {
  lessonBatchSize: number;
  dailyLessonCap: number;
  interleaveLessons: boolean;
  reviewOrder: string;
  showSrsIndicator: boolean;
  preferredVoice: string;
  lessonsAutoplay: boolean;
  reviewsAutoplay: boolean;
  extraStudyAutoplay: boolean;
  itemCount: number;
};

export function mojiMoriSettingsQuery() {
  return {
    queryKey: ["mojimori", "settings"] as const,
    queryFn: async () => {
      const res = await apiFetch("/api/mojimori/study/settings");
      return parseJson<MojiMoriSettings>(res);
    },
  };
}

export function useMojiMoriStudySettings(enabled = true) {
  return useQuery({
    ...mojiMoriSettingsQuery(),
    enabled,
  });
}

export function useMojiMoriSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<MojiMoriSettings>) => {
      const res = await apiFetch("/api/mojimori/study/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return parseJson<MojiMoriSettings>(res);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["mojimori", "settings"] });
      const previous = queryClient.getQueryData<MojiMoriSettings>(["mojimori", "settings"]);
      if (previous) {
        queryClient.setQueryData<MojiMoriSettings>(["mojimori", "settings"], { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["mojimori", "settings"], context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["mojimori", "settings"], data);
      queryClient.invalidateQueries({ queryKey: ["mojimori", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["mojimori", "lesson-picker"] });
      queryClient.invalidateQueries({ queryKey: ["mojimori", "lessons"] });
    },
  });
}

export function useMojiMoriNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { id: number; meaningNote: string; readingNote: string }) => {
      const res = await apiFetch(`/api/mojimori/subjects/${body.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return parseJson(res);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["mojimori", "subject"] });
    },
  });
}

export function useUnburnMojiMori() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/mojimori/subjects/${id}/unburn`, { method: "POST" });
      return parseJson(res);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mojimori"] }),
  });
}
