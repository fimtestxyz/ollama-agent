from pydantic import BaseModel


class ProcessResp(BaseModel):
    file_id: str
    name: str
    size: int
    mime: str
    char_count: int
    chunk_count: int
    strategy: str  # "embed" when chunk embeddings exist, else "fulltext"
    preview: str


class ChunkOut(BaseModel):
    text: str
    file: str
    similarity: float
    pagerank: float
    score: float


class RetrieveReq(BaseModel):
    session_id: str
    query: str
    base_url: str = "http://localhost:11434"
    embed_model: str = ""
    top_k: int = 6


class RetrieveResp(BaseModel):
    chunks: list[ChunkOut] = []
    strategy: str = "none"
