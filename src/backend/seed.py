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

async def seed_users():
    # Define the data to seed
    users_to_seed = [
        {
            "name": "Hellooooo World",
            "email": "helloooooo@example.com",
            "password_hash": "fake_hash_1",
            "role": UserRole.admin,
        },
        {
            "name": "User Test",
            "email": "test@example.com",
            "password_hash": "fake_hash_2",
            "role": UserRole.viewer,
        },
        {
            "name": "Dev Test",
            "email": "dev@example.com",
            "password_hash": "fake_hash_3",
            "role": UserRole.developer,
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

                if not existing_user:
                    session.add(User(**user_data))
                    new_users_count += 1
                else:
                    print(f"User {user_data['email']} already exists. Skipping.")

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