"""
database seeding script
usage: uv run seed.py
description: this script seeds the database with sample data for testing purposes.
"""

import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine
from app.enums import UserRole
from app.models import User
from app.utils.security import hash_password


async def seed_users():
    # Define the data to seed
    users_to_seed = [
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

    async with AsyncSessionLocal() as session:
        try:
            new_users_count = 0
            for user_data in users_to_seed:
                # Check if a specific email exists
                stmt = select(User).where(User.email == user_data["email"])
                result = await session.execute(stmt)
                existing_user = result.scalar_one_or_none()

                if existing_user:
                    print(f"User {user_data['email']} already exists. Skipping.")
                    continue

                password_hash = hash_password(user_data["password"])
                session.add(
                    User(
                        name=user_data["name"],
                        email=user_data["email"],
                        password_hash=password_hash,
                        role=user_data["role"],
                    )
                )
                new_users_count += 1

            if new_users_count > 0:
                await session.commit()
                print(f"Successfully added {new_users_count} new users.")
            else:
                print("No new users to add.")

        except Exception as e:
            print(f"Error seeding users: {e}")
            await session.rollback()
        finally:
            await session.close()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_users())
