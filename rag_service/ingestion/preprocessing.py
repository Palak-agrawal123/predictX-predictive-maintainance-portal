"""
Text Preprocessing Module for PredictX RAG Pipeline.
Cleans raw extracted text while preserving technical industrial terminology,
sensor identifiers, numerical thresholds, engineering units, and structural headings.
"""
import re
import unicodedata

# Common header/footer noise patterns to filter
HEADER_FOOTER_PATTERNS = [
    r"CONFIDENTIAL & PROPRIETARY[^\n]*",
    r"PREDICTX TECHNICAL MANUAL[^\n]*",
    r"Page\s+\d+\s+of\s+\d+",
    r"All Rights Reserved[^\n]*",
]

def clean_text(text: str) -> str:
    """
    Standardizes and cleans text without losing technical engineering data.
    """
    if not text or not isinstance(text, str):
        return ""

    # 1. Normalize Unicode characters (e.g. standardizing accents, non-breaking spaces)
    normalized = unicodedata.normalize("NFKC", text)

    # 2. Normalize CRLF to LF
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")

    # 3. Strip known repetitive header/footer artifacts
    for pattern in HEADER_FOOTER_PATTERNS:
        normalized = re.sub(pattern, "", normalized, flags=re.IGNORECASE)

    # 4. Normalize excessive newlines (keep maximum 2 to preserve paragraphs)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)

    # 5. Normalize inline whitespace (multiple spaces/tabs to single space, except newlines)
    lines = []
    for line in normalized.split("\n"):
        cleaned_line = re.sub(r"[ \t]+", " ", line).strip()
        lines.append(cleaned_line)

    result = "\n".join(lines).strip()
    return result

def is_meaningful_text(text: str, min_chars: int = 25) -> bool:
    """
    Validates whether extracted text contains sufficient alphanumeric content.
    """
    if not text:
        return False
    alphanumeric_count = sum(c.isalnum() for c in text)
    return alphanumeric_count >= min_chars

def extract_headings(text: str) -> list[str]:
    """
    Identifies major section headings in the text.
    """
    headings = []
    for line in text.split("\n"):
        line_clean = line.strip()
        if not line_clean:
            continue
        # Match lines like "Section 1: ...", "Chapter 2: ...", "1.1 ...", "# Heading"
        if re.match(r"^(#+|Section\s+\d+|Chapter\s+\d+|\d+\.\d+|\d+\.)\s+", line_clean, re.IGNORECASE):
            headings.append(line_clean)
        elif len(line_clean) < 70 and line_clean.isupper() and len(line_clean) > 5:
            headings.append(line_clean)
    return headings
