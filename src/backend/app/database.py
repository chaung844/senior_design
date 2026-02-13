from app.config import get_settings
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

settings = get_settings()
DATABASE_URL = settings.database_url.get_secret_value()

engine = create_async_engine(DATABASE_URL, echo=settings.debug, future=True)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
    autoflush=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session



