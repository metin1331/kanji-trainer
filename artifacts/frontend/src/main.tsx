import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import { initTheme, initColorScheme } from "./theme";
import { I18nProvider } from "./i18n/I18nProvider";
import { ConfirmProvider } from "./components/ConfirmProvider";
import Toaster from "./components/smoothui/toast";
import { AuthProvider } from "./auth/AuthProvider";
import { getApiOrigin } from "./lib/apiOrigin";
import { getSessionToken } from "./lib/sessionToken";
import "./index.css";

initTheme();
initColorScheme();

const apiOrigin = getApiOrigin();
setBaseUrl(apiOrigin || null);
setAuthTokenGetter(() => getSessionToken());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <ConfirmProvider>
          <Toaster>
            <App />
          </Toaster>
        </ConfirmProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>,
);
