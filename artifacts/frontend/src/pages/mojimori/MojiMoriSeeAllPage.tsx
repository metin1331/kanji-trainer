import { ArrowLeft } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import { useMojiMoriSubjects } from "../../hooks/useMojiMori";
import { type MojiMoriObjectType } from "../../lib/mojiMori";
import NotFound from "../not-found";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { SeeAllGrid } from "./SubjectTile";

function typeFromParam(value: string | undefined): MojiMoriObjectType | null {
  if (value === "radicals") return "radical";
  if (value === "kanji") return "kanji";
  if (value === "vocabulary") return "vocabulary";
  return null;
}

export function MojiMoriSeeAllPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/mojimori/levels/:n/:type");
  const level = Number(params?.n);
  const objectType = typeFromParam(params?.type);
  const { data, isLoading } = useMojiMoriSubjects(
    { level, type: objectType ?? undefined },
    Number.isInteger(level) && level > 0 && objectType != null,
  );
  const guru = (data ?? []).filter((item) => item.progress?.passed).length;

  if (!objectType || !Number.isInteger(level)) {
    return <NotFound />;
  }

  return (
    <MojiMoriLayout>
      <div className="glass-panel mb-4 flex items-center justify-between px-3 py-3">
        <button
          type="button"
          onClick={() => navigate(`/mojimori/levels/${level}`)}
          className="flex items-center gap-1 text-sm text-[#555]"
        >
          <ArrowLeft size={16} />
          {t("mojimori.back")}
        </button>
        <span className="text-sm font-semibold">
          {t("mojimori.guruCount", { guru, total: data?.length ?? 0 })}
        </span>
      </div>
      <div className="glass-panel p-4">
        {isLoading ? (
          <MojiMoriLoading />
        ) : (
          <SeeAllGrid subjects={data ?? []} />
        )}
      </div>
    </MojiMoriLayout>
  );
}
