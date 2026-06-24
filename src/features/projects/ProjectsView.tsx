import { useEffect, useRef, useState, type RefObject } from "react";
import { InfoCard } from "../../components/ui/InfoCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ViewHeader } from "../../components/ui/ViewHeader";
import { ViewSection } from "../../components/ui/ViewSection";
import {
  useAppData,
  useAppDataActions,
} from "../../state/AppDataProvider";
import type {
  DeleteWorkspaceResult,
  SetActiveWorkspaceResult,
} from "../../state/appDataActions";
import type { WorkspaceDto } from "../../types/appData";
import { CreateWorkspaceForm } from "./CreateWorkspaceForm";
import {
  getRenameEditorId,
  RenameWorkspaceForm,
} from "./RenameWorkspaceForm";
import {
  getActiveWorkspaceButtonLabel,
  getActiveWorkspaceButtonText,
  getActiveWorkspaceFailureMessage,
  getActiveWorkspaceSuccessMessage,
} from "./workspaceActiveSelection";
import {
  DELETE_WORKSPACE_CONFIRMATION_COPY,
  DELETE_WORKSPACE_SUCCESS_MESSAGE,
  getCancelDeleteWorkspaceButtonLabel,
  getConfirmDeleteWorkspaceButtonLabel,
  getDeleteWorkspaceButtonLabel,
  getDeleteWorkspaceFailureMessage,
} from "./workspaceDelete";
import {
  createProjectsPresentation,
  type ProjectsTimestampPresentation,
  type WorkspacePresentation,
} from "./projectsPresentation";

