"""
Intelligent Text Chunking Engine for PredictX RAG Pipeline.
Implements heading-aware recursive chunking with section hierarchy preservation,
page source references, configurable token/word boundaries, and idempotent chunk IDs.
"""
import hashlib
import re
from typing import List, Dict, Any
from ingestion.document_parser import ParsedDocument, ParsedPage

class TextChunk:
    def __init__(
        self,
        chunk_id: str,
        document_id: str,
        document_name: str,
        chunk_text: str,
        page_number: int,
        section_name: str,
        machine_type: str,
        component: str,
        category: str,
        chunk_index: int,
        metadata: Dict[str, Any] = None
    ):
        self.chunk_id = chunk_id
        self.document_id = document_id
        self.document_name = document_name
        self.chunk_text = chunk_text
        self.page_number = page_number
        self.section_name = section_name
        self.machine_type = machine_type
        self.component = component
        self.category = category
        self.chunk_index = chunk_index
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "document_name": self.document_name,
            "chunk_text": self.chunk_text,
            "page_number": self.page_number,
            "section_name": self.section_name,
            "machine_type": self.machine_type,
            "component": self.component,
            "category": self.category,
            "chunk_index": self.chunk_index,
            **self.metadata
        }

class SemanticChunker:
    def __init__(
        self,
        target_chunk_size: int = 500,
        chunk_overlap: int = 75,
        min_chunk_size: int = 80
    ):
        """
        target_chunk_size: Target words per chunk (approx 450-650 tokens).
        chunk_overlap: Overlap words between contiguous chunks.
        min_chunk_size: Minimum words required for an independent chunk.
        """
        self.target_chunk_size = target_chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size

    def split_page(
        self,
        page: ParsedPage,
        doc_id: str,
        doc_name: str,
        category: str,
        start_index: int
    ) -> List[TextChunk]:
        """
        Splits a single parsed page into semantically coherent, heading-anchored chunks.
        """
        text = page.text.strip()
        words = text.split()
        sec_name = page.section_name or category.replace("_", " ").title()

        # If page text fits comfortably, return as a single atomic chunk
        if len(words) <= self.target_chunk_size + 60:
            chunk_id = self._generate_chunk_id(doc_id, page.page_number, start_index, text)
            meta = {
                **page.metadata,
                "word_count": len(words),
                "is_atomic_page": True
            }
            chunk = TextChunk(
                chunk_id=chunk_id,
                document_id=doc_id,
                document_name=doc_name,
                chunk_text=text,
                page_number=page.page_number,
                section_name=sec_name,
                machine_type=page.metadata.get("machine_type", "GENERAL_INDUSTRIAL"),
                component=page.metadata.get("component", "GENERAL"),
                category=category,
                chunk_index=start_index,
                metadata=meta
            )
            return [chunk]

        # Paragraph-aware semantic splitting
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk_paragraphs = []
        current_word_count = 0
        idx = start_index

        for p in paragraphs:
            p_clean = p.strip()
            if not p_clean:
                continue

            p_words = len(p_clean.split())
            if current_word_count + p_words <= self.target_chunk_size or not current_chunk_paragraphs:
                current_chunk_paragraphs.append(p_clean)
                current_word_count += p_words
            else:
                # Emit chunk
                chunk_body = "\n\n".join(current_chunk_paragraphs)
                chunk_id = self._generate_chunk_id(doc_id, page.page_number, idx, chunk_body)
                meta = {
                    **page.metadata,
                    "word_count": current_word_count,
                    "is_atomic_page": False
                }
                chunks.append(TextChunk(
                    chunk_id=chunk_id,
                    document_id=doc_id,
                    document_name=doc_name,
                    chunk_text=chunk_body,
                    page_number=page.page_number,
                    section_name=sec_name,
                    machine_type=page.metadata.get("machine_type", "GENERAL_INDUSTRIAL"),
                    component=page.metadata.get("component", "GENERAL"),
                    category=category,
                    chunk_index=idx,
                    metadata=meta
                ))
                idx += 1

                # Carry over last paragraph if small for overlap, else start fresh
                if len(current_chunk_paragraphs[-1].split()) <= self.chunk_overlap * 1.5:
                    current_chunk_paragraphs = [current_chunk_paragraphs[-1], p_clean]
                    current_word_count = len(current_chunk_paragraphs[0].split()) + p_words
                else:
                    current_chunk_paragraphs = [p_clean]
                    current_word_count = p_words

        if current_chunk_paragraphs:
            chunk_body = "\n\n".join(current_chunk_paragraphs)
            chunk_id = self._generate_chunk_id(doc_id, page.page_number, idx, chunk_body)
            meta = {
                **page.metadata,
                "word_count": current_word_count,
                "is_atomic_page": False
            }
            chunks.append(TextChunk(
                chunk_id=chunk_id,
                document_id=doc_id,
                document_name=doc_name,
                chunk_text=chunk_body,
                page_number=page.page_number,
                section_name=sec_name,
                machine_type=page.metadata.get("machine_type", "GENERAL_INDUSTRIAL"),
                component=page.metadata.get("component", "GENERAL"),
                category=category,
                chunk_index=idx,
                metadata=meta
            ))

        return chunks

    def chunk_document(self, doc: ParsedDocument) -> List[TextChunk]:
        all_chunks = []
        chunk_idx = 0
        for page in doc.pages:
            page_chunks = self.split_page(page, doc.document_id, doc.document_name, doc.category, chunk_idx)
            all_chunks.extend(page_chunks)
            chunk_idx += len(page_chunks)
        return all_chunks

    def _generate_chunk_id(self, doc_id: str, page_num: int, chunk_idx: int, text: str) -> str:
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]
        return f"{doc_id}-P{page_num:02d}-C{chunk_idx:03d}-{content_hash}"
