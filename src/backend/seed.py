"""
database seeding script
usage: uv run seed.py
description: this script seeds the database with sample data for testing purposes.
"""

import asyncio
import logging
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, TypedDict

from sqlalchemy import select

from app.database import AsyncSessionLocal, engine
from app.enums import (
    AccountType,
    DocumentStatus,
    DocumentType,
    MatchStatus,
    UserRole,
)
from app.models import (
    AccountBook,
    AccountBookMember,
    BankStatement,
    BankStatementLine,
    Document,
    User,
)
from app.utils.security import hash_password


class AccountBookSeed(TypedDict):
    bank_name: str
    account_name: str
    account_type: AccountType
    currency: str
    account_number_last4: str
    archive_after_months: int
    owner: "User"
    viewers: "list[User]"


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("seed")

if TYPE_CHECKING:
    from app.models.account_book import AccountBook
    from app.models.account_book_member import AccountBookMember
    from app.models.user import User

USERS_TO_SEED = [
    {
        "name": "Dev One",
        "email": "dev1@example.com",
        "password": "passworddev1!",
        "role": UserRole.developer,
    },
    {
        "name": "Admin One",
        "email": "admin1@example.com",
        "password": "passwordadmin1!",
        "role": UserRole.admin,
        "created_by_email": "dev1@example.com",
    },
    {
        "name": "Admin Two",
        "email": "admin2@example.com",
        "password": "passwordadmin2!",
        "role": UserRole.admin,
        "created_by_email": "dev1@example.com",
    },
    {
        "name": "Viewer One",
        "email": "viewer1@example.com",
        "password": "passwordviewer1!",
        "role": UserRole.viewer,
        "created_by_email": "dev1@example.com",
    },
]


async def seed_users(session) -> dict[str, User]:
    """Seed users and return a mapping of email -> User."""
    user_map: dict[str, User] = {}
    new_count = 0

    for data in USERS_TO_SEED:
        result = await session.execute(select(User).where(User.email == data["email"]))
        existing = result.scalar_one_or_none()
        if existing:
            logger.info("User %s already exists. Skipping.", data["email"])
            user_map[data["email"]] = existing
            continue

        created_by_email = data.get("created_by_email")
        created_by_id = None
        if created_by_email:
            creator = user_map.get(created_by_email)
            if not creator:
                result_c = await session.execute(
                    select(User).where(User.email == created_by_email)
                )
                creator = result_c.scalar_one_or_none()
            if creator:
                created_by_id = creator.user_id
            else:
                logger.warning(
                    "Creator %s not found for %s; created_by_user_id left unset.",
                    created_by_email,
                    data["email"],
                )

        user = User(
            name=data["name"],
            email=data["email"],
            password_hash=hash_password(data["password"]),
            role=data["role"],
            created_by_user_id=created_by_id,
        )
        session.add(user)
        new_count += 1
        user_map[data["email"]] = user
        await session.flush()

    if new_count:
        logger.info("Added %d new users.", new_count)
    else:
        logger.info("No new users to add.")

    return user_map


async def seed_account_books(session, user_map: dict[str, User]):
    """Seed sample account books for admin users and add viewer memberships."""
    admin1 = user_map.get("admin1@example.com")
    admin2 = user_map.get("admin2@example.com")
    viewer1 = user_map.get("viewer1@example.com")

    if not admin1 or not admin2:
        logger.warning("Admin users not found, skipping account book seed.")
        return

    books_to_seed: list[AccountBookSeed] = [
        {
            "bank_name": "Chase",
            "account_name": "Business Credit Card",
            "account_type": AccountType.credit_card,
            "currency": "USD",
            "account_number_last4": "4321",
            "archive_after_months": 18,
            "owner": admin1,
            "viewers": [viewer1] if viewer1 else [],
        },
        {
            "bank_name": "Bank of America",
            "account_name": "Operating Checking",
            "account_type": AccountType.checking,
            "currency": "USD",
            "account_number_last4": "8765",
            "archive_after_months": 18,
            "owner": admin2,
            "viewers": [],
        },
        {
            "bank_name": "Chase",
            "account_name": "Archival test account book",
            "account_type": AccountType.credit_card,
            "currency": "USD",
            "account_number_last4": "2020",
            "archive_after_months": 18,
            "owner": admin1,
            "viewers": [viewer1] if viewer1 else [],
        },
    ]

    new_count = 0
    for data in books_to_seed:
        owner = data["owner"]
        existing = await session.execute(
            select(AccountBook).where(
                AccountBook.bank_name == data["bank_name"],
                AccountBook.account_number_last4 == data["account_number_last4"],
                AccountBook.user_id == owner.user_id,
            )
        )
        if existing.scalar_one_or_none():
            logger.info(
                "Account book %s ****%s for %s already exists. Skipping.",
                data["bank_name"],
                data["account_number_last4"],
                owner.email,
            )
            continue

        book = AccountBook(
            bank_name=data["bank_name"],
            account_name=data["account_name"],
            account_type=data["account_type"],
            currency=data["currency"],
            account_number_last4=data["account_number_last4"],
            archive_after_months=data["archive_after_months"],
            user_id=owner.user_id,
        )
        session.add(book)
        await session.flush()

        owner_member = AccountBookMember(
            account_id=book.account_id,
            user_id=owner.user_id,
        )
        session.add(owner_member)

        for viewer in data["viewers"]:
            viewer_member = AccountBookMember(
                account_id=book.account_id,
                user_id=viewer.user_id,
            )
            session.add(viewer_member)

        new_count += 1
        logger.info(
            "Created account book: %s ****%s (owner: %s, viewers: %s)",
            data["bank_name"],
            data["account_number_last4"],
            owner.email,
            [v.email for v in data["viewers"]],
        )

    if not new_count:
        logger.info("No new account books to add.")