export function ProjectsView() {
  const appData = useAppData();
  const { deleteWorkspace, setActiveWorkspace } = useAppDataActions();
  const presentation = createProjectsPresentation(appData);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(
    null,
  );
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(
    null,
  );
  const [renameAnnouncement, setRenameAnnouncement] = useState<string | null>(
    null,
  );
  const [activeSelectionMessage, setActiveSelectionMessage] =
    useState<WorkspaceActiveSelectionMessage | null>(null);
  const [deleteMessage, setDeleteMessage] =
    useState<WorkspaceDeleteMessage | null>(null);
  const [confirmingDeleteWorkspaceId, setConfirmingDeleteWorkspaceId] =
    useState<string | null>(null);
  const [pendingActiveWorkspaceId, setPendingActiveWorkspaceId] = useState<
    string | null
  >(null);
  const [pendingDeleteWorkspaceId, setPendingDeleteWorkspaceId] = useState<
    string | null
  >(null);
  const [focusWorkspaceId, setFocusWorkspaceId] = useState<string | null>(null);
  const [focusActiveWorkspaceId, setFocusActiveWorkspaceId] = useState<
    string | null
  >(null);
  const [focusDeleteWorkspaceId, setFocusDeleteWorkspaceId] = useState<
    string | null
  >(null);
  const [focusDeleteConfirmationId, setFocusDeleteConfirmationId] =
    useState<string | null>(null);
  const [focusDeleteSuccessMessage, setFocusDeleteSuccessMessage] =
    useState(false);
  const renameButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const activeButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const deleteConfirmButtonRefs = useRef(
    new Map<string, HTMLButtonElement>(),
  );
  const deleteSuccessMessageRef = useRef<HTMLParagraphElement | null>(null);
  const activeSelectionInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);

  useEffect(() => {
    if (focusWorkspaceId === null || pendingWorkspaceId !== null) {
      return;
    }

    renameButtonRefs.current.get(focusWorkspaceId)?.focus();
    setFocusWorkspaceId(null);
  }, [focusWorkspaceId, pendingWorkspaceId]);

  useEffect(() => {
    if (
      focusActiveWorkspaceId === null ||
      pendingActiveWorkspaceId !== null
    ) {
      return;
    }

    activeButtonRefs.current.get(focusActiveWorkspaceId)?.focus();
    setFocusActiveWorkspaceId(null);
  }, [focusActiveWorkspaceId, pendingActiveWorkspaceId]);

  useEffect(() => {
    if (
      focusDeleteWorkspaceId === null ||
      pendingDeleteWorkspaceId !== null
    ) {
      return;
    }

    deleteButtonRefs.current.get(focusDeleteWorkspaceId)?.focus();
    setFocusDeleteWorkspaceId(null);
  }, [focusDeleteWorkspaceId, pendingDeleteWorkspaceId]);

  useEffect(() => {
    if (
      focusDeleteConfirmationId === null ||
      pendingDeleteWorkspaceId !== null
    ) {
      return;
    }

    deleteConfirmButtonRefs.current
      .get(focusDeleteConfirmationId)
      ?.focus();
    setFocusDeleteConfirmationId(null);
  }, [focusDeleteConfirmationId, pendingDeleteWorkspaceId]);

  useEffect(() => {
    if (!focusDeleteSuccessMessage || deleteMessage?.workspaceId !== null) {
      return;
    }

    deleteSuccessMessageRef.current?.focus();
    setFocusDeleteSuccessMessage(false);
  }, [deleteMessage, focusDeleteSuccessMessage]);

  function openRenameEditor(workspaceId: string) {
    if (pendingWorkspaceId !== null) {
      return;
    }

    setEditingWorkspaceId(workspaceId);
    setConfirmingDeleteWorkspaceId(null);
    setRenameAnnouncement(null);
    setActiveSelectionMessage(null);
    setDeleteMessage(null);
  }

  function closeRenameEditor(workspaceId: string) {
    setEditingWorkspaceId(null);
    setFocusWorkspaceId(workspaceId);
  }

  function handleRenameSuccess(
    workspaceId: string,
    outcome: "renamed" | "unchanged",
  ) {
    setRenameAnnouncement(
      outcome === "renamed"
        ? "Workspace renamed."
        : "Workspace name is unchanged.",
    );
    setDeleteMessage(null);
    closeRenameEditor(workspaceId);
  }

  function openDeleteConfirmation(workspaceId: string) {
    if (pendingDeleteWorkspaceId !== null) {
      return;
    }

    setConfirmingDeleteWorkspaceId(workspaceId);
    setEditingWorkspaceId(null);
    setRenameAnnouncement(null);
    setActiveSelectionMessage(null);
    setDeleteMessage(null);
  }

  function cancelDeleteConfirmation(workspaceId: string) {
    setConfirmingDeleteWorkspaceId(null);
    setDeleteMessage(null);
    setFocusDeleteWorkspaceId(workspaceId);
  }

  async function handleDeleteWorkspace(workspaceId: string): Promise<void> {
    if (deleteInFlightRef.current) {
      return;
    }

    deleteInFlightRef.current = true;
    setPendingDeleteWorkspaceId(workspaceId);
    setRenameAnnouncement(null);
    setActiveSelectionMessage(null);
    setDeleteMessage(null);

    try {
      const result = await deleteWorkspace(workspaceId);

      if (result.ok) {
        setConfirmingDeleteWorkspaceId(null);
        setDeleteMessage({
          workspaceId: null,
          tone: "success",
          text: DELETE_WORKSPACE_SUCCESS_MESSAGE,
        });
        setFocusDeleteSuccessMessage(true);
        return;
      }

      setDeleteMessage(createDeleteFailureMessage(workspaceId, result));
      setFocusDeleteConfirmationId(workspaceId);
    } finally {
      deleteInFlightRef.current = false;
      setPendingDeleteWorkspaceId(null);
    }
  }

  async function handleSetActiveWorkspace(
    workspaceId: string,
  ): Promise<void> {
    if (activeSelectionInFlightRef.current) {
      return;
    }

    activeSelectionInFlightRef.current = true;
    setPendingActiveWorkspaceId(workspaceId);
    setRenameAnnouncement(null);
    setActiveSelectionMessage(null);
    setDeleteMessage(null);

    try {
      const result = await setActiveWorkspace(workspaceId);

      setActiveSelectionMessage(
        createActiveSelectionMessage(workspaceId, result),
      );
    } finally {
      activeSelectionInFlightRef.current = false;
      setPendingActiveWorkspaceId(null);
      setFocusActiveWorkspaceId(workspaceId);
    }
  }

  function registerRenameButton(
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) {
    if (button === null) {
      renameButtonRefs.current.delete(workspaceId);
      return;
    }

    renameButtonRefs.current.set(workspaceId, button);
  }

  function registerActiveButton(
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) {
    if (button === null) {
      activeButtonRefs.current.delete(workspaceId);
      return;
    }

    activeButtonRefs.current.set(workspaceId, button);
  }

  function registerDeleteConfirmButton(
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) {
    if (button === null) {
      deleteConfirmButtonRefs.current.delete(workspaceId);
      return;
    }

    deleteConfirmButtonRefs.current.set(workspaceId, button);
  }

  function registerDeleteButton(
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) {
    if (button === null) {
      deleteButtonRefs.current.delete(workspaceId);
      return;
    }

    deleteButtonRefs.current.set(workspaceId, button);
  }

  return (
    <div className="internal-view">
      <ViewHeader
        eyebrow="Projects"
        title="Organize maintainer context without broad local access."
        summary="Create, rename, select, and delete metadata-only workspaces without scanning directories or executing repository code."
        status="Create, rename, active selection, and delete"
      />

      {appData.status === "ready" && (
        <CreateWorkspaceForm workspaces={appData.data.workspaces} />
      )}

      <ProjectsContent
        presentation={presentation}
        workspaces={appData.status === "ready" ? appData.data.workspaces : []}
        editingWorkspaceId={editingWorkspaceId}
        pendingWorkspaceId={pendingWorkspaceId}
        pendingActiveWorkspaceId={pendingActiveWorkspaceId}
        confirmingDeleteWorkspaceId={confirmingDeleteWorkspaceId}
        pendingDeleteWorkspaceId={pendingDeleteWorkspaceId}
        renameAnnouncement={renameAnnouncement}
        activeSelectionMessage={activeSelectionMessage}
        deleteMessage={deleteMessage}
        deleteSuccessMessageRef={deleteSuccessMessageRef}
        onOpenRename={openRenameEditor}
        onCancelRename={closeRenameEditor}
        onOpenDelete={openDeleteConfirmation}
        onCancelDelete={cancelDeleteConfirmation}
        onConfirmDelete={handleDeleteWorkspace}
        onRenamePendingChange={(workspaceId, pending) =>
          setPendingWorkspaceId(pending ? workspaceId : null)
        }
        onRenameSuccess={handleRenameSuccess}
        onSetActiveWorkspace={handleSetActiveWorkspace}
        onRenameButtonRef={registerRenameButton}
        onActiveButtonRef={registerActiveButton}
        onDeleteButtonRef={registerDeleteButton}
        onDeleteConfirmButtonRef={registerDeleteConfirmButton}
      />

      <ViewSection
        title="Workspace boundaries"
        intro="The current metadata model stays intentionally narrow and reviewable."
      >
        <div className="view-card-grid view-card-grid--three">
          <InfoCard title="Local metadata" status="Available" tone="ready">
            <p>
              Read a workspace name, local identity, timestamps, and active
              marker without credentials or private repository content.
            </p>
          </InfoCard>
          <InfoCard title="Repository references" status="Later">
            <p>
              Associate GitHub repositories only after authentication,
              credential storage, and read-only API boundaries are approved.
            </p>
          </InfoCard>
          <InfoCard title="Directory access" status="Not included" tone="protected">
            <p>
              Metadata-only workspaces will not require selecting or reading a
              local project directory in the initial model.
            </p>
          </InfoCard>
        </div>
      </ViewSection>

      <dl className="view-status-list" aria-label="Projects implementation status">
        <div>
          <dt>Workspace creation and rename</dt>
          <dd>Available through the validated Rust app-data boundary</dd>
        </div>
        <div>
          <dt>Manual active selection</dt>
          <dd>Available as metadata-only provider state from canonical Rust responses</dd>
        </div>
        <div>
          <dt>Delete workspace</dt>
          <dd>Available for local metadata after explicit confirmation</dd>
        </div>
        <div>
          <dt>Repository connection</dt>
          <dd>Planned for a later secure integration</dd>
        </div>
        <div>
          <dt>Persistence</dt>
          <dd>Successful mutations refresh the canonical provider snapshot</dd>
        </div>
      </dl>
    </div>
  );
}

