import os

# Hybrid ranking weight: score = normalized_similarity * (1 + ALPHA * pagerank)
ALPHA = float(os.environ.get("ALPHA", "0.6"))
# Chunks returned per retrieval
TOPK = int(os.environ.get("TOPK", "6"))
# Candidate pool taken from similarity before PageRank re-rank
CANDIDATES = int(os.environ.get("CANDIDATES", "30"))

CHUNK_CHARS = int(os.environ.get("CHUNK_CHARS", "1500"))
OVERLAP = int(os.environ.get("OVERLAP", "150"))

# Minimum cosine/lexical edge weight in the chunk graph
SIM_EDGE_THRESHOLD = float(os.environ.get("SIM_EDGE_THRESHOLD", "0.5"))
# Top-k similar neighbors connect each chunk
SIM_NEIGHBORS = int(os.environ.get("SIM_NEIGHBORS", "5"))

EMBED_BATCH = int(os.environ.get("EMBED_BATCH", "16"))
MAX_FILE_BYTES = int(os.environ.get("MAX_FILE_BYTES", str(20 * 1024 * 1024)))
INDEX_DIR = os.environ.get("INDEX_DIR", "index")