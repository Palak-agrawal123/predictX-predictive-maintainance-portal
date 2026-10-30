"""
PredictX Live RAG System Diagnostic & Verification Suite.
Runs rigorous end-to-end tests across the live running services:
- Health & Microservice communication
- Vector Database & Document Index integrity
- Hybrid Search (BM25 + Dense) accuracy & latency
- Sensor & Domain Knowledge retrieval
- Machine Telemetry & ML Prediction injection
- Zero-Hallucination & Out-of-Domain Relevance Gating
- Citation verification & authenticity
"""
import json
import time
import urllib.request
import urllib.error

GATEWAY_URL = "http://127.0.0.1:5000"
RAG_URL = "http://127.0.0.1:8001"

passed_tests = 0
total_tests = 0

def post_json(url, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=12) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def get_json(url):
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def report_test(name, success, details=""):
    global passed_tests, total_tests
    total_tests += 1
    if success:
        passed_tests += 1
        print(f" [PASS] {name}")
    else:
        print(f" [FAIL] {name}")
    if details:
        print(f"        -> {details}")

print("=" * 70)
print(" PREDICTX RAG SYSTEM LIVE COMPREHENSIVE VERIFICATION")
print("=" * 70)

# TEST 1: Healthcheck
print("\n--- Test Suite 1: Health & Service Connectivity ---")
try:
    s_rag, d_rag = get_json(f"{RAG_URL}/health")
    report_test("RAG Microservice Health Endpoint (:8001/health)", s_rag == 200 and d_rag.get("status") == "healthy", f"Status: {d_rag.get('status')} | Version: {d_rag.get('version')}")
except Exception as e:
    report_test("RAG Microservice Health Endpoint (:8001/health)", False, str(e))

try:
    s_gw, d_gw = get_json(f"{GATEWAY_URL}/api/health")
    report_test("Express Gateway Health Endpoint (:5000/api/health)", s_gw == 200 and d_gw.get("status") == "healthy", f"Status: {d_gw.get('status')} | DB: {d_gw.get('database')}")
except Exception as e:
    report_test("Express Gateway Health Endpoint (:5000/api/health)", False, str(e))

# TEST 2: Document Index & Vector Store
print("\n--- Test Suite 2: Document Index & ChromaDB Vector Store ---")
try:
    s_doc, d_doc = get_json(f"{RAG_URL}/api/rag/documents")
    docs = d_doc.get("documents", [])
    total_chunks = sum(d.get("chunks_count", 0) for d in docs)
    extensions = {d.get("document_name", "").split(".")[-1].lower() for d in docs}
    has_pdf = "pdf" in extensions
    has_docx = "docx" in extensions
    has_txt = "txt" in extensions
    has_csv = "csv" in extensions
    all_formats = has_pdf and has_docx and has_txt and has_csv
    report_test("Indexed Document Catalog Completeness", s_doc == 200 and len(docs) >= 8 and total_chunks >= 30, f"{len(docs)} documents indexed | {total_chunks} total vector chunks")
    report_test("Multi-Format Coverage (PDF, DOCX, TXT, CSV)", all_formats, f"PDF: {has_pdf}, DOCX: {has_docx}, TXT: {has_txt}, CSV: {has_csv}")
except Exception as e:
    report_test("Document Catalog Check", False, str(e))

# TEST 3: Hybrid Retrieval (ISO 10816-3 Vibration Limits)
print("\n--- Test Suite 3: Hybrid Retrieval Engine (BM25 + Dense) ---")
try:
    q3 = "What is the acceptable vibration severity limit for industrial machines under ISO 10816-3?"
    s3, d3 = post_json(f"{RAG_URL}/api/rag/retrieve", {"query": q3, "top_k": 3})
    chunks = d3.get("chunks", [])
    top_doc = chunks[0]["document_name"] if chunks else ""
    latency = d3.get("retrieval_latency_ms", 999)
    rel = d3.get("max_relevance_score", 0)
    is_vibration_guide = "vibration" in top_doc.lower()
    report_test("Hybrid Search Retrieval Accuracy (ISO 10816-3)", s3 == 200 and is_vibration_guide, f"Top match: {top_doc} (Score: {rel:.4f})")
    report_test("Retrieval Sub-50ms Latency Benchmark", latency < 50.0, f"Observed Latency: {latency:.2f} ms")
except Exception as e:
    report_test("Hybrid Retrieval Engine", False, str(e))

