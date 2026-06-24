import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useAppDataActions } from "../../state/AppDataProvider";
import type { AppSettingsDto, ColorMode } from "../../types/appData";
import {
  createSettingsDraft,
  createSettingsPatch,
  getUpdateSettingsFailureMessage,
  getUpdateSettingsSuccessMessage,
  type SettingsDraft,
} from "./settingsFormHelpers";

const COLOR_MODE_DESCRIPTION_ID = "settings-color-mode-description";
const SIDEBAR_DESCRIPTION_ID = "settings-sidebar-description";
const STATUS_PANEL_DESCRIPTION_ID = "settings-status-panel-description";

const COLOR_MODE_OPTIONS: readonly {
  value: ColorMode;
  label: string;
  description: string;
}[] = [
  {
    value: "system",
    label: "System",
    description: "Follow the operating-system appearance preference later.",
  },
  {
    value: "light",
    label: "Light",
    description: "Store light appearance as the preferred color mode.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Store dark appearance as the preferred color mode.",
  },
];

interface SettingsFeedback {
  readonly tone: "success" | "error";
  readonly text: string;
}

export function SettingsForm({ settings }: { settings: AppSettingsDto }) {
  const { updateSettings } = useAppDataActions();
  const [draft, setDraft] = useState<SettingsDraft>(() =>
    createSettingsDraft(settings),
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);
  const [focusFeedbackAfterSubmit, setFocusFeedbackAfterSubmit] =
    useState(false);
  const submissionInFlightRef = useRef(false);
  const feedbackRef = useRef<HTMLParagraphElement | null>(null);
  const patch = createSettingsPatch(settings, draft);

  useEffect(() => {
    setDraft(createSettingsDraft(settings));
  }, [
    settings.colorMode,
    settings.sidebarCollapsed,
    settings.statusPanelVisible,
  ]);

  useEffect(() => {
    if (!focusFeedbackAfterSubmit || submitting || feedback === null) {
      return;
    }

    feedbackRef.current?.focus();
    setFocusFeedbackAfterSubmit(false);
  }, [feedback, focusFeedbackAfterSubmit, submitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInFlightRef.current || patch === null) {
      return;
    }

    submissionInFlightRef.current = true;
    setSubmitting(true);
    setFeedback(null);

    try {
      const result = await updateSettings(patch);

      setFeedback(
        result.ok
          ? {
              tone: "success",
              text: getUpdateSettingsSuccessMessage(result.outcome),
            }
          : {
              tone: "error",
              text: getUpdateSettingsFailureMessage(result.code),
            },
      );
    } catch {
      setFeedback({
        tone: "error",
        text: getUpdateSettingsFailureMessage("internal"),
      });
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
      setFocusFeedbackAfterSubmit(true);
    }
  }

  function updateDraft(nextDraft: SettingsDraft) {
    setDraft(nextDraft);
    setFeedback(null);
  }

  function discardChanges() {
    setDraft(createSettingsDraft(settings));
    setFeedback(null);
  }

  return (
    <form
      className="settings-form"
      aria-busy={submitting}
      onSubmit={handleSubmit}
    >
      <fieldset
        className="settings-form__group"
        aria-describedby={COLOR_MODE_DESCRIPTION_ID}
        disabled={submitting}
      >
        <legend>Color mode</legend>
        <p id={COLOR_MODE_DESCRIPTION_ID} className="settings-form__help">
          Choose the stored appearance preference. This build does not apply
          the selected color mode yet.
        </p>
        <div className="settings-form__radio-list">
          {COLOR_MODE_OPTIONS.map((option) => (
            <label className="settings-form__radio" key={option.value}>
              <input
                type="radio"
                name="colorMode"
                value={option.value}
                checked={draft.colorMode === option.value}
                onChange={() =>
                  updateDraft({ ...draft, colorMode: option.value })
                }
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-form__group" disabled={submitting}>
        <legend>Application layout</legend>
        <label className="settings-form__checkbox">
          <input
            type="checkbox"
            checked={draft.sidebarCollapsed}
            aria-describedby={SIDEBAR_DESCRIPTION_ID}
            onChange={(event) =>
              updateDraft({
                ...draft,
                sidebarCollapsed: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Use compact sidebar</strong>
            <small id={SIDEBAR_DESCRIPTION_ID}>
              Store whether the sidebar should use its compact presentation.
            </small>
          </span>
        </label>
        <label className="settings-form__checkbox">
          <input
            type="checkbox"
            checked={draft.statusPanelVisible}
            aria-describedby={STATUS_PANEL_DESCRIPTION_ID}
            onChange={(event) =>
              updateDraft({
                ...draft,
                statusPanelVisible: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Show status panel</strong>
            <small id={STATUS_PANEL_DESCRIPTION_ID}>
              Store whether the bottom application status panel should be
              visible.
            </small>
          </span>
        </label>
      </fieldset>

      <div className="settings-form__actions">
        <button type="submit" disabled={submitting || patch === null}>
          {submitting ? "Saving settings" : "Save settings"}
        </button>
        <button
          type="button"
          disabled={submitting || patch === null}
          onClick={discardChanges}
        >
          Discard changes
        </button>
      </div>

      {feedback !== null && (
        <p
          ref={feedbackRef}
          className={`settings-form__feedback settings-form__feedback--${feedback.tone}`}
          role={feedback.tone === "success" ? "status" : "alert"}
          aria-live={feedback.tone === "success" ? "polite" : undefined}
          tabIndex={-1}
        >
          {feedback.text}
        </p>
      )}
    </form>
  );
}
