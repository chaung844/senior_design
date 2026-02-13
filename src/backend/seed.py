"""
database seeding script
usage: uv run seed.py
description: this script seeds the database with sample data for testing purposes.
"""

import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine
from app.schemas.enums import UserRole
from app.models import User, Receipt, BankStatement, BankStatementLine

async def seed_users():
    async with AsyncSessionLocal() as session:
        # check if users already exist to prevent duplicate seeding
        result = await session.execute(select(User))
        existing_users = result.scalars().all()
        if existing_users:
            print("Users already exist, skipping seeding.")
            return
        
        users = [
            User(
                name="Hello World", 
                email="hello@example.com", 
                password_hash="fake_hash_1", 
                role=UserRole.admin
            ),
            User(
                name="User Test", 
                email="test@example.com", 
                password_hash="fake_hash_2", 
                role=UserRole.viewer
            ),
            User(
                name="Dev Test", 
                email="dev@example.com", 
                password_hash="fake_hash_3", 
                role=UserRole.developer
            ),
        ]
        try: 
            session.add_all(users) 
            await session.commit()
            print(f"{len(users)} sample users seeded successfully.")
        except Exception as e:
            print(f"Error seeding users: {e}")
            await session.rollback()

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_users())