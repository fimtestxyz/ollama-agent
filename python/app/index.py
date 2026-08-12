import json
import os
import threading

from . import config

Entry = dict  # see index.add_file for the shape


class IndexStore:
    def __init__(self, root: str | None = None):
        self._root = root or os.path.abspath(config.INDEX_DIR)
        self._files: dict[str, dict[str, Entry]] = {}
        self._lock = threading.RLock()
        os.makedirs(self._root, exist_ok=True)

    # ---- persistence ----

    def load_all(self) -> None:
        with self._lock:
            for session_id in os.listdir(self._root):
                sdir = os.path.join(self._root, session_id)
                if not os.path.isdir(sdir):
                    continue
                for fname in os.listdir(sdir):
                    if not fname.endswith(".json"):
                        continue
                    path = os.path.join(sdir, fname)
                    try:
                        with open(path, "r", encoding="utf-8") as fh:
                            entry = json.load(fh)
                        self._files.setdefault(session_id, {})[entry["file_id"]] = entry
                    except Exception:
                        continue

    def _path(self, session_id: str, file_id: str) -> str:
        return os.path.join(self._root, session_id, f"{file_id}.json")

    def _persist(self, session_id: str, entry: Entry) -> None:
        path = self._path(session_id, entry["file_id"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(entry, fh, ensure_ascii=False)

    def _unlink(self, session_id: str, file_id: str) -> None:
        try:
            os.unlink(self._path(session_id, file_id))
        except FileNotFoundError:
            pass
        except OSError:
            pass

    # ---- api ----

    def add_file(self, session_id: str, entry: Entry) -> None:
        with self._lock:
            self._files.setdefault(session_id, {})[entry["file_id"]] = entry
            self._persist(session_id, entry)

    def session_files(self, session_id: str) -> list[Entry]:
        with self._lock:
            return list(self._files.get(session_id, {}).values())

    def remove_file(self, session_id: str, file_id: str) -> bool:
        with self._lock:
            bucket = self._files.get(session_id)
            if not bucket or file_id not in bucket:
                return False
            del bucket[file_id]
            self._unlink(session_id, file_id)
            return True

    def remove_session(self, session_id: str) -> None:
        with self._lock:
            self._files.pop(session_id, None)
            import shutil

            shutil.rmtree(os.path.join(self._root, session_id), ignore_errors=True)


index = IndexStore()