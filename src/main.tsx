import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import { applyInitialTheme } from "./ui-kit/theme/theme-storage";
import App from "./App.tsx";
import { LocalizationProvider } from "./localization/LocalizationProvider";

const queryClient = new QueryClient();

applyInitialTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LocalizationProvider><App /></LocalizationProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
