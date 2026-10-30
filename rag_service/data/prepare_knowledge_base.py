"""
PredictX Knowledge Base Generator
Creates realistic technical documents across multiple categories in PDF, DOCX, and TXT formats.
"""
import os
import fitz  # PyMuPDF
from docx import Document
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent / "documents"

def create_pdf(file_path: Path, title: str, pages_content: list[tuple[str, str]]):
    """
    Creates a multi-page PDF using PyMuPDF.
    pages_content is a list of tuples: (heading, body_text)
    """
    doc = fitz.open()
    for idx, (heading, body) in enumerate(pages_content, 1):
        page = doc.new_page(width=595, height=842)  # A4 standard
        # Header banner
        page.draw_rect(fitz.Rect(40, 30, 555, 65), color=(0.1, 0.35, 0.25), fill=(0.1, 0.35, 0.25))
        page.insert_text(fitz.Point(50, 52), f"PREDICTX TECHNICAL MANUAL — {title.upper()}", fontsize=11, color=(1, 1, 1))
        
        # Section Heading
        page.insert_text(fitz.Point(40, 100), heading, fontsize=16, color=(0.1, 0.2, 0.15))
        
        # Body text with line wrapping
        rect = fitz.Rect(40, 120, 555, 780)
        page.insert_textbox(rect, body, fontsize=10, color=(0.15, 0.15, 0.15))
        
        # Footer
        page.insert_text(fitz.Point(40, 815), "CONFIDENTIAL & PROPRIETARY — PREDICTIVE MAINTENANCE SPECIFICATION", fontsize=8, color=(0.5, 0.5, 0.5))
        page.insert_text(fitz.Point(500, 815), f"Page {idx} of {len(pages_content)}", fontsize=8, color=(0.5, 0.5, 0.5))
    
    file_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(file_path))
    doc.close()
    print(f"[Created PDF] {file_path}")

def create_docx(file_path: Path, title: str, sections: list[tuple[str, str]]):
    """
    Creates a formatted DOCX document using python-docx.
    """
    doc = Document()
    doc.add_heading(f"PredictX Technical Specification: {title}", level=0)
    for heading, body in sections:
        doc.add_heading(heading, level=1)
        for p in body.split("\n\n"):
            if p.strip():
                doc.add_paragraph(p.strip())
    file_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(file_path))
    print(f"[Created DOCX] {file_path}")

def create_txt(file_path: Path, text: str):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text.strip() + "\n")
    print(f"[Created TXT] {file_path}")