interface WorkspaceActiveSelectionMessage {
  readonly workspaceId: string;
  readonly tone: "success" | "error";
  readonly text: string;
}

interface WorkspaceDeleteMessage {
  readonly workspaceId: string | null;
  readonly tone: "success" | "error";
  readonly text: string;
}

interface ProjectsContentProps {
  presentation: ReturnType<typeof createProjectsPresentation>;
  workspaces: readonly WorkspaceDto[];
  editingWorkspaceId: string | null;
  pendingWorkspaceId: string | null;
  pendingActiveWorkspaceId: string | null;
  confirmingDeleteWorkspaceId: string | null;
  pendingDeleteWorkspaceId: string | null;
  renameAnnouncement: string | null;
  activeSelectionMessage: WorkspaceActiveSelectionMessage | null;
  deleteMessage: WorkspaceDeleteMessage | null;
  deleteSuccessMessageRef: RefObject<HTMLParagraphElement | null>;
  onOpenRename: (workspaceId: string) => void;
  onCancelRename: (workspaceId: string) => void;
  onOpenDelete: (workspaceId: string) => void;
  onCancelDelete: (workspaceId: string) => void;
  onConfirmDelete: (workspaceId: string) => Promise<void>;
  onRenamePendingChange: (workspaceId: string, pending: boolean) => void;
  onRenameSuccess: (
    workspaceId: string,
    outcome: "renamed" | "unchanged",
  ) => void;
  onSetActiveWorkspace: (workspaceId: string) => Promise<void>;
  onRenameButtonRef: (
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) => void;
  onActiveButtonRef: (
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) => void;
  onDeleteButtonRef: (
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) => void;
  onDeleteConfirmButtonRef: (
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) => void;
}

