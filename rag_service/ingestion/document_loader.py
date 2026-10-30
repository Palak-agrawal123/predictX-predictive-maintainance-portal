"""
Document Loader Module for PredictX RAG Pipeline.
Discovers and loads documents from categorized subdirectories.
"""
from pathlib import Path
from typing import List, Dict, Any, Tuple
from ingestion.document_validator import validate_document_file

SUPPORTED_CATEGORIES = [
    "nasa",
    "engine_manuals",
    "maintenance",
    "troubleshooting",
    "sensors",
    "research_papers",
    "historical_records"
]

class DiscoveredFile:
    def __init__(self, path: Path, category: str):
        self.path = path
        self.category = category
        self.name = path.name
        self.size_bytes = path.stat().st_size if path.exists() else 0

def discover_documents(documents_dir: Path) -> Tuple[List[DiscoveredFile], List[Dict[str, Any]]]:
    """
    Recursively scans documents_dir across all categories.
    Returns (valid_files, rejected_files).
    """
    valid_files = []
    rejected_files = []

    if not documents_dir.exists():
        return valid_files, rejected_files

    for item in documents_dir.rglob("*"):
        if item.is_file():
            # Determine category from parent directory relative to documents_dir
            rel_parent = item.parent.relative_to(documents_dir)
            category = str(rel_parent).replace("\\", "/").split("/")[0] if str(rel_parent) != "." else "general"
            
            is_valid, err_msg = validate_document_file(item)
            if is_valid:
                valid_files.append(DiscoveredFile(item, category))
            else:
                rejected_files.append({
                    "file_name": item.name,
                    "file_path": str(item),
                    "category": category,
                    "reason": err_msg
                })

    return valid_files, rejected_files
