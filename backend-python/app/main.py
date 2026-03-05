from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import threading

from app.api.routes import router, get_db, get_video_service
from app.pubsub.gcp_listener import GCPPubSubListener
from app.repository.database import engine, Base
from app.api.routes import router as video_router
from app.api.auth import router as auth_router

# Initialize Database Schema
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup Logic ---
    # Manually get a DB session for the background listener
    db_gen = get_db()
    db_session = next(db_gen)
    
    service = get_video_service(db_session)
    app.state.listener = GCPPubSubListener(
        project_id="watchparty-482106", 
        topic_id="watchparty-events", 
        sub_id="python-backend-sub", 
        video_service=service
    )
    
    # Run the listener in a background thread
    app.state.listener_thread = threading.Thread(
        target=app.state.listener.listen, 
        daemon=True
    )
    app.state.listener_thread.start()
    print("🚀 Server startup complete")

    yield # --- Server is running ---

    # --- Shutdown Logic ---
    app.state.listener.stop() # Calls the cancel() method on the subscriber
    db_gen.close() # Cleanly close the database generator
    print("👋 Server shutdown complete")

app = FastAPI(title="WatchParty API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video_router)
app.include_router(auth_router)