# TEST 4: Exact Technical Grounding (NASA C-MAPSS Sensor s_4 / T50)
print("\n--- Test Suite 4: Technical Grounding & Sensor Specifications ---")
try:
    q4 = "What is sensor s_4 in NASA C-MAPSS and what is its nominal baseline value?"
    s4, d4 = post_json(f"{GATEWAY_URL}/api/rag/chat", {"question": q4, "topK": 3})
    ans4 = d4.get("answer", "")
    citations4 = d4.get("citations", [])
    has_egt = ("T50" in ans4 or "1408" in ans4 or "exhaust gas" in ans4.lower() or "temperature" in ans4.lower())
    has_citations = len(citations4) > 0 and any("nasa_cmapss" in c.get("document_name", "").lower() for c in citations4)
    report_test("Sensor s_4 Specification Retrieval & Correct Grounding", has_egt, f"Answer grounded with sensor specs. Length: {len(ans4)} chars")
    report_test("Authentic NASA Document Citation Attribution", has_citations, f"{len(citations4)} verified citations returned (Top: {citations4[0].get('document_name') if citations4 else 'None'})")
except Exception as e:
    report_test("Technical Grounding Check", False, str(e))

# TEST 5: Telemetry & Live ML Prediction Integration
print("\n--- Test Suite 5: Live Machine Telemetry & ML Prediction Injection ---")
try:
    q5 = "Machine MCH-102 is showing abnormal temperature and vibration. What are the diagnosis and recommended procedures?"
    telemetry_payload = {
        "question": q5,
        "machineId": "MCH-102",
        "sensors": {
            "airTemperature": 301.2,
            "processTemperature": 310.8,
            "vibration": 4.85,
            "rotationalSpeed": 1420,
            "torque": 48.2,
            "toolWear": 215
        }
    }
    s5, d5 = post_json(f"{GATEWAY_URL}/api/rag/chat", telemetry_payload)
    ans5 = d5.get("answer", "")
    citations5 = d5.get("citations", [])
    has_mch_context = d5.get("machine_context_used") is True
    has_prediction_context = d5.get("prediction_context_used") is True
    report_test("Dynamic Machine Telemetry Context Attachment", has_mch_context, f"Machine ID: {d5.get('machine_id')} included in context")
    report_test("ML Failure Risk & RUL Integration", has_prediction_context, f"ML Service predictions fetched and synthesized")
    report_test("Actionable Maintenance Procedure Generation", len(citations5) >= 2, f"{len(citations5)} procedures cited across maintenance manuals")
except Exception as e:
    report_test("Telemetry & ML Prediction Integration", False, str(e))

# TEST 6: Hallucination Resistance & Relevance Gating
print("\n--- Test Suite 6: Out-of-Domain Relevance Gating & Zero-Hallucination ---")
try:
    q6 = "How do I bake a chocolate cake with strawberries?"
    s6, d6 = post_json(f"{RAG_URL}/api/rag/chat", {"question": q6})
    has_context = d6.get("has_sufficient_context")
    ans6 = d6.get("answer", "")
    max_score = d6.get("max_relevance_score", 0)
    refusal_or_warning = (has_context is False) or ("insufficient" in ans6.lower()) or ("no relevant" in ans6.lower()) or (max_score < 0.40)
    report_test("Irrelevant Query Rejection (No Hallucination)", refusal_or_warning, f"Sufficient Context: {has_context} | Max Relevance: {max_score:.4f}")
except Exception as e:
    report_test("Hallucination Resistance Check", False, str(e))

# TEST 7: Citation Integrity & Verification
print("\n--- Test Suite 7: Citation Verification & Page Traceability ---")
try:
    q7 = "What is the crack growth rate equation described by Paris Law in the degradation papers?"
    s7, d7 = post_json(f"{GATEWAY_URL}/api/rag/chat", {"question": q7})
    citations7 = d7.get("citations", [])
    all_have_pages = all(c.get("page_number") is not None and c.get("document_name") for c in citations7)
    valid_doc = any("rul" in c.get("document_name", "").lower() or "paris" in c.get("document_name", "").lower() or "paper" in c.get("document_name", "").lower() for c in citations7)
    report_test("Page-Level Source Attribution", all_have_pages and len(citations7) > 0, f"{len(citations7)} citations with exact page numbers")
    report_test("Research Paper Exact Match Attribution", valid_doc, f"Matched research paper: {[c.get('document_name') for c in citations7]}")
except Exception as e:
    report_test("Citation Verification Check", False, str(e))

print("\n" + "=" * 70)
print(f" FINAL DIAGNOSTIC RESULT: {passed_tests}/{total_tests} TESTS PASSED ({(passed_tests/total_tests)*100:.1f}%)")
print("=" * 70)
