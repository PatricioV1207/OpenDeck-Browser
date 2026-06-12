use crate::domain::app_data::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageNotice {
    CorruptDataRecovered,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageError {
    ReadFailed,
    InvalidDataFileType,
    DataFileTooLarge,
    UnsupportedSchema,
    ValidationFailed(DomainError),
    SerializationFailed,
    DataOutputTooLarge,
    DirectoryCreationFailed,
    TemporaryFileCreationFailed,
    WriteFailed,
    SyncFailed,
    BackupFailed,
    ReplacementFailed,
}
