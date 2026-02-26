"""
database seeding script
usage: uv run seed.py
description: this script seeds the database with sample data for testing purposes.
"""

import asyncio
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.database import AsyncSessionLocal, engine
from app.enums import AccountBookRole, AccountType, UserRole
from app.models import AccountBook, AccountBookMember, User
from app.utils.security import hash_password

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
        "name": "Dev Two",
        "email": "dev2@example.com",
        "password": "passworddev2!",
        "role": UserRole.developer,
    },
    {
        "name": "Admin One",
        "email": "admin1@example.com",
        "password": "passwordadmin1!",
        "role": UserRole.admin,
    },
    {
        "name": "Admin Two",
        "email": "admin2@example.com",
        "password": "passwordadmin2!",
        "role": UserRole.admin,
    },
    {
        "name": "Viewer One",
        "email": "viewer1@example.com",
        "password": "passwordviewer1!",
        "role": UserRole.viewer,
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
            print(f"  User {data['email']} already exists. Skipping.")
            user_map[data["email"]] = existing
            continue

        user = User(
            name=data["name"],
            email=data["email"],
            password_hash=hash_password(data["password"]),
            role=data["role"],
        )
        session.add(user)
        new_count += 1
        user_map[data["email"]] = user

    if new_count:
        await session.flush()
        print(f"  Added {new_count} new users.")
    else:
        print("  No new users to add.")

    return user_map


async def seed_account_books(session, user_map: dict[str, User]):
    """Seed sample account books for admin users and add viewer memberships."""
    admin1 = user_map.get("admin1@example.com")
    admin2 = user_map.get("admin2@example.com")
    viewer1 = user_map.get("viewer1@example.com")

    if not admin1 or not admin2:
        print("  Admin users not found, skipping account book seed.")
        return

    books_to_seed = [
        {
            "bank_name": "Chase",
            "account_name": "Business Credit Card",
            "account_type": AccountType.credit_card,
            "currency": "USD",
            "account_number_last4": "4321",
            "owner": admin1,
            "viewers": [viewer1] if viewer1 else [],
        },
        {
            "bank_name": "Bank of America",
            "account_name": "Operating Checking",
            "account_type": AccountType.checking,
            "currency": "USD",
            "account_number_last4": "8765",
            "owner": admin2,
            "viewers": [],
        },
    ]

    new_count = 0
    for data in books_to_seed:
        owner: User = data["owner"]
        existing = await session.execute(
            select(AccountBook).where(
                AccountBook.bank_name == data["bank_name"],
                AccountBook.account_number_last4 == data["account_number_last4"],
                AccountBook.user_id == owner.user_id,
            )
        )
        if existing.scalar_one_or_none():
            print(
                f"  Account book {data['bank_name']} ****{data['account_number_last4']} "
                f"for {owner.email} already exists. Skipping."
            )
            continue

        book = AccountBook(
            bank_name=data["bank_name"],
            account_name=data["account_name"],
            account_type=data["account_type"],
            currency=data["currency"],
            account_number_last4=data["account_number_last4"],
            user_id=owner.user_id,
        )
        session.add(book)
        await session.flush()

        owner_member = AccountBookMember(
            account_id=book.account_id,
            user_id=owner.user_id,
            role=AccountBookRole.owner,
        )
        session.add(owner_member)

        for viewer in data["viewers"]:
            viewer_member = AccountBookMember(
                account_id=book.account_id,
                user_id=viewer.user_id,
                role=AccountBookRole.viewer,
            )
            session.add(viewer_member)

        new_count += 1
        print(
            f"  Created account book: {data['bank_name']} ****{data['account_number_last4']} "
            f"(owner: {owner.email}, viewers: {[v.email for v in data['viewers']]})"
        )

    if not new_count:
        print("  No new account books to add.")


async def main():
    async with AsyncSessionLocal() as session:
        try:
            print("Seeding users...")
            user_map = await seed_users(session)

            print("Seeding account books...")
            await seed_account_books(session, user_map)

            await session.commit()
            print("Seed complete.")

        except Exception as e:
            print(f"Error during seeding: {e}")
            await session.rollback()
        finally:
            await session.close()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
