"""
Document Validation Module for PredictX RAG Pipeline.
Validates file extensions, file sizes, readability, and SHA-256 duplicate detection.
"""
import hashlib
from pathlib import Path
from typing import Tuple, Optional

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv"}
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

def compute_file_hash(file_path: Path) -> str:
    """
    Computes SHA-256 hash of a file for exact duplicate prevention.
    """
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def compute_text_hash(text: str) -> str:
    """
    Computes SHA-256 hash of extracted text string.
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def validate_document_file(file_path: Path) -> Tuple[bool, Optional[str]]:
    """
    Validates file existence, format, and size.
    Returns (is_valid, error_message).
    """
    if not file_path.exists():
        return False, f"File does not exist: {file_path}"

    if not file_path.is_file():
        return False, f"Path is not a regular file: {file_path}"

    suffix = file_path.suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        return False, f"Unsupported file extension '{suffix}'. Allowed: {ALLOWED_EXTENSIONS}"

    try:
        size = file_path.stat().st_size
    except Exception as e:
        return False, f"Unable to read file metadata: {e}"

    if size == 0:
        return False, "File is completely empty (0 bytes)"

    if size > MAX_FILE_SIZE_BYTES:
        return False, f"File size ({size / (1024*1024):.2f} MB) exceeds maximum allowed limit of 25 MB"

    return True, None
