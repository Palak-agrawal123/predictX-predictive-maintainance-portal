"""
Master Ingestion Pipeline for PredictX RAG Service.
Coordinates loading, validation, parsing, preprocessing, chunking,
embedding generation, vector storage, and report generation.
"""
import json
import time
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

# Ensure rag_service is in sys.path
RAG_ROOT = Path(__file__).resolve().parent.parent
if str(RAG_ROOT) not in sys.path:
    sys.path.insert(0, str(RAG_ROOT))

from config import settings
from ingestion.document_loader import discover_documents
from ingestion.document_parser import parse_document
from chunking.chunking import SemanticChunker
from embeddings.embedding import embedding_engine
from vector_store.vector_store import vector_store

class IngestionPipeline:
    def __init__(self):
        self.chunker = SemanticChunker(
            target_chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP
        )

    def run_ingestion(self, documents_dir: Path = None, force_reindex: bool = False) -> Dict[str, Any]:
        start_time = time.time()
        target_dir = Path(documents_dir or settings.DOCUMENTS_DIR)
        
        print(f"\n==========================================")
        print(f"[IngestionPipeline] Starting ingestion from: {target_dir}")
        print(f"==========================================")

        if force_reindex:
            print("[IngestionPipeline] Force re-indexing requested: resetting vector collection.")
            vector_store.reset_collection()

        valid_files, rejected_files = discover_documents(target_dir)
        print(f"[IngestionPipeline] Discovered {len(valid_files)} valid file(s), {len(rejected_files)} rejected file(s).")

        processed_docs = []
        failed_docs = list(rejected_files)
        total_pages = 0
        total_chunks = 0
        all_generated_chunks = []

        for f in valid_files:
            try:
                print(f" -> Processing [{f.category}] {f.name}...")
                parsed_doc = parse_document(f.path, f.category)
                total_pages += parsed_doc.total_pages

                chunks = self.chunker.chunk_document(parsed_doc)
                total_chunks += len(chunks)
                all_generated_chunks.extend(chunks)

                processed_docs.append({
                    "document_id": parsed_doc.document_id,
                    "document_name": parsed_doc.document_name,
                    "category": parsed_doc.category,
                    "total_pages": parsed_doc.total_pages,
                    "total_chunks": len(chunks),
                    "file_hash": parsed_doc.file_hash
                })
            except Exception as e:
                print(f" [!] Error processing {f.name}: {e}")
                failed_docs.append({
                    "file_name": f.name,
                    "file_path": str(f.path),
                    "category": f.category,
                    "reason": str(e)
                })

        # Generate embeddings in batch and store in ChromaDB
        stored_embeddings_count = 0
        if all_generated_chunks:
            print(f"[IngestionPipeline] Generating embeddings for {len(all_generated_chunks)} text chunk(s)...")
            chunk_texts = [c.chunk_text for c in all_generated_chunks]
            embeddings = embedding_engine.embed_texts(chunk_texts, batch_size=32)
            
            print(f"[IngestionPipeline] Storing {len(embeddings)} vectors in ChromaDB...")
            stored_embeddings_count = vector_store.add_chunks(all_generated_chunks, embeddings)

        duration = round(time.time() - start_time, 2)
        
        report = {
            "ingestion_id": f"INGEST-{int(time.time())}",
            "timestamp": datetime.utcnow().isoformat(),
            "duration_seconds": duration,
            "total_discovered": len(valid_files) + len(rejected_files),
            "successfully_processed": len(processed_docs),
            "failed_documents_count": len(failed_docs),
            "total_pages_extracted": total_pages,
            "total_chunks_generated": total_chunks,
            "stored_embeddings_count": stored_embeddings_count,
            "current_collection_total": vector_store.get_collection_count(),
            "processed_documents": processed_docs,
            "failed_documents": failed_docs
        }

        # Save report to disk
        settings.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        report_path = settings.REPORTS_DIR / f"ingestion_report_{int(time.time())}.json"
        with open(report_path, "w", encoding="utf-8") as rf:
            json.dump(report, rf, indent=2)

        print(f"==========================================")
        print(f"[IngestionPipeline] Ingestion Complete in {duration}s!")
        print(f"Indexed Chunks: {stored_embeddings_count} | Report: {report_path.name}")
        print(f"==========================================\n")

        return report

# Global pipeline instance
ingestion_pipeline = IngestionPipeline()

if __name__ == "__main__":
    ingestion_pipeline.run_ingestion()
