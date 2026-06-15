import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createWorkspace as createWorkspaceCommand,
  loadAppData,
} from "../services/tauri/appDataService.ts";
import {
  executeCreateWorkspace,
  type CreateWorkspaceResult,
} from "./appDataActions.ts";
import {
  createErrorAppDataState,
  createReadyAppDataState,
  createSingleFlightLoader,
  initialAppDataState,
  type AppDataState,
} from "./appDataState.ts";

const AppDataContext = createContext<AppDataState | null>(null);
const AppDataActionsContext = createContext<AppDataActions | null>(null);
const loadAppDataOnce = createSingleFlightLoader(loadAppData);

export interface AppDataActions {
  createWorkspace(name: string): Promise<CreateWorkspaceResult>;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppDataState>(initialAppDataState);
  const stateRef = useRef<AppDataState>(initialAppDataState);
  const createWorkspaceInFlightRef = useRef(false);

  const commitState = useCallback((nextState: AppDataState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  useEffect(() => {
    let active = true;

    loadAppDataOnce().then(
      (response) => {
        if (active) {
          commitState(createReadyAppDataState(response));
        }
      },
      (error: unknown) => {
        if (active) {
          commitState(createErrorAppDataState(error));
        }
      },
    );

    return () => {
      active = false;
    };
  }, [commitState]);

  const createWorkspace = useCallback(
    async (name: string): Promise<CreateWorkspaceResult> => {
      if (
        stateRef.current.status !== "ready" ||
        createWorkspaceInFlightRef.current
      ) {
        return {
          ok: false,
          code: "internal",
        };
      }

      createWorkspaceInFlightRef.current = true;

      try {
        const outcome = await executeCreateWorkspace(
          stateRef.current,
          name,
          createWorkspaceCommand,
        );

        if (outcome.state !== stateRef.current) {
          commitState(outcome.state);
        }

        return outcome.result;
      } finally {
        createWorkspaceInFlightRef.current = false;
      }
    },
    [commitState],
  );

  const actions = useMemo<AppDataActions>(
    () => ({
      createWorkspace,
    }),
    [createWorkspace],
  );

  return (
    <AppDataActionsContext.Provider value={actions}>
      <AppDataContext.Provider value={state}>
        {children}
      </AppDataContext.Provider>
    </AppDataActionsContext.Provider>
  );
}

export function useAppData(): AppDataState {
  const context = useContext(AppDataContext);

  if (context === null) {
    throw new Error("useAppData must be used within an AppDataProvider.");
  }

  return context;
}

export function useAppDataActions(): AppDataActions {
  const context = useContext(AppDataActionsContext);

  if (context === null) {
    throw new Error(
      "useAppDataActions must be used within an AppDataProvider.",
    );
  }

  return context;
}
