import {
  createContext,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

/**
 * Sur mobile, le titre de la page (porté par `PageHeader`) remonte dans la
 * barre du haut, à côté du burger. Les pages n'écrivent pas directement dans
 * la barre : `PageHeader` déclare son titre ici et `RootLayout` l'affiche.
 */
export interface MobileHeaderInfo {
  title: string;
  count?: number;
  /** Présence d'un retour — le callback lui-même vit dans une ref. */
  hasBack: boolean;
  backLabel?: string;
}

interface MobileHeaderRegistration {
  title: string;
  count?: number;
  onBack?: () => void;
  backLabel?: string;
}

interface MobileHeaderContextValue {
  header: MobileHeaderInfo | null;
  /**
   * Déclare (ou efface avec `null`) le titre courant. Idempotent : un appel
   * avec les mêmes valeurs ne re-rend rien, ce qui permet à `PageHeader`
   * d'appeler à chaque rendu sans boucle (les pages passent des callbacks
   * `onBack` recréés à chaque rendu).
   */
  setHeader: (info: MobileHeaderRegistration | null) => void;
  /** Déclenche le retour déclaré par la page courante. */
  triggerBack: () => void;
  /**
   * Emplacement (à droite de la barre) où `PageHeader` téléporte le menu
   * « ⋯ » de ses actions. Un portal plutôt que des nœuds stockés dans le
   * contexte : les actions restent montées par la page, leurs handlers ne
   * périment jamais.
   */
  actionsTarget: HTMLElement | null;
  setActionsTarget: (el: HTMLElement | null) => void;
}

const MobileHeaderContext = createContext<MobileHeaderContextValue | null>(
  null,
);

export function MobileHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderInfo] = useState<MobileHeaderInfo | null>(null);
  const [actionsTarget, setActionsTarget] = useState<HTMLElement | null>(null);
  // Le callback change d'identité à chaque rendu des pages : il vit dans une
  // ref pour ne jamais provoquer de re-rendu du layout.
  const onBackRef = useRef<(() => void) | undefined>(undefined);

  const setHeader = useCallback((info: MobileHeaderRegistration | null) => {
    onBackRef.current = info?.onBack;
    setHeaderInfo((previous) => {
      const next: MobileHeaderInfo | null = info
        ? {
            title: info.title,
            count: info.count,
            hasBack: Boolean(info.onBack),
            backLabel: info.backLabel,
          }
        : null;
      if (
        previous?.title === next?.title &&
        previous?.count === next?.count &&
        previous?.hasBack === next?.hasBack &&
        previous?.backLabel === next?.backLabel &&
        Boolean(previous) === Boolean(next)
      ) {
        return previous;
      }
      return next;
    });
  }, []);

  const triggerBack = useCallback(() => {
    onBackRef.current?.();
  }, []);

  const value = useMemo(
    () => ({ header, setHeader, triggerBack, actionsTarget, setActionsTarget }),
    [header, setHeader, triggerBack, actionsTarget],
  );

  return <MobileHeaderContext value={value}>{children}</MobileHeaderContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMobileHeader(): MobileHeaderContextValue {
  const context = use(MobileHeaderContext);
  if (!context) {
    throw new Error("useMobileHeader must be used within MobileHeaderProvider");
  }
  return context;
}

/**
 * Variante tolérante pour les composants réutilisés hors du layout (tests,
 * pages publiques) : sans provider, la déclaration est un no-op.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalMobileHeader(): MobileHeaderContextValue | null {
  return use(MobileHeaderContext);
}
