from enum import Enum


class MatchStatus(str, Enum):
    unmatched = "unmatched"
    perfect_matched = "perfect_matched"
    bundle_matched = "bundle_matched"
    manual = "manual"


class UserRole(str, Enum):
    admin = "admin"
    developer = "developer"
    viewer = "viewer"


class AccountType(str, Enum):
    checking = "checking"
    credit_card = "credit_card"


class DocumentType(str, Enum):
    receipt = "receipt"
    bank_statement = "bank_statement"


class DocumentStatus(str, Enum):
    pending_upload = "pending_upload"
    pending_processing = "pending_processing"
    processing = "processing"
    parsed = "parsed"
    failed = "failed"


class JobType(str, Enum):
    parsing = "parsing"
    reconciliation = "reconciliation"


class JobStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    reconciling = "reconciling"
    completed = "completed"
    failed = "failed"


class StatementStatus(str, Enum):
    active = "active"
    archived = "archived"
