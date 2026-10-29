"""
Configuration and constants for Meridian Predictive Maintenance Portal
NASA C-MAPSS Turbofan Engine Dataset
"""
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "CMaps"
MODELS_DIR = BASE_DIR / "models"

# Dataset column schema
ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTING_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_RAW_COLS = [ID_COL, CYCLE_COL] + SETTING_COLS + SENSOR_COLS

# Detailed sensor metadata
SENSOR_METADATA = {
    "s_1": {"name": "T2", "desc": "Total temp at fan inlet", "unit": "°R", "varies": False},
    "s_2": {"name": "T24", "desc": "Total temp at LPC outlet", "unit": "°R", "varies": True},
    "s_3": {"name": "T30", "desc": "Total temp at HPC outlet", "unit": "°R", "varies": True},
    "s_4": {"name": "T50", "desc": "Total temp at LPT outlet", "unit": "°R", "varies": True},
    "s_5": {"name": "P2", "desc": "Total pressure at fan inlet", "unit": "psia", "varies": False},
    "s_6": {"name": "P15", "desc": "Total pressure in bypass-duct", "unit": "psia", "varies": False},
    "s_7": {"name": "P30", "desc": "Total pressure at HPC outlet", "unit": "psia", "varies": True},
    "s_8": {"name": "Nf", "desc": "Physical fan speed", "unit": "rpm", "varies": True},
    "s_9": {"name": "Nc", "desc": "Physical core speed", "unit": "rpm", "varies": True},
    "s_10": {"name": "epr", "desc": "Engine pressure ratio (P50/P2)", "unit": "--", "varies": False},
    "s_11": {"name": "Ps30", "desc": "Static pressure at HPC outlet", "unit": "psia", "varies": True},
    "s_12": {"name": "Phi", "desc": "Ratio of fuel flow to Ps30", "unit": "pps/psi", "varies": True},
    "s_13": {"name": "NRf", "desc": "Corrected fan speed", "unit": "rpm", "varies": True},
    "s_14": {"name": "NRc", "desc": "Corrected core speed", "unit": "rpm", "varies": True},
    "s_15": {"name": "BPR", "desc": "Bypass Ratio", "unit": "--", "varies": True},
    "s_16": {"name": "farB", "desc": "Burner fuel-air ratio", "unit": "--", "varies": False},
    "s_17": {"name": "htBleed", "desc": "Bleed Enthalpy", "unit": "btu/lb", "varies": True},
    "s_18": {"name": "Nf_dmd", "desc": "Demanded fan speed", "unit": "rpm", "varies": False},
    "s_19": {"name": "PCNfR_dmd", "desc": "Demanded corrected fan speed", "unit": "rpm", "varies": False},
    "s_20": {"name": "W31", "desc": "HPT coolant bleed", "unit": "lbm/s", "varies": True},
    "s_21": {"name": "W32", "desc": "LPT coolant bleed", "unit": "lbm/s", "varies": True},
}

# Informative sensors (excluding flat sensors with std near 0 in standard conditions)
ACTIVE_SENSORS = [s for s, meta in SENSOR_METADATA.items() if meta["varies"]]

# Subsystem component mapping for failure diagnosis & root-cause attribution
SUBSYSTEM_MAP = {
    "High Pressure Compressor (HPC)": {
        "sensors": ["s_3", "s_7", "s_11", "s_9", "s_14"],
        "primary_symptom": "Elevated HPC discharge temperature (T30) and abnormal static pressure ratio (Ps30)",
        "wear_pattern": "Blade fouling, tip clearance degradation, compressor stall margin reduction",
        "recommended_action": "Borescope inspection of stages 4-9; compressor wash; replace eroded blade sets",
    },
    "Fan & Low-Pressure Compressor (LPC)": {
        "sensors": ["s_2", "s_8", "s_13", "s_15"],
        "primary_symptom": "Disrupted bypass ratio (BPR) and fan speed variance (Nf / NRf)",
        "wear_pattern": "Fan blade leading edge erosion, acoustic liner damage, booster stator wear",
        "recommended_action": "Inspect titanium fan blades for FOD/micro-cracks; rebalance rotor assembly",
    },
    "Turbine Section (HPT / LPT)": {
        "sensors": ["s_4", "s_20", "s_21"],
        "primary_symptom": "Exhaust Gas Temp elevation (T50) and elevated coolant bleed flow (W31/W32)",
        "wear_pattern": "Thermal barrier coating (TBC) spallation, turbine blade creep, seal leakage",
        "recommended_action": "Overhaul hot section; check nozzle guide vanes; replace high-temperature seals",
    },
    "Combustor & Fuel Delivery System": {
        "sensors": ["s_12", "s_17"],
        "primary_symptom": "Abnormal fuel flow-to-pressure ratio (Phi) and bleed enthalpy divergence",
        "wear_pattern": "Fuel nozzle coking, combustor liner hot spots, bleed valve actuator drift",
        "recommended_action": "Flow check fuel injectors; inspect combustor liner for thermal cracks",
    },
}

# RUL clipping threshold (standard benchmark practice: early cycles have healthy flat RUL)
RUL_CLIP_THRESHOLD = 125

# Maintenance Risk Categories and Priority Levels
RISK_LEVELS = {
    "CRITICAL": {
        "label": "Critical",
        "rul_max": 25,
        "priority": "P1 - Immediate Intervention",
        "color": "#DC2626", # Red
        "badge_class": "badge-critical",
        "action": "Immediate shutdown & dispatch emergency maintenance team."
    },
    "HIGH": {
        "label": "High Risk",
        "rul_min": 25,
        "rul_max": 50,
        "priority": "P2 - Priority Maintenance",
        "color": "#EA580C", # Orange
        "badge_class": "badge-high",
        "action": "Schedule teardown / module swap within 48 hours."
    },
    "MEDIUM": {
        "label": "Watchlist",
        "rul_min": 50,
        "rul_max": 90,
        "priority": "P3 - Planned Inspection",
        "color": "#CA8A04", # Amber
        "badge_class": "badge-medium",
        "action": "Inspect during upcoming scheduled shift or weekly PM window."
    },
    "LOW": {
        "label": "Nominal / Healthy",
        "rul_min": 90,
        "priority": "P4 - Routine Monitoring",
        "color": "#16A34A", # Green
        "badge_class": "badge-low",
        "action": "Machine operating within nominal aerodynamic & thermal tolerances."
    }
}
