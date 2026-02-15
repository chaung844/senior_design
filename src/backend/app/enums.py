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
