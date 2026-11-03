import { useEffect, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useSearch } from "wouter";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import { useMojiMoriSubjects } from "../../hooks/useMojiMori";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { SubjectTileGrid } from "./SubjectTile";

function readQuery(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("q") ?? "";
}

const SEARCH_TYPE_ORDER: Record<string, number> = {
  radical: 0,
  kanji: 1,
  vocabulary: 2,
};

export function MojiMoriSearchPage() {
  const { t } = useTranslation();
  const search = useSearch();
  const initial = readQuery(search);
  const [draft, setDraft] = useState(initial);
  const [q, setQ] = useState(initial);
  const { data, isLoading } = useMojiMoriSubjects({ q }, q.trim().length > 0);

  useEffect(() => {
    setDraft(initial);
    setQ(initial);
  }, [initial]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    setQ(next);
    const url = next
      ? `/mojimori/search?q=${encodeURIComponent(next)}`
      : "/mojimori/search";
    window.history.replaceState(null, "", url);
  }

  return (
    <MojiMoriLayout>
      <h1 className="mb-4 text-2xl font-bold">{t("mojimori.searchTitle")}</h1>
      <form onSubmit={submit} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#888]"
          />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("mojimori.searchPlaceholder")}
            className="moji-field"
          />
        </div>
        <button
          type="submit"
          className="moji-btn-primary"
        >
          {t("mojimori.searchButton")}
        </button>
      </form>
      {!q.trim() ? (
        <p className="text-sm text-[#888]">{t("mojimori.searchHint")}</p>
      ) : isLoading ? (
        <MojiMoriLoading />
      ) : (
        <>
          <p className="mb-3 text-sm text-[#666]">
            {t("mojimori.searchCount", { count: data?.length ?? 0, query: q })}
          </p>
          {data?.length ? (
            <SubjectTileGrid
              subjects={[...data].sort(
                (a, b) =>
                  (SEARCH_TYPE_ORDER[a.objectType] ?? 9) -
                  (SEARCH_TYPE_ORDER[b.objectType] ?? 9),
              )}
            />
          ) : (
            <p className="text-sm text-[#888]">{t("mojimori.empty")}</p>
          )}
        </>
      )}
    </MojiMoriLayout>
  );
}
