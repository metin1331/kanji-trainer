import { AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "../i18n/I18nProvider";
import { MojiMoriLayout } from "./mojimori/MojiMoriLayout";

export default function NotFound() {
  const { t } = useTranslation();
  const [path] = useLocation();
  const home = path.startsWith("/mojimori") ? "/mojimori" : "/";

  return (
    <MojiMoriLayout>
      <div className="flex min-h-[60vh] items-center justify-center">
        <section className="glass-panel w-full max-w-md p-6">
          <div className="mb-4 flex items-center gap-3">
            <AlertCircle
              className="h-8 w-8 shrink-0"
              color="var(--color-primary-red)"
            />
            <h1 className="text-2xl font-bold text-[var(--color-ink)]">
              {t("common.pageNotFound")}
            </h1>
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            {t("common.pageNotFoundHint")}
          </p>
          <Link href={home} className="moji-btn-primary mt-6">
            {t("common.backHome")}
          </Link>
        </section>
      </div>
    </MojiMoriLayout>
  );
}
