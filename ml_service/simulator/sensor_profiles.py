"""
Sensor Profiles, Physical Properties and Degradation Characteristics
Based on NASA C-MAPSS Turbofan Engine Degradation Simulation Dataset.
"""
from typing import Dict, Any

# Sensor specifications with description, unit, nominal healthy mean, nominal std, and degradation direction.
# degradation_slope indicates change per unit of wear (0.0 to 1.0)
CMAPSS_SENSOR_SPECS: Dict[str, Dict[str, Any]] = {
    "s_1": {
        "name": "T2",
        "description": "Total temp at fan inlet",
        "unit": "°R",
        "nominal_mean": 518.67,
        "nominal_std": 0.0,
        "degradation_slope": 0.0,
        "min_valid": 500.0,
        "max_valid": 540.0,
        "informative_fd001": False
    },
    "s_2": {
        "name": "T24",
        "description": "Total temp at LPC outlet",
        "unit": "°R",
        "nominal_mean": 642.68,
        "nominal_std": 0.45,
        "degradation_slope": 1.85, # Increases with LPC/HPC wear
        "min_valid": 635.0,
        "max_valid": 655.0,
        "informative_fd001": True
    },
    "s_3": {
        "name": "T30",
        "description": "Total temp at HPC outlet",
        "unit": "°R",
        "nominal_mean": 1588.50,
        "nominal_std": 4.5,
        "degradation_slope": 18.2, # Increases with compressor fouling
        "min_valid": 1560.0,
        "max_valid": 1625.0,
        "informative_fd001": True
    },
    "s_4": {
        "name": "T50",
        "description": "Total temp at LPT outlet",
        "unit": "°R",
        "nominal_mean": 1406.80,
        "nominal_std": 5.2,
        "degradation_slope": 24.5, # Strong positive correlation with thermal degradation
        "min_valid": 1380.0,
        "max_valid": 1450.0,
        "informative_fd001": True
    },
    "s_5": {
        "name": "P2",
        "description": "Pressure at fan inlet",
        "unit": "psia",
        "nominal_mean": 14.62,
        "nominal_std": 0.0,
        "degradation_slope": 0.0,
        "min_valid": 13.0,
        "max_valid": 16.0,
        "informative_fd001": False
    },
    "s_6": {
        "name": "P15",
        "description": "Total pressure in bypass-duct",
        "unit": "psia",
        "nominal_mean": 21.61,
        "nominal_std": 0.04,
        "degradation_slope": -0.05,
        "min_valid": 21.0,
        "max_valid": 22.5,
        "informative_fd001": True
    },
    "s_7": {
        "name": "P30",
        "description": "Total pressure at HPC outlet",
        "unit": "psia",
        "nominal_mean": 554.20,
        "nominal_std": 0.75,
        "degradation_slope": -2.85, # Drops as compressor efficiency deteriorates
        "min_valid": 545.0,
        "max_valid": 560.0,
        "informative_fd001": True
    },
    "s_8": {
        "name": "Nf",
        "description": "Physical fan speed",
        "unit": "rpm",
        "nominal_mean": 2388.08,
        "nominal_std": 0.08,
        "degradation_slope": -0.25,
        "min_valid": 2380.0,
        "max_valid": 2395.0,
        "informative_fd001": True
    },
    "s_9": {
        "name": "Nc",
        "description": "Physical core speed",
        "unit": "rpm",
        "nominal_mean": 9055.00,
        "nominal_std": 12.5,
        "degradation_slope": 35.0, # Spindle core speed adjusts up to compensate
        "min_valid": 9000.0,
        "max_valid": 9150.0,
        "informative_fd001": True
    },
    "s_10": {
        "name": "epr",
        "description": "Engine pressure ratio (P50/P2)",
        "unit": "--",
        "nominal_mean": 1.30,
        "nominal_std": 0.0,
        "degradation_slope": 0.0,
        "min_valid": 1.0,
        "max_valid": 1.6,
        "informative_fd001": False
    },
    "s_11": {
        "name": "Ps30",
        "description": "Static pressure at HPC outlet",
        "unit": "psia",
        "nominal_mean": 47.35,
        "nominal_std": 0.18,
        "degradation_slope": 0.85, # Sharp rise as HPC seal clearances erode
        "min_valid": 46.5,
        "max_valid": 49.0,
        "informative_fd001": True
    },
    "s_12": {
        "name": "Phi",
        "description": "Ratio of fuel flow to Ps30",
        "unit": "pps/psia",
        "nominal_mean": 522.10,
        "nominal_std": 0.70,
        "degradation_slope": -2.60,
        "min_valid": 515.0,
        "max_valid": 526.0,
        "informative_fd001": True
    },
    "s_13": {
        "name": "NRf",
        "description": "Corrected fan speed",
        "unit": "rpm",
        "nominal_mean": 2388.08,
        "nominal_std": 0.08,
        "degradation_slope": -0.22,
        "min_valid": 2380.0,
        "max_valid": 2395.0,
        "informative_fd001": True
    },
    "s_14": {
        "name": "NRc",
        "description": "Corrected core speed",
        "unit": "rpm",
        "nominal_mean": 8138.50,
        "nominal_std": 9.5,
        "degradation_slope": 22.0,
        "min_valid": 8100.0,
        "max_valid": 8200.0,
        "informative_fd001": True
    },
    "s_15": {
        "name": "BPR",
        "description": "Bypass Ratio",
        "unit": "--",
        "nominal_mean": 8.42,
        "nominal_std": 0.035,
        "degradation_slope": 0.14, # Flow shifts to bypass duct as core degrades
        "min_valid": 8.30,
        "max_valid": 8.65,
        "informative_fd001": True
    },
    "s_16": {
        "name": "farB",
        "description": "Burner fuel-air ratio",
        "unit": "--",
        "nominal_mean": 0.03,
        "nominal_std": 0.0,
        "degradation_slope": 0.0,
        "min_valid": 0.02,
        "max_valid": 0.04,
        "informative_fd001": False
    },
    "s_17": {
        "name": "htBleed",
        "description": "Bleed Enthalpy",
        "unit": "--",
        "nominal_mean": 392.20,
        "nominal_std": 1.4,
        "degradation_slope": 4.8, # Increases with compressor temperature
        "min_valid": 385.0,
        "max_valid": 405.0,
        "informative_fd001": True
    },
    "s_18": {
        "name": "Nf_dmd",
        "description": "Demanded fan speed",
        "unit": "rpm",
        "nominal_mean": 2388.0,
        "nominal_std": 0.0,
        "degradation_slope": 0.0,
        "min_valid": 2380.0,
        "max_valid": 2395.0,
        "informative_fd001": False
    },
    "s_19": {
        "name": "PCNfR_dmd",
        "description": "Demanded corrected fan speed",
        "unit": "rpm",
        "nominal_mean": 100.0,
        "nominal_std": 0.0,
        "degradation_slope": 0.0,
        "min_valid": 95.0,
        "max_valid": 105.0,
        "informative_fd001": False
    },
    "s_20": {
        "name": "W31",
        "description": "HPT coolant bleed",
        "unit": "lbm/s",
        "nominal_mean": 38.92,
        "nominal_std": 0.16,
        "degradation_slope": -0.42, # Drops as cooling passageways clog
        "min_valid": 38.0,
        "max_valid": 39.8,
        "informative_fd001": True
    },
    "s_21": {
        "name": "W32",
        "description": "LPT coolant bleed",
        "unit": "lbm/s",
        "nominal_mean": 23.35,
        "nominal_std": 0.11,
        "degradation_slope": -0.26,
        "min_valid": 22.8,
        "max_valid": 23.8,
        "informative_fd001": True
    }
}

