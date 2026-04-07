/**
 * SodiumProvider — initialize libsodium WASM once at app startup.
 *
 * MUST wrap the entire React tree before any auth or crypto operation.
 * Renders a loading screen while WASM is loading (typically < 200ms on cold start).
 *
 * Usage in App.tsx:
 *   <SodiumProvider>
 *     <BrowserRouter>
 *       <AppRoutes />
 *     </BrowserRouter>
 *   </SodiumProvider>
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import sodium from "libsodium-wrappers";
import { useTranslation } from "react-i18next";

type SodiumState = "loading" | "ready" | "error";

const SodiumContext = createContext<SodiumState>("loading");

export function useSodiumState(): SodiumState {
  return useContext(SodiumContext);
}

interface SodiumProviderProps {
  children: ReactNode;
}

export function SodiumProvider({ children }: SodiumProviderProps) {
  const [state, setState] = useState<SodiumState>("loading");
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    sodium.ready
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">{t("app.sodiumError")}</p>
      </main>
    );
  }

  return <SodiumContext.Provider value={state}>{children}</SodiumContext.Provider>;
}
