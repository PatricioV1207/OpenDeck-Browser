import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppDataActions } from "../../state/AppDataProvider";
import type {
  RenameWorkspaceFailureCode,
  RenameWorkspaceResult,
} from "../../state/appDataActions";
import type { WorkspaceDto } from "../../types/appData";
import {
  getRenameWorkspaceFailureMessage,
  validateWorkspaceNameForRename,
} from "./workspaceRenameForm";

interface RenameWorkspaceFormProps {
  workspace: WorkspaceDto;
  workspaces: readonly WorkspaceDto[];
  pending: boolean;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
  onSuccess: (
    outcome: Extract<RenameWorkspaceResult, { ok: true }>["outcome"],
  ) => void;
}

export function RenameWorkspaceForm({
  workspace,
  workspaces,
  pending,
  onCancel,
  onPendingChange,
  onSuccess,
}: RenameWorkspaceFormProps) {
  const { renameWorkspace } = useAppDataActions();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(workspace.name);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [focusNameAfterPending, setFocusNameAfterPending] = useState(false);
  const submissionInFlightRef = useRef(false);

  const editorId = getRenameEditorId(workspace.id);
  const inputId = `${editorId}-name`;
  const helpId = `${editorId}-help`;
  const fieldErrorId = `${editorId}-field-error`;
  const submissionErrorId = `${editorId}-submission-error`;
  const describedBy = [
    helpId,
    fieldError === null ? null : fieldErrorId,
    submissionError === null ? null : submissionErrorId,
  ]
    .filter((id): id is string => id !== null)
    .join(" ");

  useEffect(() => {
    if (!focusNameAfterPending || pending) {
      return;
    }

    nameInputRef.current?.focus();
    setFocusNameAfterPending(false);
  }, [focusNameAfterPending, pending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInFlightRef.current) {
      return;
    }

    const validation = validateWorkspaceNameForRename(
      name,
      workspace.id,
      workspaces,
    );
    if (!validation.ok) {
      setFieldError(validation.message);
      setSubmissionError(null);
      nameInputRef.current?.focus();
      return;
    }

    submissionInFlightRef.current = true;
    setFieldError(null);
    setSubmissionError(null);
    onPendingChange(true);

    let successOutcome: Extract<
      RenameWorkspaceResult,
      { ok: true }
    >["outcome"] | null = null;

    try {
      const result = await renameWorkspace(workspace.id, validation.name);

      if (result.ok) {
        successOutcome = result.outcome;
      } else if (isNameFailure(result.code)) {
        setFieldError(getRenameWorkspaceFailureMessage(result.code));
        setFocusNameAfterPending(true);
      } else {
        setSubmissionError(getRenameWorkspaceFailureMessage(result.code));
        setFocusNameAfterPending(true);
      }
    } finally {
      submissionInFlightRef.current = false;
      onPendingChange(false);
    }

    if (successOutcome !== null) {
      onSuccess(successOutcome);
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    setFieldError(null);
    setSubmissionError(null);
  }

  return (
    <form
      id={editorId}
      className="workspace-rename"
      aria-busy={pending}
      onSubmit={handleSubmit}
    >
      <div className="workspace-rename__field">
        <label htmlFor={inputId}>
          New name for {workspace.name}
        </label>
        <input
          ref={nameInputRef}
          id={inputId}
          name={`workspaceName-${workspace.id}`}
          type="text"
          value={name}
          aria-describedby={describedBy}
          aria-invalid={fieldError === null ? undefined : true}
          autoComplete="off"
          autoFocus
          disabled={pending}
          onChange={(event) => handleNameChange(event.currentTarget.value)}
        />
        <p id={helpId} className="workspace-rename__help">
          Use 1–80 Unicode characters. Names must be unique ignoring case.
        </p>
        {fieldError !== null && (
          <p
            id={fieldErrorId}
            className="workspace-rename__message workspace-rename__message--error"
            role="alert"
          >
            {fieldError}
          </p>
        )}
        {submissionError !== null && (
          <p
            id={submissionErrorId}
            className="workspace-rename__message workspace-rename__message--error"
            role="alert"
          >
            {submissionError}
          </p>
        )}
      </div>

      <div className="workspace-rename__actions">
        <button type="submit" disabled={pending}>
          {pending ? "Saving rename" : "Save rename"}
        </button>
        <button type="button" disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function getRenameEditorId(workspaceId: string): string {
  return `workspace-rename-${workspaceId}`;
}

function isNameFailure(
  code: RenameWorkspaceFailureCode,
): code is "validation" | "conflict" {
  return code === "validation" || code === "conflict";
}
