"""
Draft Maintenance Work Order (MWO) Generator.
Produces standardized, production-grade work orders for plant managers and maintenance crews.
"""
from datetime import datetime
from typing import Dict, Any

def generate_work_order(
    unit_id: int,
    current_cycle: int,
    predicted_rul: float,
    risk_info: Dict[str, Any],
    diag_info: Dict[str, Any],
    assigned_crew: str = "Alpha Rapid Response Mechanical Team",
    plant_location: str = "Meridian Propulsion Center - Production Bay 04"
) -> Dict[str, Any]:
    """
    Generate a complete, auditable maintenance work order for a high-risk machine.
    """
    wo_id = f"MWO-2026-U{unit_id:03d}-{risk_info['risk_tier'][:4]}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Estimate operating calendar days until failure (assuming ~2 cycles per operational day)
    est_days_left = max(1, int(predicted_rul / 2))

    # Determine recommended tooling and parts based on component
    comp = diag_info["primary_component"]
    if "Compressor" in comp:
        parts_list = [
            "HPC Stage 4-9 Rotor Blade Set (P/N: MER-HPC-8842)",
            "Stator Vane Segment Assemblies (P/N: MER-STV-9102)",
            "High-Pressure C-Duct O-Ring & Seal Kit (P/N: MER-SL-402)",
            "Compressor Eco-Wash Detergent Solution Type B"
        ]
        tooling = "Olympus IPLEX G Lite Borescope (3.9mm articulation), Digital Torque Multiplier, Blade Blend Tool Kit"
    elif "Fan" in comp:
        parts_list = [
            "Titanium Fan Blade Set (Matched Pair P/N: MER-FAN-1108)",
            "Fan Hub Retaining Ring & Lockwire Kit (P/N: MER-FHR-204)",
            "Acoustic Liner Dampener Strips (P/N: MER-ACL-055)"
        ]
        tooling = "Precision Dynamic Rotor Balancer, Optical Blade Profiler, 500 ft-lb Hydraulic Tensioner"
    elif "Turbine" in comp:
        parts_list = [
            "HPT Stage 1 Single-Crystal Nozzle Guide Vanes (P/N: MER-NGV-7731)",
            "Turbine Shroud Ceramic Thermal Barrier Tiles (P/N: MER-TBC-330)",
            "High-Temp Inconel Fastener Overhaul Pack (P/N: MER-INC-991)"
        ]
        tooling = "Hot-Section UV Dye-Penetrant Kit, Laser Blade Pyrometer, High-Temp Boroscope Probe"
    else:
        parts_list = [
            "Fuel Spray Nozzle Manifold Set (P/N: MER-FNM-5520)",
            "Bleed Air Solenoid Valve Actuator (P/N: MER-BLV-4412)",
            "Primary & Secondary High-Pressure Fuel Filters (P/N: MER-FFL-109)"
        ]
        tooling = "Fuel Differential Pressure Gauge Rig, Calibration Multi-Meter, Flow Test Bench"

    # Top anomalies summary
    anomalies_str = ""
    for s in diag_info.get("top_anomalous_sensors", []):
        anomalies_str += f"- **{s['sensor_name']}** ({s['description']}): {s['current']} {s['unit']} vs baseline {s['baseline']} {s['unit']} ({s['pct_change']:+.2f}% drift, Z-score {s['z_score']})\n"

    work_order_data = {
        "wo_id": wo_id,
        "created_at": now_str,
        "organization": "Meridian",
        "theme": "DIGITAL ODYSSEY - Predictive Maintenance",
        "facility": plant_location,
        "asset_id": f"Turbofan Unit #{unit_id:03d}",
        "current_cycle": current_cycle,
        "predicted_rul_cycles": round(predicted_rul, 1),
        "estimated_days_to_service": est_days_left,
        "risk_tier": risk_info["risk_tier"],
        "risk_score_pct": risk_info["risk_score_pct"],
        "priority_level": risk_info["priority"],
        "assigned_crew": assigned_crew,
        "primary_failing_component": diag_info["primary_component"],
        "diagnosis_confidence": diag_info["confidence"],
        "symptoms": diag_info["symptoms"],
        "wear_pattern": diag_info["wear_pattern"],
        "recommended_action": diag_info["recommended_action"],
        "parts_required": parts_list,
        "tooling_required": tooling,
        "anomalous_sensors_text": anomalies_str,
        "safety_protocols": [
            "Mandatory Lockout / Tagout (LOTO) on primary power bus & pneumatic feeds.",
            "Enforce 4-hour thermal cool-down period (EGT must drop below 45°C before inspection).",
            "Mandatory Level 3 PPE: Arc-flash shield, flame-retardant overalls, Kevlar gloves, steel-toe boots.",
            "Confirm grounding cable attachment to avoid electrostatic fuel discharge."
        ],
        "work_steps": [
            f"Step 1: Isolate Turbofan Unit #{unit_id:03d} and log initial diagnostic codes.",
            f"Step 2: Inspect {diag_info['primary_component']} via optical borescope port.",
            "Step 3: Document visual blade erosion, clearance gap, and thermal discoloration.",
            f"Step 4: Execute replacement / refurbishment of designated components: {', '.join(parts_list[:2])}.",
            "Step 5: Verify torque specifications on all casing joints and bleed manifolds.",
            "Step 6: Perform static pressure integrity test followed by a 15-minute nominal ground idle run-up.",
            "Step 7: Clear predictive maintenance alert flag in Meridian Portal and sign off work order."
        ],
        "status": "DRAFT - PENDING SUPERVISOR DISPATCH"
    }

    return work_order_data