def generate_all_knowledge():
    # 1. NASA C-MAPSS Specification (PDF and TXT)
    nasa_pages = [
        ("Section 1: NASA C-MAPSS Simulation Architecture and Operating Context",
         "The Commercial Modular Aero-Propulsion System Simulation (C-MAPSS) is a high-fidelity turbofan engine degradation modeling tool developed by NASA Glenn Research Center.\n\n"
         "The simulation model reflects a 90,000-lb thrust class twin-spool turbofan engine operating across varied operational regimes including sea level static, climb, cruise, and descent.\n\n"
         "1.1 Engine Spool Topology:\n"
         "- Low Pressure Spool: Fan (driven by Low Pressure Turbine, LPT) and Low Pressure Compressor (LPC). Monitored by physical fan speed sensor s_8 (Nf, nominal 2388 rpm) and corrected fan speed s_13 (NRf).\n"
         "- High Pressure Spool: High Pressure Compressor (HPC) driven by High Pressure Turbine (HPT). Monitored by core speed sensor s_9 (Nc, nominal 9065 rpm) and corrected core speed s_14 (NRc, nominal 8143 rpm).\n\n"
         "1.2 Operating Regimes and Environmental Envelope:\n"
         "Subsets FD001 and FD003 represent engines operating under a single nominal flight condition (sea level static).\n"
         "Subsets FD002 and FD004 encompass complex multi-regime profiles featuring 6 distinct flight operating clusters defined by altitude (0 to 42,000 ft), Mach number (0.0 to 0.84), and throttle resolver angle (TRA 60 to 100 degrees). Multi-regime engines require regime standardization before degradation assessment."),
        
        ("Section 2: Comprehensive Sensor Mapping and Baseline Operating Ranges",
         "The C-MAPSS telemetry acquisition stream records 21 continuous sensor parameters plus 3 operational setting channels:\n\n"
         "- s_1 (T2): Total temperature at fan inlet. Nominal: 518.67 R. Flat-line sensor in single-regime datasets.\n"
         "- s_2 (T24): Total temperature at LPC outlet. Healthy baseline: 642.68 R. Warning threshold: > 643.50 R (indicates LPC efficiency loss or blade fouling).\n"
         "- s_3 (T30): Total temperature at HPC outlet. Healthy baseline: 1590.52 R. Critical threshold: > 1605.0 R (strong indicator of HPC blade degradation and hot-section distress).\n"
         "- s_4 (T50): Total temperature at LPT outlet (Exhaust Gas Temperature - EGT). Healthy baseline: 1408.93 R. Critical threshold: > 1425.0 R. EGT margin deterioration directly correlates with remaining useful life.\n"
         "- s_6 (P15): Total pressure in bypass duct. Nominal: 21.61 psia.\n"
         "- s_7 (P30): Total pressure at HPC outlet. Healthy baseline: 553.37 psia. Decreases as compressor blade tips erode and clearances open up.\n"
         "- s_8 (Nf): Fan physical speed. Nominal: 2388.10 rpm.\n"
         "- s_9 (Nc): Core physical speed. Healthy baseline: 9065.24 rpm. Increases abnormally when core components degrade to maintain required thrust output.\n"
         "- s_11 (Ps30): Static pressure at HPC outlet. Baseline: 47.54 psia. Downward drift (> 0.5 psia drop) indicates HPC flow capacity degradation.\n"
         "- s_12 (phi): Fuel flow to Ps30 ratio. Baseline: 521.66 pps/psi.\n"
         "- s_15 (BPR): Bypass Ratio. Baseline: 8.44. Drifts upward as high-pressure core swallows less air due to constriction.\n"
         "- s_17 (htBleed): High-pressure bleed enthalpy. Baseline: 393.20 Btu/lbm.\n"
         "- s_20 (W31): HPT coolant bleed flow. Baseline: 38.81 lbm/s.\n"
         "- s_21 (W32): LPT coolant bleed flow. Baseline: 23.29 lbm/s."),

        ("Section 3: Failure Mechanisms and RUL Piecewise Progression",
         "3.1 High Pressure Compressor (HPC) Degradation:\n"
         "The predominant failure mode in C-MAPSS FD001 and FD002 is progressive HPC fouling and tip rubbing. Degradation manifests as simultaneous loss in flow capacity (up to -5%) and isentropic efficiency (up to -3%).\n\n"
         "3.2 Fan and Low Pressure Section Degradation:\n"
         "In FD003 and FD004, a secondary failure mode involves Fan degradation and LPC clearance increase, characterised by early divergence in s_2 (T24) and s_8 (Nf) rotor flutter.\n\n"
         "3.3 Piecewise Linear Target RUL Modeling:\n"
         "In early operational cycles, health degradation is undetectable. The standard NASA prognostic benchmark caps the ground truth Remaining Useful Life (RUL) at 125 cycles. Beyond the inflection cycle, RUL decays linearly to 0 at failure.\n"
         "Predicted RUL Risk Categories:\n"
         "- RUL > 85 cycles: Low Risk (Health Score 80-100%). Routine telemetry tracking.\n"
         "- RUL 50-85 cycles: Medium Risk (Health Score 60-79%). Plan inspection in next scheduled window.\n"
         "- RUL 25-50 cycles: High Risk (Health Score 35-59%). High priority inspection; order replacement parts.\n"
         "- RUL < 25 cycles: Critical Risk (Health Score 0-34%). Immediate operational safety alert and dispatch.")
    ]
    create_pdf(BASE_DIR / "nasa" / "nasa_cmapss_specification_manual.pdf", "NASA C-MAPSS Turbofan Engine Specification", nasa_pages)
    
    # 2. Engine Maintenance & Overhaul Manual (DOCX and TXT)
    engine_sections = [
        ("1. High Pressure Compressor (HPC) Maintenance and Borescope Standards",
         "The High Pressure Compressor assembly comprises stages 1 through 9. Degradation is accelerated by particulate ingestion, thermal cycling, and blade tip aerodynamic erosion.\n\n"
         "Inspection Protocol (Borescope):\n"
         "1. Insert flexible 4mm articulating video borescope through access ports CP-01 (stages 1-3), CP-02 (stages 4-6), and CP-03 (stages 7-9).\n"
         "2. Inspect leading edges for foreign object damage (FOD). Maximum allowable nick depth is 0.35 mm on rotor blades.\n"
         "3. Inspect blade tip clearances using calibrated visual gauge. Clearances exceeding 1.25 mm require compressor shroud segment replacement.\n"
         "4. If telemetry indicates static pressure s_11 (Ps30) drop exceeding 1.5% below baseline, perform immediate compressor wash.\n\n"
         "Compressor Wash Procedure:\n"
         "- Utilize approved aqueous demineralized surfactant solution heated to 60°C (140°F).\n"
         "- Motor engine on starter at cranking speed (approx. 18-22% Nc) with fuel and ignition deactivated.\n"
         "- Inject wash solution through manifold for 4 minutes, followed by a 10-minute soak, and a 6-minute clean-water rinse.\n"
         "- Dry run engine at idle for 15 minutes before returning to active operational service."),
        
        ("2. Turbine Hot Section and Exhaust Gas Temperature (EGT) Management",
         "The High Pressure Turbine (HPT) single-stage blade set operates under extreme temperatures exceeding 1600 R.\n\n"
         "EGT (s_4 / T50) Divergence Action Matrix:\n"
         "- Continuous EGT > 1415 R: Flag for thermal efficiency audit.\n"
         "- Continuous EGT > 1425 R: High risk alarm. Limit maximum power setting to 88% TRA.\n"
         "- Peak Transient EGT > 1445 R: Automatic work order creation. Ground machine for borescope inspection of HPT nozzle guide vanes and cooling film hole blockage.\n\n"
         "Thermal Barrier Coating (TBC) Loss Criteria:\n"
         "Loss of yttria-stabilized zirconia (YSZ) coating over greater than 15% of blade suction side surface mandates immediate rotor module replacement to prevent base nickel-alloy melting."),

        ("3. Lubrication, Bearing Chambers, and Chip Detection",
         "The engine oil subsystem lubricates bearings #1 through #5.\n\n"
         "Magnetic Chip Detectors (MCD):\n"
         "- Visual inspection required every 50 operating cycles.\n"
         "- Class A debris: Fine metallic sludge (< 0.1 mm) — Clean plug and resume service.\n"
         "- Class B debris: Flakes (0.1 mm - 0.5 mm) — Flush oil system, resample at 10-cycle interval.\n"
         "- Class C debris: Chunks, roller slivers, or bearing cage fragments (> 0.5 mm) — Immediate grounding. Teardown bearing chamber 2 and 3.\n\n"
         "Oil Filter Differential Pressure (Delta-P):\n"
         "Normal delta-P: 3 to 8 psid. If delta-P indicator pop-up button extends (> 15 psid), the filter bypass valve has opened. Replace filter element within 5 operating cycles.")
    ]
    create_docx(BASE_DIR / "engine_manuals" / "turbofan_engine_maintenance_manual.docx", "Turbofan Maintenance & Inspection Standards", engine_sections)
    
    # 3. Preventive Maintenance Procedures (TXT)
    preventive_txt = """PREDICTX INDUSTRIAL MAINTENANCE SOP: PREVENTIVE MAINTENANCE PROCEDURES
Document ID: SOP-PM-2026-V3
Classification: Standard Operating Procedure (ISO 55000 / AS9110)

1. PURPOSE & SCOPE
This procedure establishes standard preventive maintenance intervals, inspection checklists, and corrective action protocols for industrial machinery and turbofan assemblies monitored by the PredictX portal.

2. MAINTENANCE TIERS AND CYCLE INTERVALS
Tier 1: Daily Autonomous Telemetry Audit (Automated via PredictX)
- Real-time sensor stream validation.
- Anomaly detection on temperature differentials (Process Temp - Air Temp).
- Automatic flag if vibration RMS exceeds 2.8 mm/s or tool wear exceeds 150 minutes.

Tier 2: 100-Cycle Scheduled Preventive Maintenance (SPM-100)
- Visual inspection of all external plumbing, hydraulic lines, and electrical harnesses.
- Lubricant level and contamination check; take 100ml oil sample for laboratory spectrographic analysis.
- Check drive belt tension and inspect coupling elastomeric dampers for cracking.
- Verify calibration of thermocouple sensors (s_2, s_3, s_4) using precision calibrator.
- Clean cooling fan intake filters and radiator fins.

Tier 3: 300-Cycle Major Overhaul Maintenance (SPM-300)
- Borescope examination of internal stages (compressor blading, turbine nozzles, burner liners).
- Bearing raceway ultrasonic inspection; measure radial play and axial end-float.
- Spindle run-out verification on CNC machines: Maximum permissible total indicated runout (TIR) is 0.005 mm.
- Replace hydraulic return line filter and pneumatic coalescing elements.
- Execute full 5-point calibration across all 21 telemetry channels.

3. WORK ORDER DISPATCH PROTOCOL
When PredictX ML model outputs:
- Risk Tier 'CRITICAL' (Failure Probability >= 0.80 or RUL <= 25 cycles):
  -> Automatically generate Emergency Work Order (Priority 90-100).
  -> Dispatch technician within 2 hours. Lock machine out from continuous heavy-load operations.
- Risk Tier 'HIGH' (Failure Probability 0.50 - 0.79 or RUL 26-50 cycles):
  -> Generate Priority Work Order (Priority 60-89).
  -> Schedule maintenance action within 24-48 hours. Prepare replacement spares.
- Risk Tier 'MEDIUM' (Failure Probability 0.25 - 0.49 or RUL 51-85 cycles):
  -> Generate Routine Inspection Order (Priority 35-59).
  -> Review during next scheduled shift downtime.
"""
    create_txt(BASE_DIR / "maintenance" / "preventive_maintenance_procedures.txt", preventive_txt)

    # 4. Troubleshooting Guide: Overheating and Sensor Faults (PDF)
    trouble_pages = [
        ("Chapter 1: Industrial Overheating and Thermal Degradation Diagnosis",
         "Overheating is the leading catalyst for mechanical fatigue and lubrication film breakdown.\n\n"
         "1.1 Heat Dissipation Failure (HDF) Diagnostic Rules:\n"
         "- Rule 1: Temperature Delta Drop. Under steady load (Speed > 1400 rpm, Torque > 35 Nm), the difference between Process Temperature (T_proc) and Ambient Air Temperature (T_air) must remain strictly above 8.6 K.\n"
         "- If (T_proc - T_air) < 8.6 K while rotational speed is below 1380 rpm, cooling flow insufficiency is confirmed.\n"
         "- Common Causes:\n"
         "  1. Coolant pump impeller wear or drive belt slippage.\n"
         "  2. Bio-film or mineral scale accumulation in the internal heat exchanger tubes.\n"
         "  3. Thermal bypass valve stuck in recirculation mode.\n\n"
         "1.2 High-Pressure Compressor Thermal Divergence:\n"
         "- In turbofans, an abnormal increase in s_3 (T30) while fuel flow ratio s_12 (phi) remains constant points to internal gas recirculation across eroded blade tips.\n"
         "- If T30 rises above 1600 R accompanied by s_7 (P30) drop, shut down machine to prevent thermal surge."),
        
        ("Chapter 2: Root-Cause Fault Tree for Rotational & Bearing Anomalies",
         "Vibration analysis provides the earliest warning of rotating component degradation.\n\n"
         "Fault Tree 1: High Vibration (> 4.5 mm/s RMS):\n"
         "- Predominant frequency 1x RPM: Unbalance or rotor mass asymmetry. Clean rotor, perform field balancing.\n"
         "- Predominant frequency 2x RPM: Shaft misalignment or bent spindle. Verify dial indicator alignment across flexible coupling.\n"
         "- High-frequency broadband noise (2 kHz - 10 kHz): Bearing raceway pitting, micro-spalling, or lubrication starvation.\n\n"
         "Fault Tree 2: Rapid Tool Wear Failure (TWF) on CNC Spindles:\n"
         "- Wear threshold exceeded: Tool wear minutes > 200 min.\n"
         "- Combined metric: Torque (Nm) x Tool Wear (min) > 11,000.\n"
         "- Action: Emergency tool insert replacement; inspect workpiece surface roughness and spindle collet clamping force.")
    ]
    create_pdf(BASE_DIR / "troubleshooting" / "industrial_overheating_and_troubleshooting.pdf", "Industrial Troubleshooting & Thermal Diagnosis Guide", trouble_pages)

    # 5. Vibration Analysis Guide (TXT)
    vibration_txt = """VIBRATION ANALYSIS AND BEARING DEGRADATION GUIDE
Standard: ISO 10816-3 Mechanical Vibration Guidelines for Industrial Machines
Document Reference: VIB-SPEC-ISO10816

1. VIBRATION SEVERITY ZONES (RMS Velocity 10 Hz - 1000 Hz)
- Zone A (< 1.4 mm/s): Vibration of newly commissioned machinery. Excellent operating condition.
- Zone B (1.4 - 2.8 mm/s): Machines normally considered acceptable for unrestricted long-term operation.
- Zone C (2.8 - 4.5 mm/s): Machines considered unsatisfactory for long-term continuous operation. Machine may operate in restricted capacity until remedial maintenance can be scheduled.
- Zone D (> 4.5 mm/s): Vibration severity sufficient to cause rapid machine damage. Immediate trip and mandatory shutdown required.

2. BEARING DEFECT FREQUENCY CALCULATION
Rolling element bearings exhibit characteristic defect frequencies based on internal geometry (pitch diameter D, ball diameter d, number of rolling elements n, contact angle alpha):
- BPFO (Ball Pass Frequency Outer Race): BPFO = (n / 2) * RPM * (1 - (d / D) * cos(alpha))
- BPFI (Ball Pass Frequency Inner Race): BPFI = (n / 2) * RPM * (1 + (d / D) * cos(alpha))
- BSF (Ball Spin Frequency): BSF = (D / (2 * d)) * RPM * (1 - ((d / D) * cos(alpha))^2)
- FTF (Fundamental Train Frequency / Cage): FTF = (1 / 2) * RPM * (1 - (d / D) * cos(alpha))

3. VIBRATION SENSOR MOUNTING AND INTERPRETATION
- Accelerometers must be stud-mounted or magnetically attached directly to the bearing housing in the radial load zone.
- Never mount accelerometers onto sheet metal shrouds or flexible covers.
- In PredictX, vibration telemetry (vibrationMmS) is continuously evaluated against the 4.5 mm/s safety threshold.
"""
    create_txt(BASE_DIR / "sensors" / "vibration_analysis_bearing_guide.txt", vibration_txt)

    # 6. Sensor Documentation (TXT)
    sensors_txt = """PREDICTX INDUSTRIAL SENSOR SPECIFICATION AND CALIBRATION
Document ID: SPEC-SENSORS-2026

1. AIR & PROCESS TEMPERATURE SENSORS
- Sensor Type: Class A PT100 Platinum Resistance Temperature Detectors (RTD) and Type K Chromel-Alumel Thermocouples.
- Temperature Range: -50°C to +400°C (Process), -20°C to +80°C (Ambient Air).
- Calibration Tolerance: ±0.3°C.
- Diagnostic Rule: If process temperature exceeds 330 K (57°C) under nominal load, inspect coolant circulating loop.

2. SPINDLE SPEED & ROTATIONAL ENCODERS
- Sensor Type: Optical Incremental Shaft Encoder (1024 pulses per revolution).
- Output: Rotational speed in RPM.
- Normal Operating Range: 1400 - 1800 RPM.
- Low Speed Anomaly: Rotational speed dropping below 1380 RPM under constant torque demand indicates drive motor torque exhaustion or impending mechanical seizure.

3. TORQUE TRANSDUCERS
- Sensor Type: Non-contact rotary strain-gauge telemetry transducer.
- Range: 0 - 100 Nm.
- Normal Range: 30 - 55 Nm.
- High Torque Anomaly: Torque exceeding 60 Nm indicates mechanical binding, blunt tool edge, or insufficient lubrication in guideways.

4. TOOL WEAR MONITORING
- Measured in cumulative engaged cutting minutes.
- Advisory threshold: 180 minutes.
- Critical tool change threshold: 220 minutes.
- Excessive wear causes severe thermal buildup and part dimensional out-of-tolerance errors.
"""
    create_txt(BASE_DIR / "sensors" / "industrial_sensor_specifications.txt", sensors_txt)

    # 7. Research Paper on RUL Estimation (PDF)
    rul_pages = [
        ("1. Principles of Remaining Useful Life (RUL) Prediction in Turbomachinery",
         "Abstract: Accurate Remaining Useful Life (RUL) estimation is essential for condition-based maintenance and zero-unplanned-downtime manufacturing.\n\n"
         "1.1 Prognostic Modeling Framework:\n"
         "Prognostics models the transformation of healthy equipment into failed equipment over time.\n"
         "Let X_t = [s_1(t), s_2(t), ..., s_p(t)] represent the multi-channel sensor observation vector at cycle t.\n"
         "The health index H(t) in [0, 1] tracks continuous degradation:\n"
         "H(t) = 1.0 - integral(dD/dt * dt, from 0 to t)\n\n"
         "1.2 Attention-CNN-BiLSTM Architecture for Multi-Regime RUL Estimation:\n"
         "Recent breakthroughs in deep learning combine 1D-CNNs for local feature extraction with Bidirectional LSTMs for long-range temporal degradation context.\n"
         "Self-attention pooling dynamically weights critical degradation inflection cycles, resulting in superior performance on NASA C-MAPSS FD002 and FD004 subsets.\n"
         "Validation benchmarks demonstrate an RMSE drop to 27.08 cycles on FD002 compared to 42.1 cycles for standard Multi-Layer Perceptrons."),

        ("2. Degradation Inflection and Paris' Crack Propagation Mechanics",
         "2.1 Paris-Erdogan Fatigue Crack Growth Law:\n"
         "Sub-surface rolling contact fatigue (RCF) in bearings and compressor blade roots follows:\n"
         "da/dN = C * (Delta K)^m\n"
         "where 'a' is crack depth, 'N' is cycles, 'Delta K' is stress intensity factor range, and C, m are material constants.\n\n"
         "2.2 Practical Maintenance Implications:\n"
         "- Phase I (Micro-crack initiation): Sensor telemetry remains indistinguishable from healthy baseline (cycles 0 to ~100).\n"
         "- Phase II (Stable crack growth): High-frequency vibration and slight temperature drift emerge (cycles 100 to ~160).\n"
         "- Phase III (Accelerated propagation): Severe vibration, rapid EGT escalation, and acute failure risk (cycles 160 to failure).\n"
         "Maintenance action MUST be scheduled before Phase III begins.")
    ]
    create_pdf(BASE_DIR / "research_papers" / "rul_prognostics_turbomachinery_paper.pdf", "Remaining Useful Life Research & Prognostic Modeling", rul_pages)

    # 8. Historical Maintenance Reports (TXT)
    history_txt = """PREDICTX FLEET HISTORICAL MAINTENANCE INCIDENT RECORDS
Archive Reference: HIST-INC-ARCHIVE-2024-2026
Confidential Plant Operations Database

---
INCIDENT REPORT: INC-2025-089
Machine ID: UNIT-12 (Turbofan Engine Assembly #12)
Date: 2025-08-14
Reported Symptoms:
Core exhaust gas temperature (T50) climbed steadily from 1409 R to 1438 R over 18 operating cycles. Static pressure Ps30 dropped by 2.2 psia.
Predicted RUL at detection: 19 cycles (Critical Risk tier).
Physical Findings:
Borescope inspection CP-03 revealed stage 7 and 8 compressor blade tip erosion exceeding 1.6 mm due to sandy particulate ingestion. Significant stator rubbing noted.
Action Taken:
Engine removed from wing/mount. HPC module replaced with freshly overhauled unit. All engine telemetry returned to nominal baseline. Zero unscheduled inflight shutdown occurred.

---
INCIDENT REPORT: INC-2025-114
Machine ID: MCH-102 (Heavy Hydraulic Press & Spindle)
Date: 2025-11-02
Reported Symptoms:
Process temperature rose to 326 K while ambient temperature was 301 K. Vibration accelerometer recorded 4.8 mm/s RMS (Zone D).
Predicted RUL: 12 days (Critical Risk tier).
Physical Findings:
Drive spindle main bearing lubrication line was partially blocked by oxidized oil sludge. Outer bearing raceway exhibited severe flaking (BPFO frequency dominant in FFT).
Action Taken:
Emergency shutdown executed. Spindle bearings replaced, lubrication lines power-flushed, and synthetic ISO VG 68 oil refilled. Vibration dropped to 1.1 mm/s RMS (Zone A).

---
INCIDENT REPORT: INC-2026-022
Machine ID: MCH-105 (Precision CNC Mill)
Date: 2026-02-18
Reported Symptoms:
Torque telemetry surged to 68 Nm during roughing pass. Tool wear reading reached 228 minutes.
Predicted RUL: 8 hours (Critical Risk tier).
Physical Findings:
Carbide tool insert had chipped and friction-welded to workpiece holder, causing acute spindle overload.
Action Taken:
Emergency Tool Change procedure executed. Replaced toolholder and calibrated dynamic spindle balance. Updated preventive maintenance rule to enforce mandatory insert swap at 180 minutes.
"""
    create_txt(BASE_DIR / "historical_records" / "turbofan_fleet_maintenance_history.txt", history_txt)

    print("\n[SUCCESS] Knowledge base document generation complete!")

if __name__ == "__main__":
    generate_all_knowledge()
