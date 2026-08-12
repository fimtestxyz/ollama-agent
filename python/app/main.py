from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .index import index
from .routes import router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    index.load_all()
    yield


app = FastAPI(title="Herdr Python Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
