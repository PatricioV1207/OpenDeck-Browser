import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppDataActions } from "../../state/AppDataProvider";
import type { WorkspaceDto } from "../../types/appData";
import {
  getCreateWorkspaceFailureMessage,
  validateWorkspaceNameForCreate,
} from "./workspaceCreateForm";

const NAME_INPUT_ID = "create-workspace-name";
const NAME_HELP_ID = "create-workspace-name-help";
const NAME_ERROR_ID = "create-workspace-name-error";

export function CreateWorkspaceForm({
  workspaces,
}: {
  workspaces: readonly WorkspaceDto[];
}) {
  const { createWorkspace } = useAppDataActions();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [focusNameAfterSubmit, setFocusNameAfterSubmit] = useState(false);
  const submissionInFlightRef = useRef(false);

  const describedBy = fieldError === null
    ? NAME_HELP_ID
    : `${NAME_HELP_ID} ${NAME_ERROR_ID}`;

  useEffect(() => {
    if (!focusNameAfterSubmit || submitting) {
      return;
    }

    nameInputRef.current?.focus();
    setFocusNameAfterSubmit(false);
  }, [focusNameAfterSubmit, submitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInFlightRef.current) {
      return;
    }

    const validation = validateWorkspaceNameForCreate(name, workspaces);
    if (!validation.ok) {
      setFieldError(validation.message);
      setSubmissionError(null);
      setSuccessMessage(null);
      nameInputRef.current?.focus();
      return;
    }

    submissionInFlightRef.current = true;
    setSubmitting(true);
    setFieldError(null);
    setSubmissionError(null);
    setSuccessMessage(null);

    try {
      const result = await createWorkspace(validation.name);

      if (result.ok) {
        setName("");
        setSuccessMessage("Workspace created and set as active.");
        setFocusNameAfterSubmit(true);
        return;
      }

      setSubmissionError(getCreateWorkspaceFailureMessage(result.code));
      setFocusNameAfterSubmit(true);
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    setFieldError(null);
    setSubmissionError(null);
    setSuccessMessage(null);
  }

  return (
    <section
      className="workspace-create"
      aria-labelledby="workspace-create-title"
    >
      <div className="workspace-create__header">
        <h2 id="workspace-create-title">Create workspace</h2>
        <p>
          Save a metadata-only workspace name. No repository folder, local
          path, or remote account is requested.
        </p>
      </div>

      <form
        className="workspace-create__form"
        aria-busy={submitting}
        onSubmit={handleSubmit}
      >
        <div className="workspace-create__field">
          <label htmlFor={NAME_INPUT_ID}>Workspace name</label>
          <input
            ref={nameInputRef}
            id={NAME_INPUT_ID}
            name="workspaceName"
            type="text"
            value={name}
            aria-describedby={describedBy}
            aria-invalid={fieldError === null ? undefined : true}
            autoComplete="off"
            disabled={submitting}
            onChange={(event) => handleNameChange(event.currentTarget.value)}
          />
          <p id={NAME_HELP_ID} className="workspace-create__help">
            Use 1–80 Unicode characters. Names must be unique ignoring case.
          </p>
          {fieldError !== null && (
            <p
              id={NAME_ERROR_ID}
              className="workspace-create__message workspace-create__message--error"
              role="alert"
            >
              {fieldError}
            </p>
          )}
        </div>

        <button
          className="workspace-create__submit"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Creating workspace" : "Create workspace"}
        </button>
      </form>

      {submissionError !== null && (
        <p
          className="workspace-create__message workspace-create__message--error"
          role="alert"
        >
          {submissionError}
        </p>
      )}
      {successMessage !== null && (
        <p
          className="workspace-create__message workspace-create__message--success"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </p>
      )}
    </section>
  );
}
