import re

_WORD_RE = re.compile(r"[a-z0-9]+")


def _stem(word: str) -> str:
    if len(word) > 4:
        for suffix in ("ing", "ed", "es"):
            if word.endswith(suffix) and len(word) - len(suffix) >= 3:
                return word[: -len(suffix)]
        if word.endswith("ly") and len(word) - 2 >= 3:
            return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def tokenize(text: str) -> set[str]:
    return {_stem(w) for w in _WORD_RE.findall(text.lower()) if len(w) > 1}
