"""
Quick verification test for PredictX retrieval pipeline.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from retrieval.retrieval_pipeline import retrieval_pipeline

test_queries = [
    "Why is the engine temperature increasing?",
    "What is the vibration limit under ISO 10816-3?",
    "Explain High Pressure Compressor blade tip erosion limits and borescope inspection.",
    "What should I inspect if tool wear exceeds 200 minutes?"
]

print("\n--- RUNNING HYBRID RETRIEVAL VERIFICATION ---")
for q in test_queries:
    res = retrieval_pipeline.retrieve(q, top_k=2)
    print(f"\nQUERY: {q}")
    print(f"Context Found: {res['has_sufficient_context']} | Max Relevance: {res['max_relevance_score']} | Latency: {res['retrieval_latency_ms']}ms")
    for c in res['chunks']:
        print(f"  * [{c['document_name']} | Page {c['page_number']}] (Score: {c['relevance_score']})")
        print(f"    Excerpt: {c['text'][:140]}...")
print("\n--- RETRIEVAL TEST COMPLETE ---")
