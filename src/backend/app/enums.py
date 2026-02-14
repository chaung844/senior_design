from enum import Enum

class MatchStatus(str, Enum):
    unmatched = "unmatched"
    matched = "matched"
    manual = "manual"

class UserRole(str, Enum):
    admin = "admin"
    developer = "developer"
    viewer = "viewer"