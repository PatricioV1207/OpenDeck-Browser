import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { loadAppData } from "../services/tauri/appDataService.ts";
import {
  createErrorAppDataState,
  createReadyAppDataState,
  createSingleFlightLoader,
  initialAppDataState,
  type AppDataState,
} from "./appDataState.ts";

const AppDataContext = createContext<AppDataState | null>(null);
const loadAppDataOnce = createSingleFlightLoader(loadAppData);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppDataState>(initialAppDataState);

  useEffect(() => {
    let active = true;

    loadAppDataOnce().then(
      (response) => {
        if (active) {
          setState(createReadyAppDataState(response));
        }
      },
      (error: unknown) => {
        if (active) {
          setState(createErrorAppDataState(error));
        }
      },
    );

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppDataContext.Provider value={state}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppDataState {
  const context = useContext(AppDataContext);

  if (context === null) {
    throw new Error("useAppData must be used within an AppDataProvider.");
  }

  return context;
}