# Stable seed s3_key — must never change so the UNIQUE constraint doesn't
# cause a rollback on repeated runs.
_SEED_STATEMENT_S3_KEY = "seed/statements/chase-4321-dec-2025.pdf"
_SEED_ARCHIVAL_STATEMENT_S3_KEY = "seed/statements/chase-2020-jan-2020.pdf"


async def seed_statements(session, user_map: dict[str, "User"]):
    """Seed a bank statement with 5 lines for the Business Credit Card account book."""
    admin1 = user_map.get("admin1@example.com")
    if not admin1:
        logger.warning("admin1 not found, skipping statement seed.")
        return

    result = await session.execute(
        select(AccountBook).where(
            AccountBook.account_name == "Business Credit Card",
            AccountBook.user_id == admin1.user_id,
        )
    )
    book = result.scalar_one_or_none()
    if not book:
        logger.warning(
            "Business Credit Card account book not found, skipping statement seed."
        )
        return

    # Check by the stable s3_key on Document — if it exists the full statement
    # was committed successfully on a previous run.
    existing_doc = await session.execute(
        select(Document).where(Document.s3_key == _SEED_STATEMENT_S3_KEY)
    )
    if existing_doc.scalar_one_or_none():
        logger.info(
            "Statement for Business Credit Card Dec 2025 already exists. Skipping."
        )
        return

    statement = BankStatement(
        account_id=book.account_id,
        month=12,
        year=2025,
        account_number_last4=book.account_number_last4,
        total_amount=Decimal("297.56"),
        currency="USD",
    )
    session.add(statement)
    await session.flush()

    # A paired Document row is required so list_statements (which inner-joins
    # Document) can see this statement on the frontend.
    document = Document(
        uploaded_by=admin1.user_id,
        file_name="chase-4321-dec-2025.pdf",
        document_type=DocumentType.bank_statement,
        s3_key=_SEED_STATEMENT_S3_KEY,
        status=DocumentStatus.parsed,
        account_id=book.account_id,
        statement_id=statement.statement_id,
    )
    session.add(document)
    await session.flush()

    lines_data = [
        {
            "line_number": 1,
            "reference_number": "REF20250103001",
            "transaction_date": date(2026, 1, 23),
            "posting_date": date(2026, 1, 24),
            "description": "KROGER - FRESH FOR EVERYONE",
            "vendor": "Kroger",
            "mcc": "5411",
            "charge": Decimal("46.49"),
        },
        {
            "line_number": 2,
            "reference_number": "REF20250108002",
            "transaction_date": date(2026, 1, 15),
            "posting_date": date(2026, 1, 16),
            "description": "TARGET GROCERY",
            "vendor": "Target",
            "mcc": "5411",
            "charge": Decimal("9.78"),
        },
        {
            "line_number": 3,
            "reference_number": "REF20250103003",
            "transaction_date": date(2026, 12, 27),
            "posting_date": date(2026, 12, 28),
            "description": "KROGER - FRESH FOR EVERYONE",
            "vendor": "Kroger",
            "mcc": "5411",
            "charge": Decimal("233.86"),
        },
        {
            "line_number": 4,
            "reference_number": "REF20251220004",
            "transaction_date": date(2026, 1, 17),
            "posting_date": date(2026, 1, 19),
            "description": "AMAZON AMZ AMAZON.COM",
            "vendor": "Amazon",
            "mcc": "5999",
            "charge": Decimal("3.24"),
        },
        {
            "line_number": 5,
            "reference_number": "REF20251227005",
            "transaction_date": date(2026, 1, 17),
            "posting_date": date(2026, 1, 18),
            "description": "AMAZON AMZ AMAZON.COM",
            "vendor": "Amazon",
            "mcc": "5999",
            "charge": Decimal("4.19"),
        },
    ]

    for line_data in lines_data:
        line = BankStatementLine(
            statement_id=statement.statement_id,
            line_number=line_data["line_number"],
            reference_number=line_data["reference_number"],
            transaction_date=line_data["transaction_date"],
            posting_date=line_data["posting_date"],
            description=line_data["description"],
            vendor=line_data["vendor"],
            mcc=line_data["mcc"],
            charge=line_data["charge"],
            currency="USD",
            match_status=MatchStatus.unmatched,
        )
        session.add(line)

    logger.info(
        "Created statement for Business Credit Card Dec 2025 with 5 lines (account_id: %d).",
        book.account_id,
    )

    # ---------------------------------------------------------------------
    # Archival test seed: an old statement (2020) that is eligible to archive
    # ---------------------------------------------------------------------
    archival_book_result = await session.execute(
        select(AccountBook).where(
            AccountBook.account_name == "Archival test account book",
            AccountBook.user_id == admin1.user_id,
        )
    )
    archival_book = archival_book_result.scalar_one_or_none()
    if not archival_book:
        logger.warning(
            "Archival test account book not found, skipping archival statement seed."
        )
        return

    existing_archival_doc = await session.execute(
        select(Document).where(Document.s3_key == _SEED_ARCHIVAL_STATEMENT_S3_KEY)
    )
    if existing_archival_doc.scalar_one_or_none():
        logger.info(
            "Statement for Archival test account book Jan 2020 already exists. Skipping."
        )
        return

    archival_statement = BankStatement(
        account_id=archival_book.account_id,
        month=1,
        year=2020,
        account_number_last4=archival_book.account_number_last4,
        total_amount=Decimal("123.45"),
        currency="USD",
    )
    session.add(archival_statement)
    await session.flush()

    archival_document = Document(
        uploaded_by=admin1.user_id,
        file_name="chase-2020-jan-2020.pdf",
        document_type=DocumentType.bank_statement,
        s3_key=_SEED_ARCHIVAL_STATEMENT_S3_KEY,
        status=DocumentStatus.parsed,
        account_id=archival_book.account_id,
        statement_id=archival_statement.statement_id,
    )
    session.add(archival_document)
    await session.flush()

    archival_lines_data = [
        {
            "line_number": 1,
            "reference_number": "ARCH20200101001",
            "transaction_date": date(2020, 1, 3),
            "posting_date": date(2020, 1, 4),
            "description": "OFFICE DEPOT",
            "vendor": "Office Depot",
            "mcc": "5943",
            "charge": Decimal("45.67"),
        },
        {
            "line_number": 2,
            "reference_number": "ARCH20200101002",
            "transaction_date": date(2020, 1, 10),
            "posting_date": date(2020, 1, 11),
            "description": "AMAZON MKTPLACE PMTS",
            "vendor": "Amazon",
            "mcc": "5999",
            "charge": Decimal("77.78"),
        },
    ]

    for line_data in archival_lines_data:
        line = BankStatementLine(
            statement_id=archival_statement.statement_id,
            line_number=line_data["line_number"],
            reference_number=line_data["reference_number"],
            transaction_date=line_data["transaction_date"],
            posting_date=line_data["posting_date"],
            description=line_data["description"],
            vendor=line_data["vendor"],
            mcc=line_data["mcc"],
            charge=line_data["charge"],
            currency="USD",
            match_status=MatchStatus.unmatched,
        )
        session.add(line)

    logger.info(
        "Created statement for Archival test account book Jan 2020 (eligible for archival) (account_id: %d).",
        archival_book.account_id,
    )


async def main():
    async with AsyncSessionLocal() as session:
        try:
            logger.info("Seeding users...")
            user_map = await seed_users(session)

            logger.info("Seeding account books...")
            await seed_account_books(session, user_map)

            logger.info("Seeding statements...")
            await seed_statements(session, user_map)

            await session.commit()
            logger.info("Seed complete.")

        except Exception as e:
            logger.error("Error during seeding: %s", e, exc_info=True)
            await session.rollback()
        finally:
            await session.close()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