function ProjectsContent({
  presentation,
  workspaces,
  editingWorkspaceId,
  pendingWorkspaceId,
  pendingActiveWorkspaceId,
  confirmingDeleteWorkspaceId,
  pendingDeleteWorkspaceId,
  renameAnnouncement,
  activeSelectionMessage,
  deleteMessage,
  deleteSuccessMessageRef,
  onOpenRename,
  onCancelRename,
  onOpenDelete,
  onCancelDelete,
  onConfirmDelete,
  onRenamePendingChange,
  onRenameSuccess,
  onSetActiveWorkspace,
  onRenameButtonRef,
  onActiveButtonRef,
  onDeleteButtonRef,
  onDeleteConfirmButtonRef,
}: ProjectsContentProps) {
  if (presentation.status === "loading") {
    return (
      <section
        className="empty-state projects-state"
        aria-labelledby="projects-loading-title"
        aria-busy="true"
      >
        <StatusBadge tone="foundation">Loading</StatusBadge>
        <h2 id="projects-loading-title">Loading workspaces</h2>
        <p>Workspace metadata is being loaded from local app data.</p>
      </section>
    );
  }

  if (presentation.status === "error") {
    return (
      <section
        className="empty-state projects-state"
        aria-labelledby="projects-error-title"
      >
        <StatusBadge tone="protected">Unavailable</StatusBadge>
        <h2 id="projects-error-title">Workspace data is unavailable</h2>
        <p>{presentation.message}</p>
      </section>
    );
  }

  if (presentation.status === "empty") {
    return (
      <>
        <DeleteSuccessMessage
          message={deleteMessage}
          messageRef={deleteSuccessMessageRef}
        />
        <section
          className="empty-state projects-state"
          aria-labelledby="projects-empty-title"
        >
          <StatusBadge tone="planned">No saved metadata</StatusBadge>
          <h2 id="projects-empty-title">No workspaces yet</h2>
          <p>
            Use the create form above to add a metadata-only workspace. The
            workspace will appear here after Rust validates and persists it.
          </p>
        </section>
      </>
    );
  }

  return (
    <ViewSection
      title={presentation.countLabel}
      intro="Saved metadata is shown in canonical storage order."
    >
      <DeleteSuccessMessage
        message={deleteMessage}
        messageRef={deleteSuccessMessageRef}
      />
      {renameAnnouncement !== null && (
        <p
          className="workspace-rename__message workspace-rename__message--success"
          role="status"
          aria-live="polite"
        >
          {renameAnnouncement}
        </p>
      )}
      <ul className="workspace-card-list" aria-label="Saved workspaces">
        {presentation.workspaces.map((workspace) => {
          const canonicalWorkspace = workspaces.find(
            (candidate) => candidate.id === workspace.id,
          );

          if (canonicalWorkspace === undefined) {
            return null;
          }

          return (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              canonicalWorkspace={canonicalWorkspace}
              workspaces={workspaces}
              editing={editingWorkspaceId === workspace.id}
              renameDisabled={pendingWorkspaceId !== null}
              activeSelectionDisabled={pendingActiveWorkspaceId !== null}
              activeSelectionPending={
                pendingActiveWorkspaceId === workspace.id
              }
              activeSelectionMessage={
                activeSelectionMessage?.workspaceId === workspace.id
                  ? activeSelectionMessage
                  : null
              }
              deleteConfirmationOpen={
                confirmingDeleteWorkspaceId === workspace.id
              }
              deleteDisabled={pendingDeleteWorkspaceId !== null}
              deletePending={pendingDeleteWorkspaceId === workspace.id}
              deleteMessage={
                deleteMessage?.workspaceId === workspace.id
                  ? deleteMessage
                  : null
              }
              onOpenRename={onOpenRename}
              onCancelRename={onCancelRename}
              onOpenDelete={onOpenDelete}
              onCancelDelete={onCancelDelete}
              onConfirmDelete={onConfirmDelete}
              onRenamePendingChange={onRenamePendingChange}
              onRenameSuccess={onRenameSuccess}
              onSetActiveWorkspace={onSetActiveWorkspace}
              onRenameButtonRef={onRenameButtonRef}
              onActiveButtonRef={onActiveButtonRef}
              onDeleteButtonRef={onDeleteButtonRef}
              onDeleteConfirmButtonRef={onDeleteConfirmButtonRef}
            />
          );
        })}
      </ul>
    </ViewSection>
  );
}

