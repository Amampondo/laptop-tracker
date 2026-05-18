# tracker/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.database import Base, engine
from .routes import auth, organisations, users, locations, geofences

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Laptop Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(organisations.router)
app.include_router(users.router)
app.include_router(locations.router)
app.include_router(geofences.router)

@app.get("/health")
def health():
    return {"status": "ok"}