# The 6 Flight Operating Regimes for Multi-Regime FD002 and FD004
# setting_1: Altitude (0 - 42,000 ft normalized/scaled in C-MAPSS)
# setting_2: Mach number (0.0 to 0.84)
# setting_3: Throttle Resolver Angle (60 to 100)
FLIGHT_REGIMES_FD0024 = [
    {"regime_id": 0, "setting_1": 0.000, "setting_2": 0.000, "setting_3": 100.0, "desc": "Sea-Level Full Throttle (Takeoff)"},
    {"regime_id": 1, "setting_1": 10.00, "setting_2": 0.250, "setting_3": 100.0, "desc": "Low Altitude Climb"},
    {"regime_id": 2, "setting_1": 20.00, "setting_2": 0.700, "setting_3": 100.0, "desc": "Medium Altitude Subsonic Cruise"},
    {"regime_id": 3, "setting_1": 25.00, "setting_2": 0.620, "setting_3": 60.00, "desc": "Medium Cruise Throttled Descent"},
    {"regime_id": 4, "setting_1": 35.00, "setting_2": 0.840, "setting_3": 100.0, "desc": "High Altitude Transonic Cruise"},
    {"regime_id": 5, "setting_1": 42.00, "setting_2": 0.840, "setting_3": 100.0, "desc": "Ceiling High Speed Cruise"}
]