interface WorkspaceCardProps {
  workspace: WorkspacePresentation;
  canonicalWorkspace: WorkspaceDto;
  workspaces: readonly WorkspaceDto[];
  editing: boolean;
  renameDisabled: boolean;
  activeSelectionDisabled: boolean;
  activeSelectionPending: boolean;
  activeSelectionMessage: WorkspaceActiveSelectionMessage | null;
  deleteConfirmationOpen: boolean;
  deleteDisabled: boolean;
  deletePending: boolean;
  deleteMessage: WorkspaceDeleteMessage | null;
  onOpenRename: (workspaceId: string) => void;
  onCancelRename: (workspaceId: string) => void;
  onOpenDelete: (workspaceId: string) => void;
  onCancelDelete: (workspaceId: string) => void;
  onConfirmDelete: (workspaceId: string) => Promise<void>;
  onRenamePendingChange: (workspaceId: string, pending: boolean) => void;
  onRenameSuccess: (
    workspaceId: string,
    outcome: "renamed" | "unchanged",
  ) => void;
  onSetActiveWorkspace: (workspaceId: string) => Promise<void>;
  onRenameButtonRef: (
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) => void;
  onActiveButtonRef: (
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) => void;
  onDeleteButtonRef: (
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) => void;
  onDeleteConfirmButtonRef: (
    workspaceId: string,
    button: HTMLButtonElement | null,
  ) => void;
}

