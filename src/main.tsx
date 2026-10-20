import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { shouldRetry } from "./lib/api";
import { applyTheme, readThemePreference, resolveTheme, systemPrefersDark } from "./lib/theme";
import "./index.css";

// Apply the stored theme before the first render to avoid a light/dark flash (CSP forbids inline scripts).
applyTheme(resolveTheme(readThemePreference(), systemPrefersDark()));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: shouldRetry } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
