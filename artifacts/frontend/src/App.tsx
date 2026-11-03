import type { ReactNode } from "react";
import { Router, Route, Switch, Redirect, useLocation } from "wouter";
import { useAuth } from "@/auth/AuthProvider";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { isDemoMode } from "@/lib/demoMode";
import { HomePage } from "@/pages/HomePage";
import { WordListPage } from "@/pages/WordListPage";
import { PronunciationPage } from "@/pages/PronunciationPage";
import { MeaningPage } from "@/pages/MeaningPage";
import { LearnedHubPage } from "@/pages/LearnedHubPage";
import { LearnedPage } from "@/pages/LearnedPage";
import { LearnedPronPage } from "@/pages/LearnedPronPage";
import { LearnedMeaningPage } from "@/pages/LearnedMeaningPage";
import { StudyPage } from "@/pages/StudyPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SrsHubPage } from "@/pages/SrsHubPage";
import { SrsStudyPage } from "@/pages/SrsStudyPage";
import { TroubleWordsPage } from "@/pages/TroubleWordsPage";
import { ProgressPage } from "@/pages/ProgressPage";
import { ThemesHubPage } from "@/pages/ThemesHubPage";
import { CategoriesHubPage } from "@/pages/CategoriesHubPage";
import { CategoryDetailPage } from "@/pages/CategoryDetailPage";
import { ThemeDetailPage } from "@/pages/ThemeDetailPage";
import { ThemeQuizEditorPage } from "@/pages/ThemeQuizEditorPage";
import { ThemeQuizStudyPage } from "@/pages/ThemeQuizStudyPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { MojiMoriLevelsPage } from "@/pages/mojimori/MojiMoriLevelsPage";
import { MojiMoriDashboardPage } from "@/pages/mojimori/MojiMoriDashboardPage";
import { MojiMoriSeeAllPage } from "@/pages/mojimori/MojiMoriSeeAllPage";
import { MojiMoriLevelDetailPage } from "@/pages/mojimori/MojiMoriLevelDetailPage";
import { MojiMoriTypeIndexPage } from "@/pages/mojimori/MojiMoriTypeIndexPage";
import { MojiMoriSearchPage } from "@/pages/mojimori/MojiMoriSearchPage";
import { MojiMoriLessonPage, MojiMoriReviewPage, MojiMoriExtraPage } from "@/pages/mojimori/MojiMoriStudyPage";
import { MojiMoriLessonPickerPage } from "@/pages/mojimori/MojiMoriLessonPickerPage";
import { MojiMoriSettingsPage } from "@/pages/mojimori/MojiMoriSettingsPage";
import { MojiMoriSubjectPage } from "@/pages/mojimori/MojiMoriSubjectPage";
import { MojiMoriLayout } from "@/pages/mojimori/MojiMoriLayout";
import { MojiMoriLoading } from "@/pages/mojimori/MojiMoriLoading";
import { MojiRouteBar } from "@/pages/mojimori/MojiRouteBar";
import NotFound from "@/pages/not-found";

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

function isPublicPath(path: string) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}?`));
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [path] = useLocation();
  const demo = isDemoMode();

  if (loading) {
    if (path.startsWith("/mojimori")) {
      const bare = path === "/mojimori/lessons" || path === "/mojimori/reviews";
      return (
        <MojiMoriLayout showHeader={!bare}>
          <MojiMoriLoading />
        </MojiMoriLayout>
      );
    }
    return (
      <div className="bg-app-bg flex min-h-dvh items-center justify-center">
        <LoadingSpinner
          size={36}
          className="text-main-500 dark:text-main-600"
        />
      </div>
    );
  }

  if (!user && !demo && !isPublicPath(path)) {
    return <Redirect to="/login" />;
  }

  if (demo && isPublicPath(path)) {
    return <Redirect to="/" />;
  }

  if (user && (path === "/login" || path === "/register")) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AuthGate>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/mojimori/search" component={MojiMoriSearchPage} />
        <Route path="/mojimori/settings" component={MojiMoriSettingsPage} />
        <Route path="/mojimori/lessons/picker" component={MojiMoriLessonPickerPage} />
        <Route path="/mojimori/lessons" component={MojiMoriLessonPage} />
        <Route path="/mojimori/reviews" component={MojiMoriReviewPage} />
        <Route path="/mojimori/extra" component={MojiMoriExtraPage} />
        <Route path="/mojimori/levels/:n/:type" component={MojiMoriSeeAllPage} />
        <Route path="/mojimori/levels/:n" component={MojiMoriLevelDetailPage} />
        <Route path="/mojimori/levels" component={MojiMoriLevelsPage} />
        <Route path="/mojimori/radicals/:id" component={MojiMoriSubjectPage} />
        <Route path="/mojimori/kanji/:id" component={MojiMoriSubjectPage} />
        <Route path="/mojimori/vocabulary/:id" component={MojiMoriSubjectPage} />
        <Route path="/mojimori/radicals" component={MojiMoriTypeIndexPage} />
        <Route path="/mojimori/kanji" component={MojiMoriTypeIndexPage} />
        <Route path="/mojimori/vocabulary" component={MojiMoriTypeIndexPage} />
        <Route path="/mojimori" component={MojiMoriDashboardPage} />
        <Route path="/" component={HomePage} />
        <Route path="/progress" component={ProgressPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/srs/study" component={SrsStudyPage} />
        <Route path="/srs/trouble" component={TroubleWordsPage} />
        <Route path="/srs" component={SrsHubPage} />
        <Route path="/themes/:id/quiz/edit" component={ThemeQuizEditorPage} />
        <Route path="/themes/:id/quiz" component={ThemeQuizStudyPage} />
        <Route path="/themes/:id" component={ThemeDetailPage} />
        <Route path="/themes" component={ThemesHubPage} />
        <Route path="/categories/:id" component={CategoryDetailPage} />
        <Route path="/categories" component={CategoriesHubPage} />
        <Route path="/words" component={WordListPage} />
        <Route path="/pronunciation" component={PronunciationPage} />
        <Route path="/meaning" component={MeaningPage} />
        <Route path="/learned" component={LearnedHubPage} />
        <Route path="/learned/words" component={LearnedPage} />
        <Route path="/learned/pronunciation" component={LearnedPronPage} />
        <Route path="/learned/meaning" component={LearnedMeaningPage} />
        <Route path="/study" component={StudyPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthGate>
  );
}

function App() {
  return (
    <Router>
      <MojiRouteBar />
      <AppRoutes />
    </Router>
  );
}

export default App;
