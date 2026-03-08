"""
reset reconciliation matches for testing purposes
after testing matching function, reset for next test run
"""

import asyncio
from sqlalchemy import delete, update

from app.database import AsyncSessionLocal, engine
from app.enums import MatchStatus
from app.models.reconciliation import ReconciliationMatch
from app.models.statement import BankStatementLine
from app.models.receipt import Receipt


async def main():
    async with AsyncSessionLocal() as session:
        # delete all matches
        await session.execute(delete(ReconciliationMatch))

        # reset line statuses to unmatched
        await session.execute(
            update(BankStatementLine).values(match_status=MatchStatus.unmatched)
        )

        # reset receipt statuses to unmatched
        await session.execute(
            update(Receipt).values(match_status=MatchStatus.unmatched)
        )

        await session.commit()

    await engine.dispose()
    print("Reconciliation matches reset complete.")


if __name__ == "__main__":
    asyncio.run(main())