function WorkspaceCard({
  workspace,
  canonicalWorkspace,
  workspaces,
  editing,
  renameDisabled,
  activeSelectionDisabled,
  activeSelectionPending,
  activeSelectionMessage,
  deleteConfirmationOpen,
  deleteDisabled,
  deletePending,
  deleteMessage,
  onOpenRename,
  onCancelRename,
  onOpenDelete,
  onCancelDelete,
  onConfirmDelete,
  onRenamePendingChange,
  onRenameSuccess,
  onSetActiveWorkspace,
  onRenameButtonRef,
  onActiveButtonRef,
  onDeleteButtonRef,
  onDeleteConfirmButtonRef,
}: WorkspaceCardProps) {
  const titleId = `workspace-title-${workspace.id}`;
  const renameEditorId = getRenameEditorId(workspace.id);
  const activeSelectionMessageId = `workspace-active-message-${workspace.id}`;
  const deleteConfirmationId = `workspace-delete-${workspace.id}`;
  const deleteConfirmationTitleId = `workspace-delete-title-${workspace.id}`;
  const deleteMessageId = `workspace-delete-message-${workspace.id}`;

  return (
    <li className="workspace-card-list__item">
      <article
        className="workspace-card"
        aria-busy={activeSelectionPending || deletePending}
        aria-labelledby={titleId}
      >
        <div className="workspace-card__header">
          <div className="workspace-card__title">
            <h3 id={titleId}>{workspace.name}</h3>
            {workspace.isActive && (
              <StatusBadge tone="ready">Active</StatusBadge>
            )}
          </div>
          <div className="workspace-card__actions">
            <button
              ref={(button) => onActiveButtonRef(workspace.id, button)}
              className="workspace-card__active-button"
              type="button"
              aria-label={getActiveWorkspaceButtonLabel(
                workspace.name,
                workspace.isActive,
              )}
              aria-describedby={
                activeSelectionMessage === null
                  ? undefined
                  : activeSelectionMessageId
              }
              disabled={activeSelectionDisabled}
              onClick={() => {
                void onSetActiveWorkspace(workspace.id);
              }}
            >
              {getActiveWorkspaceButtonText(workspace.isActive)}
            </button>
            <button
              ref={(button) => onRenameButtonRef(workspace.id, button)}
              className="workspace-card__rename-button"
              type="button"
              aria-label={`Rename ${workspace.name}`}
              aria-expanded={editing}
              aria-controls={renameEditorId}
              disabled={renameDisabled}
              onClick={() => onOpenRename(workspace.id)}
            >
              Rename
            </button>
            <button
              ref={(button) => onDeleteButtonRef(workspace.id, button)}
              className="workspace-card__delete-button"
              type="button"
              aria-label={getDeleteWorkspaceButtonLabel(workspace.name)}
              aria-expanded={deleteConfirmationOpen}
              aria-controls={deleteConfirmationId}
              disabled={deleteDisabled}
              onClick={() => onOpenDelete(workspace.id)}
            >
              Delete
            </button>
          </div>
        </div>
        {activeSelectionMessage !== null && (
          <p
            id={activeSelectionMessageId}
            className={`workspace-active-selection__message workspace-active-selection__message--${activeSelectionMessage.tone}`}
            role={
              activeSelectionMessage.tone === "success" ? "status" : "alert"
            }
            aria-live={
              activeSelectionMessage.tone === "success" ? "polite" : undefined
            }
          >
            {activeSelectionMessage.text}
          </p>
        )}
        {editing && (
          <RenameWorkspaceForm
            workspace={canonicalWorkspace}
            workspaces={workspaces}
            pending={renameDisabled}
            onCancel={() => onCancelRename(workspace.id)}
            onPendingChange={(pending) =>
              onRenamePendingChange(workspace.id, pending)
            }
            onSuccess={(outcome) => onRenameSuccess(workspace.id, outcome)}
          />
        )}
        {deleteConfirmationOpen && (
          <section
            id={deleteConfirmationId}
            className="workspace-delete"
            aria-busy={deletePending}
            aria-labelledby={deleteConfirmationTitleId}
          >
            <div className="workspace-delete__copy">
              <h4 id={deleteConfirmationTitleId}>
                Delete {workspace.name}?
              </h4>
              <p>{DELETE_WORKSPACE_CONFIRMATION_COPY}</p>
            </div>
            {deleteMessage !== null && (
              <p
                id={deleteMessageId}
                className={`workspace-delete__message workspace-delete__message--${deleteMessage.tone}`}
                role="alert"
              >
                {deleteMessage.text}
              </p>
            )}
            <div className="workspace-delete__actions">
              <button
                ref={(button) =>
                  onDeleteConfirmButtonRef(workspace.id, button)
                }
                type="button"
                aria-label={getConfirmDeleteWorkspaceButtonLabel(
                  workspace.name,
                )}
                aria-describedby={
                  deleteMessage === null ? undefined : deleteMessageId
                }
                disabled={deletePending}
                onClick={() => {
                  void onConfirmDelete(workspace.id);
                }}
              >
                {deletePending ? "Deleting workspace" : "Delete workspace"}
              </button>
              <button
                type="button"
                aria-label={getCancelDeleteWorkspaceButtonLabel(
                  workspace.name,
                )}
                disabled={deletePending}
                onClick={() => onCancelDelete(workspace.id)}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
        <dl className="workspace-card__details">
          <div>
            <dt>Workspace ID</dt>
            <dd>
              <code>{workspace.id}</code>
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>
              <WorkspaceTime timestamp={workspace.createdAt} />
            </dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>
              <WorkspaceTime timestamp={workspace.updatedAt} />
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}

function DeleteSuccessMessage({
  message,
  messageRef,
}: {
  message: WorkspaceDeleteMessage | null;
  messageRef: RefObject<HTMLParagraphElement | null>;
}) {
  if (
    message === null ||
    message.workspaceId !== null ||
    message.tone !== "success"
  ) {
    return null;
  }

  return (
    <p
      ref={messageRef}
      className="workspace-delete__message workspace-delete__message--success"
      role="status"
      aria-live="polite"
      tabIndex={-1}
    >
      {message.text}
    </p>
  );
}

function createActiveSelectionMessage(
  workspaceId: string,
  result: SetActiveWorkspaceResult,
): WorkspaceActiveSelectionMessage {
  if (result.ok) {
    return {
      workspaceId,
      tone: "success",
      text: getActiveWorkspaceSuccessMessage(result.outcome),
    };
  }

  return {
    workspaceId,
    tone: "error",
    text: getActiveWorkspaceFailureMessage(result.code),
  };
}

function createDeleteFailureMessage(
  workspaceId: string,
  result: Extract<DeleteWorkspaceResult, { ok: false }>,
): WorkspaceDeleteMessage {
  return {
    workspaceId,
    tone: "error",
    text: getDeleteWorkspaceFailureMessage(result.code),
  };
}

function WorkspaceTime({
  timestamp,
}: {
  timestamp: ProjectsTimestampPresentation;
}) {
  if (timestamp.dateTime === null) {
    return <span>{timestamp.label}</span>;
  }

  return <time dateTime={timestamp.dateTime}>{timestamp.label}</time>;
}
