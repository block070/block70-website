from fastapi import FastAPI

from api.routes import register_routes
from app.db import engine, Base
from app.agents.arbitrage_agent import run_arbitrage_scan
from app.agents.miner_agent import run_miner_scan
from app.agents.wallet_agent import run_wallet_scan
from app.db import SessionLocal


def create_app() -> FastAPI:
    app = FastAPI(title="Block70 API", version="0.1.0")

    # Ensure database tables exist
    Base.metadata.create_all(bind=engine)

    register_routes(app)

    @app.on_event("startup")
    def seed_mock_data() -> None:
        """
        Seed the database with mock arbitrage, miner ROI, and wallet opportunities on first startup.
        """
        db = SessionLocal()
        try:
            from app.models import Opportunity

            has_any = db.query(Opportunity).first() is not None
            if not has_any:
                run_arbitrage_scan(db)
                run_miner_scan(db)
                run_wallet_scan(db)
        finally:
            db.close()

    return app


app = create_app()

