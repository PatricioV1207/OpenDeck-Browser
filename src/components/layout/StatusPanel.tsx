import { useAppData } from "../../state/AppDataProvider";
import { getAppDataStatusText } from "../../state/appDataState";

export function StatusPanel() {
  const appData = useAppData();
  const statusText = getAppDataStatusText(appData);

  return (
    <footer
      className="status-panel"
      aria-label="Application status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="status-panel__item">
        <span className="status-panel__indicator" aria-hidden="true" />
        {statusText.primary}
      </span>
      {statusText.notice !== null && (
        <>
          <span className="status-panel__divider" aria-hidden="true" />
          <span className="status-panel__item">{statusText.notice}</span>
        </>
      )}
    </footer>
  );
}
