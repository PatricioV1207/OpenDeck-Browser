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
  deleteWorkspace as deleteWorkspaceCommand,
  loadAppData,
  renameWorkspace as renameWorkspaceCommand,
  setActiveWorkspace as setActiveWorkspaceCommand,
} from "../services/tauri/appDataService.ts";
import {
  createAppDataMutationQueue,
  executeCreateWorkspace,
  executeDeleteWorkspace,
  executeRenameWorkspace,
  executeSetActiveWorkspace,
  type CreateWorkspaceResult,
  type DeleteWorkspaceResult,
  type RenameWorkspaceResult,
  type SetActiveWorkspaceResult,
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
  renameWorkspace(id: string, name: string): Promise<RenameWorkspaceResult>;
  setActiveWorkspace(id: string): Promise<SetActiveWorkspaceResult>;
  deleteWorkspace(id: string): Promise<DeleteWorkspaceResult>;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppDataState>(initialAppDataState);
  const stateRef = useRef<AppDataState>(initialAppDataState);
  const mutationQueueRef = useRef(createAppDataMutationQueue());

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
      if (stateRef.current.status !== "ready") {
        return {
          ok: false,
          code: "internal",
        };
      }

      return mutationQueueRef.current.enqueue(async () => {
        const outcome = await executeCreateWorkspace(
          stateRef.current,
          name,
          createWorkspaceCommand,
        );

        if (outcome.state !== stateRef.current) {
          commitState(outcome.state);
        }

        return outcome.result;
      });
    },
    [commitState],
  );

  const renameWorkspace = useCallback(
    async (id: string, name: string): Promise<RenameWorkspaceResult> => {
      if (stateRef.current.status !== "ready") {
        return {
          ok: false,
          code: "internal",
        };
      }

      return mutationQueueRef.current.enqueue(async () => {
        const outcome = await executeRenameWorkspace(
          stateRef.current,
          id,
          name,
          renameWorkspaceCommand,
        );

        if (outcome.state !== stateRef.current) {
          commitState(outcome.state);
        }

        return outcome.result;
      });
    },
    [commitState],
  );

  const setActiveWorkspace = useCallback(
    async (id: string): Promise<SetActiveWorkspaceResult> => {
      if (stateRef.current.status !== "ready") {
        return {
          ok: false,
          code: "internal",
        };
      }

      return mutationQueueRef.current.enqueue(async () => {
        const outcome = await executeSetActiveWorkspace(
          stateRef.current,
          id,
          setActiveWorkspaceCommand,
        );

        if (outcome.state !== stateRef.current) {
          commitState(outcome.state);
        }

        return outcome.result;
      });
    },
    [commitState],
  );

  const deleteWorkspace = useCallback(
    async (id: string): Promise<DeleteWorkspaceResult> => {
      if (stateRef.current.status !== "ready") {
        return {
          ok: false,
          code: "internal",
        };
      }

      return mutationQueueRef.current.enqueue(async () => {
        const outcome = await executeDeleteWorkspace(
          stateRef.current,
          id,
          deleteWorkspaceCommand,
        );

        if (outcome.state !== stateRef.current) {
          commitState(outcome.state);
        }

        return outcome.result;
      });
    },
    [commitState],
  );

  const actions = useMemo<AppDataActions>(
    () => ({
      createWorkspace,
      renameWorkspace,
      setActiveWorkspace,
      deleteWorkspace,
    }),
    [createWorkspace, deleteWorkspace, renameWorkspace, setActiveWorkspace],
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