def format_work_order_markdown(wo: Dict[str, Any]) -> str:
    """
    Format work order as a professional markdown report.
    """
    parts_formatted = "\n".join([f"- [ ] {p}" for p in wo["parts_required"]])
    safety_formatted = "\n".join([f"- **WARNING**: {s}" for s in wo["safety_protocols"]])
    steps_formatted = "\n".join([f"{s}" for s in wo["work_steps"]])

    md = f"""# 🛠️ MERIDIAN PREDICTIVE MAINTENANCE WORK ORDER
**Work Order ID:** `{wo['wo_id']}` | **Status:** `{wo['status']}`  
**Organization:** {wo['organization']} | **Theme:** {wo['theme']}  
**Generated On:** {wo['created_at']} | **Priority:** **{wo['priority_level']}**

---

### 1. Equipment & Operational Status
| Parameter | Value | Parameter | Value |
| :--- | :--- | :--- | :--- |
| **Asset Identifier** | {wo['asset_id']} | **Plant Location** | {wo['facility']} |
| **Current Operating Cycle** | {wo['current_cycle']} cycles | **Assigned Crew** | {wo['assigned_crew']} |
| **Predicted RUL** | **{wo['predicted_rul_cycles']} cycles** | **Service Window** | **≤ {wo['estimated_days_to_service']} calendar days** |
| **Risk Score** | **{wo['risk_score_pct']}% ({wo['risk_tier']})** | **Confidence** | {wo['diagnosis_confidence']}% |

---

### 2. Diagnostic Telemetry & Root Cause Attribution
- **Target Failing Component:** **{wo['primary_failing_component']}**
- **Degradation Pattern:** {wo['wear_pattern']}
- **Primary Telemetry Signature:** {wo['symptoms']}

#### Observed Sensor Anomalies vs Healthy Baseline:
{wo['anomalous_sensors_text']}

---

### 3. Required Materials & Specialized Tooling
#### Bill of Materials (BOM):
{parts_formatted}

#### Specialized Tooling:
- `{wo['tooling_required']}`

---

### 4. Safety & LOTO Protocol
{safety_formatted}

---

### 5. Maintenance Execution Protocol
{steps_formatted}

---

### 6. Sign-off & Quality Assurance
- **Maintenance Lead Signature:** ___________________________  **Date:** ____________
- **Plant Operations Manager:** ___________________________  **Date:** ____________
- **Post-Service Verification Status:** `[ ] PASSED - RETURN TO SERVICE`  `[ ] REJECTED`
"""
    return md
