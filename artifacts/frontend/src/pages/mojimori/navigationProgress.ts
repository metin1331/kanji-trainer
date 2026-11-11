import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { MOJI_MORI_LEVEL_BANDS } from "../../lib/mojiMori";
import {
  mojiMoriDashboardQuery,
  mojiMoriExtraQuery,
  mojiMoriLessonPickerQuery,
  mojiMoriLessonsQuery,
  mojiMoriLevelsQuery,
  mojiMoriReviewsQuery,
  mojiMoriReviewResumeQuery,
  mojiMoriSettingsQuery,
  mojiMoriSubjectByKeyQuery,
  mojiMoriSubjectQuery,
  mojiMoriSubjectsQuery,
} from "../../hooks/useMojiMori";

type Snap = { visible: boolean; value: number };

const listeners = new Set<(snap: Snap) => void>();
let snap: Snap = { visible: false, value: 0 };
let depth = 0;
let creep: number | null = null;
let hide: number | null = null;
let installed = false;
let applying = false;
let latest = 0;

function publish(next: Snap) {
  snap = next;
  for (const listener of listeners) listener(snap);
}

export function progressSnapshot() {
  return snap;
}

export function subscribeProgress(listener: (snap: Snap) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startRouteProgress() {
  depth += 1;
  if (hide != null) {
    window.clearTimeout(hide);
    hide = null;
  }
  if (!snap.visible || snap.value === 0) {
    publish({ visible: true, value: 8 });
  }
  if (creep == null) {
    creep = window.setInterval(() => {
      if (depth < 1) return;
      publish({ visible: true, value: snap.value + (92 - snap.value) * 0.12 });
    }, 180);
  }
}

let fullWaiter: (() => void) | null = null;
let finishGeneration = 0;

export function markRouteProgressFull() {
  fullWaiter?.();
}

function finishRouteProgress() {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return Promise.resolve();
  if (creep != null) {
    window.clearInterval(creep);
    creep = null;
  }
  if (hide != null) {
    window.clearTimeout(hide);
    hide = null;
  }
  const generation = ++finishGeneration;
  publish({ visible: true, value: 100 });
  return new Promise<void>((resolve) => {
    let settled = false;
    let hold: number | null = null;
    let fallback: number | null = null;
    const finish = () => {
      if (settled || generation !== finishGeneration) return;
      settled = true;
      if (hold != null) window.clearTimeout(hold);
      if (fallback != null) window.clearTimeout(fallback);
      if (fullWaiter === arrive) fullWaiter = null;
      resolve();
    };
    const arrive = () => {
      if (generation !== finishGeneration || hold != null) return;
      hold = window.setTimeout(finish, 280);
    };
    fullWaiter = arrive;
    fallback = window.setTimeout(finish, 900);
  });
}

export function stopRouteProgress() {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return;
  if (creep != null) {
    window.clearInterval(creep);
    creep = null;
  }
  publish({ visible: true, value: 100 });
  hide = window.setTimeout(() => {
    hide = null;
    if (depth === 0) publish({ visible: false, value: 0 });
  }, 320);
}

function isFresh(client: QueryClient, queryKey: QueryKey) {
  const state = client.getQueryState(queryKey);
  if (!state || state.status !== "success" || state.fetchStatus === "fetching") {
    return false;
  }
  return Date.now() - state.dataUpdatedAt < 30_000;
}

function decodeKey(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function lessonIds(search: URLSearchParams) {
  const raw = search.get("ids");
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0);
  return ids.length > 0 ? ids.slice(0, 100) : undefined;
}

function typeName(segment: string) {
  if (segment === "radicals") return "radical";
  if (segment === "kanji") return "kanji";
  if (segment === "vocabulary") return "vocabulary";
  return null;
}

function bandFor(search: URLSearchParams) {
  const key = search.get("band");
  const index = MOJI_MORI_LEVEL_BANDS.findIndex((item) => item.key === key);
  return MOJI_MORI_LEVEL_BANDS[Math.max(0, index)] ?? MOJI_MORI_LEVEL_BANDS[0];
}

function destination(url: string | URL | null | undefined) {
  if (url == null) return null;
  let next: URL;
  try {
    next = new URL(String(url), window.location.href);
  } catch {
    return null;
  }
  if (next.origin !== window.location.origin) return null;
  if (!next.pathname.startsWith("/mojimori")) return null;
  const dest = `${next.pathname}${next.search}`;
  const current = `${window.location.pathname}${window.location.search}`;
  return dest === current ? null : dest;
}

async function warm(dest: string, client: QueryClient) {
  const url = new URL(dest, window.location.origin);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const search = url.searchParams;

  if (path === "/mojimori") {
    await client.prefetchQuery(mojiMoriDashboardQuery());
    return;
  }
  if (path === "/mojimori/levels") {
    await client.prefetchQuery(mojiMoriLevelsQuery());
    return;
  }
  const seeAll = path.match(/^\/mojimori\/levels\/(\d+)\/(radicals|kanji|vocabulary)$/);
  if (seeAll) {
    const type = typeName(seeAll[2] ?? "");
    const level = Number(seeAll[1]);
    if (type) await client.prefetchQuery(mojiMoriSubjectsQuery({ level, type }));
    return;
  }
  const levelPage = path.match(/^\/mojimori\/levels\/(\d+)$/);
  if (levelPage) {
    await client.prefetchQuery(mojiMoriSubjectsQuery({ level: Number(levelPage[1]) }));
    return;
  }
  const index = path.match(/^\/mojimori\/(radicals|kanji|vocabulary)$/);
  if (index) {
    const type = typeName(index[1] ?? "");
    const band = bandFor(search);
    if (type) {
      await client.prefetchQuery(
        mojiMoriSubjectsQuery({ type, levelMin: band.start, levelMax: band.end }),
      );
    }
    return;
  }
  const subject = path.match(/^\/mojimori\/(radicals|kanji|vocabulary)\/([^/]+)$/);
  if (subject) {
    const type = typeName(subject[1] ?? "");
    const key = decodeKey(subject[2] ?? "");
    if (!type || !key) return;
    const query = mojiMoriSubjectByKeyQuery(type, key);
    const detail = await client.fetchQuery(query);
    await client.prefetchQuery(
      mojiMoriSubjectsQuery({ type: detail.objectType, level: detail.level }),
    );
    return;
  }
  if (path === "/mojimori/search") {
    const q = search.get("q") ?? "";
    if (q.trim()) await client.prefetchQuery(mojiMoriSubjectsQuery({ q }));
    return;
  }
  if (path === "/mojimori/settings") {
    await client.prefetchQuery(mojiMoriSettingsQuery());
    return;
  }
  if (path === "/mojimori/lessons/picker") {
    await client.prefetchQuery(mojiMoriLessonPickerQuery());
    return;
  }
  if (path === "/mojimori/lessons") {
    const lessons = await client.fetchQuery(mojiMoriLessonsQuery(lessonIds(search)));
    const first = lessons.items[0];
    if (first) await client.prefetchQuery(mojiMoriSubjectQuery(first.id));
    return;
  }
  if (path === "/mojimori/reviews") {
    await Promise.all([
      client.prefetchQuery(mojiMoriReviewsQuery()),
      client.prefetchQuery(mojiMoriSettingsQuery()),
      client.prefetchQuery(mojiMoriReviewResumeQuery()),
    ]);
    return;
  }
  if (path === "/mojimori/extra") {
    const mode = search.get("mode") ?? "recent-lessons";
    if (mode === "recent-lessons" || mode === "recent-mistakes" || mode === "cooked") {
      await client.prefetchQuery(mojiMoriExtraQuery(mode));
    }
  }
}

function ready(dest: string, client: QueryClient) {
  const url = new URL(dest, window.location.origin);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const search = url.searchParams;
  if (path === "/mojimori") return isFresh(client, mojiMoriDashboardQuery().queryKey);
  if (path === "/mojimori/levels") return isFresh(client, mojiMoriLevelsQuery().queryKey);
  const seeAll = path.match(/^\/mojimori\/levels\/(\d+)\/(radicals|kanji|vocabulary)$/);
  if (seeAll) {
    const type = typeName(seeAll[2] ?? "");
    return Boolean(
      type && isFresh(client, mojiMoriSubjectsQuery({ level: Number(seeAll[1]), type }).queryKey),
    );
  }
  const levelPage = path.match(/^\/mojimori\/levels\/(\d+)$/);
  if (levelPage) {
    return isFresh(client, mojiMoriSubjectsQuery({ level: Number(levelPage[1]) }).queryKey);
  }
  const index = path.match(/^\/mojimori\/(radicals|kanji|vocabulary)$/);
  if (index) {
    const type = typeName(index[1] ?? "");
    const band = bandFor(search);
    return Boolean(
      type &&
        isFresh(
          client,
          mojiMoriSubjectsQuery({ type, levelMin: band.start, levelMax: band.end }).queryKey,
        ),
    );
  }
  const subject = path.match(/^\/mojimori\/(radicals|kanji|vocabulary)\/([^/]+)$/);
  if (subject) {
    const type = typeName(subject[1] ?? "");
    const key = decodeKey(subject[2] ?? "");
    if (!type || !key) return true;
    const query = mojiMoriSubjectByKeyQuery(type, key);
    if (!isFresh(client, query.queryKey)) return false;
    const detail = client.getQueryData<{ objectType: string; level: number }>(query.queryKey);
    return Boolean(
      detail &&
        isFresh(
          client,
          mojiMoriSubjectsQuery({ type: detail.objectType, level: detail.level }).queryKey,
        ),
    );
  }
  if (path === "/mojimori/search") {
    const q = search.get("q") ?? "";
    return !q.trim() || isFresh(client, mojiMoriSubjectsQuery({ q }).queryKey);
  }
  if (path === "/mojimori/settings") return isFresh(client, mojiMoriSettingsQuery().queryKey);
  if (path === "/mojimori/lessons/picker") {
    return isFresh(client, mojiMoriLessonPickerQuery().queryKey);
  }
  if (path === "/mojimori/lessons") {
    const query = mojiMoriLessonsQuery(lessonIds(search));
    if (!isFresh(client, query.queryKey)) return false;
    const lessons = client.getQueryData<{ items: { id: number }[] }>(query.queryKey);
    const first = lessons?.items[0];
    return !first || isFresh(client, mojiMoriSubjectQuery(first.id).queryKey);
  }
  if (path === "/mojimori/reviews") {
    return (
      isFresh(client, mojiMoriReviewsQuery().queryKey) &&
      isFresh(client, mojiMoriSettingsQuery().queryKey) &&
      isFresh(client, mojiMoriReviewResumeQuery().queryKey)
    );
  }
  if (path === "/mojimori/extra") {
    const mode = search.get("mode") ?? "recent-lessons";
    if (mode !== "recent-lessons" && mode !== "recent-mistakes" && mode !== "cooked") return true;
    return isFresh(client, mojiMoriExtraQuery(mode).queryKey);
  }
  return true;
}

export function installMojiMoriNavigation(client: QueryClient) {
  if (installed) return;
  installed = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const write = history[method].bind(history);
    history[method] = ((data: unknown, unused: string, url?: string | URL | null) => {
      const dest = destination(url);
      if (!dest || applying || ready(dest, client)) {
        write(data, unused, url);
        return;
      }
      const token = ++latest;
      startRouteProgress();
      warm(dest, client)
        .catch(() => undefined)
        .finally(() => {
          void finishRouteProgress().then(() => {
            if (token !== latest) return;
            applying = true;
            try {
              write(data, unused, url);
            } finally {
              applying = false;
            }
            publish({ visible: false, value: 0 });
          });
        });
    }) as History["pushState"];
  }
}
