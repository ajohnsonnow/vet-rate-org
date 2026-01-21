#!/usr/bin/env python3
"""
Vet-Rate.org - Ribbon Asset Scraper
====================================
Scrapes military ribbon images from Wikimedia Commons for all 6 branches.
Creates a ribbon_manifest.json for use in the Ribbon Rack Builder.

Usage:
    python ribbon_scraper.py

Output:
    - public/images/ribbons/*.png (ribbon images)
    - public/images/ribbons/devices/*.png (device overlays)
    - src/data/ribbon_manifest.json (metadata)

Author: Vet-Rate.org
Date: January 2026
"""

import os
import re
import json
import time
import requests
from pathlib import Path
from urllib.parse import quote, unquote
from typing import Dict, List, Optional, Tuple

# ============================================================================
# CONFIGURATION
# ============================================================================

# Output directories (relative to script location)
SCRIPT_DIR = Path(__file__).parent.parent
RIBBON_OUTPUT_DIR = SCRIPT_DIR / "public" / "images" / "ribbons"
DEVICE_OUTPUT_DIR = RIBBON_OUTPUT_DIR / "devices"
MANIFEST_OUTPUT_PATH = SCRIPT_DIR / "src" / "data" / "ribbon_manifest.json"

# Wikimedia Commons API
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
COMMONS_FILE_URL = "https://commons.wikimedia.org/wiki/Special:FilePath/"

# Request settings
REQUEST_DELAY = 0.5  # seconds between requests (be nice to Wikimedia)
USER_AGENT = "VetRateRibbonScraper/1.0 (https://vet-rate.org; contact@vet-rate.org)"

# ============================================================================
# AWARD DEFINITIONS - Master List with Precedence
# ============================================================================

# Each award has:
# - id: unique identifier
# - name: official name
# - aliases: common abbreviations found on DD214s
# - branch: which branch(es) this applies to
# - precedence: dict of {branch: order} - lower number = higher precedence
# - wiki_file: Wikimedia Commons filename for the ribbon
# - category: US, Joint, Unit, Campaign, Service, Foreign

MASTER_AWARDS = [
    # =========================================================================
    # VALOR AWARDS (Highest Precedence)
    # =========================================================================
    {
        "id": "medal_of_honor",
        "name": "Medal of Honor",
        "aliases": ["MOH", "MEDAL OF HONOR", "CONGRESSIONAL MEDAL OF HONOR"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 1, "Navy": 1, "Marines": 1, "Air Force": 1, "Coast Guard": 1, "Space Force": 1},
        "wiki_file": "Medal_of_Honor_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "distinguished_service_cross",
        "name": "Distinguished Service Cross",
        "aliases": ["DSC", "DIST SVC CROSS", "DISTINGUISHED SERVICE CROSS"],
        "branch": ["Army"],
        "precedence": {"Army": 2},
        "wiki_file": "Distinguished_Service_Cross_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "navy_cross",
        "name": "Navy Cross",
        "aliases": ["NC", "NAVY CROSS"],
        "branch": ["Navy", "Marines", "Coast Guard"],
        "precedence": {"Navy": 2, "Marines": 2, "Coast Guard": 2},
        "wiki_file": "Navy_Cross_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "air_force_cross",
        "name": "Air Force Cross",
        "aliases": ["AFC", "AF CROSS", "AIR FORCE CROSS"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 2, "Space Force": 2},
        "wiki_file": "Air_Force_Cross_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "defense_distinguished_service_medal",
        "name": "Defense Distinguished Service Medal",
        "aliases": ["DDSM", "DEF DIST SVC MDL", "DEFENSE DSM"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 3, "Navy": 3, "Marines": 3, "Air Force": 3, "Coast Guard": 3, "Space Force": 3},
        "wiki_file": "Defense_Distinguished_Service_Medal_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "army_distinguished_service_medal",
        "name": "Army Distinguished Service Medal",
        "aliases": ["ADSM", "ARMY DSM", "DISTINGUISHED SERVICE MEDAL"],
        "branch": ["Army"],
        "precedence": {"Army": 4},
        "wiki_file": "U.S._Army_Distinguished_Service_Medal_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "navy_distinguished_service_medal",
        "name": "Navy Distinguished Service Medal",
        "aliases": ["NDSM", "NAVY DSM"],
        "branch": ["Navy", "Marines", "Coast Guard"],
        "precedence": {"Navy": 4, "Marines": 4, "Coast Guard": 4},
        "wiki_file": "Navy_Distinguished_Service_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "air_force_distinguished_service_medal",
        "name": "Air Force Distinguished Service Medal",
        "aliases": ["AFDSM", "AF DSM"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 4, "Space Force": 4},
        "wiki_file": "Air_Force_Distinguished_Service_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "coast_guard_distinguished_service_medal",
        "name": "Coast Guard Distinguished Service Medal",
        "aliases": ["CGDSM", "CG DSM"],
        "branch": ["Coast Guard"],
        "precedence": {"Coast Guard": 5},
        "wiki_file": "Coast_Guard_Distinguished_Service_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "silver_star",
        "name": "Silver Star",
        "aliases": ["SS", "SILVER STAR", "SLVR STR", "SSM"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 5, "Navy": 5, "Marines": 5, "Air Force": 5, "Coast Guard": 6, "Space Force": 5},
        "wiki_file": "Silver_Star_Medal_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "defense_superior_service_medal",
        "name": "Defense Superior Service Medal",
        "aliases": ["DSSM", "DEF SUP SVC MDL"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 6, "Navy": 6, "Marines": 6, "Air Force": 6, "Coast Guard": 7, "Space Force": 6},
        "wiki_file": "Defense_Superior_Service_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "legion_of_merit",
        "name": "Legion of Merit",
        "aliases": ["LOM", "LM", "LEGION OF MERIT", "LEG OF MERIT"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 7, "Navy": 7, "Marines": 7, "Air Force": 7, "Coast Guard": 8, "Space Force": 7},
        "wiki_file": "Legion_of_Merit_ribbon.svg",
        "category": "service"
    },
    {
        "id": "distinguished_flying_cross",
        "name": "Distinguished Flying Cross",
        "aliases": ["DFC", "DIST FLY CROSS", "DISTINGUISHED FLYING CROSS"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 8, "Navy": 8, "Marines": 8, "Air Force": 8, "Coast Guard": 9, "Space Force": 8},
        "wiki_file": "Distinguished_Flying_Cross_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "soldiers_medal",
        "name": "Soldier's Medal",
        "aliases": ["SM", "SOLDIERS MEDAL", "SOLDIER'S MEDAL"],
        "branch": ["Army"],
        "precedence": {"Army": 9},
        "wiki_file": "Soldier's_Medal_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "navy_marine_corps_medal",
        "name": "Navy and Marine Corps Medal",
        "aliases": ["NMCM", "NMC MEDAL", "NAVY MARINE CORPS MEDAL"],
        "branch": ["Navy", "Marines"],
        "precedence": {"Navy": 9, "Marines": 9},
        "wiki_file": "Navy_and_Marine_Corps_Medal_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "airman_medal",
        "name": "Airman's Medal",
        "aliases": ["AM", "AIRMANS MEDAL", "AIRMAN'S MEDAL"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 9, "Space Force": 9},
        "wiki_file": "Airman's_Medal_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "coast_guard_medal",
        "name": "Coast Guard Medal",
        "aliases": ["CGM", "CG MEDAL"],
        "branch": ["Coast Guard"],
        "precedence": {"Coast Guard": 10},
        "wiki_file": "Coast_Guard_Medal_ribbon.svg",
        "category": "valor"
    },
    
    # =========================================================================
    # BRONZE STAR & COMMENDATION MEDALS
    # =========================================================================
    {
        "id": "bronze_star",
        "name": "Bronze Star Medal",
        "aliases": ["BSM", "BS", "BRONZE STAR", "BRNZ STR", "BRONZE STAR MEDAL", "BSM W/V"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 10, "Navy": 10, "Marines": 10, "Air Force": 10, "Coast Guard": 11, "Space Force": 10},
        "wiki_file": "Bronze_Star_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "purple_heart",
        "name": "Purple Heart",
        "aliases": ["PH", "PURPLE HEART", "PRPL HRT"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 11, "Navy": 11, "Marines": 11, "Air Force": 11, "Coast Guard": 12, "Space Force": 11},
        "wiki_file": "Purple_Heart_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "defense_meritorious_service_medal",
        "name": "Defense Meritorious Service Medal",
        "aliases": ["DMSM", "DEF MSM"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 12, "Navy": 12, "Marines": 12, "Air Force": 12, "Coast Guard": 13, "Space Force": 12},
        "wiki_file": "Defense_Meritorious_Service_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "meritorious_service_medal",
        "name": "Meritorious Service Medal",
        "aliases": ["MSM", "MRT SVC MDL", "MERITORIOUS SERVICE MEDAL"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 13, "Navy": 13, "Marines": 13, "Air Force": 13, "Coast Guard": 14, "Space Force": 13},
        "wiki_file": "Meritorious_Service_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "air_medal",
        "name": "Air Medal",
        "aliases": ["AM", "AIR MEDAL", "AIR MDL"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 14, "Navy": 14, "Marines": 14, "Air Force": 14, "Coast Guard": 15, "Space Force": 14},
        "wiki_file": "Air_Medal_ribbon.svg",
        "category": "valor"
    },
    {
        "id": "joint_service_commendation_medal",
        "name": "Joint Service Commendation Medal",
        "aliases": ["JSCM", "JT SVC COM MDL", "JOINT SERVICE COMMENDATION"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 15, "Navy": 15, "Marines": 15, "Air Force": 15, "Coast Guard": 16, "Space Force": 15},
        "wiki_file": "Joint_Service_Commendation_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "army_commendation_medal",
        "name": "Army Commendation Medal",
        "aliases": ["ARCOM", "ACM", "ARMY COM MDL", "ARMY COMMENDATION MEDAL"],
        "branch": ["Army"],
        "precedence": {"Army": 16},
        "wiki_file": "Army_Commendation_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "navy_marine_corps_commendation_medal",
        "name": "Navy and Marine Corps Commendation Medal",
        "aliases": ["NMCCM", "NAV COM MDL", "NAVY COMMENDATION MEDAL", "NAVY COM"],
        "branch": ["Navy", "Marines", "Coast Guard"],
        "precedence": {"Navy": 16, "Marines": 16, "Coast Guard": 17},
        "wiki_file": "Navy_and_Marine_Corps_Commendation_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "air_force_commendation_medal",
        "name": "Air Force Commendation Medal",
        "aliases": ["AFCM", "AF COM MDL", "AIR FORCE COMMENDATION MEDAL"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 16, "Space Force": 16},
        "wiki_file": "Air_Force_Commendation_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "coast_guard_commendation_medal",
        "name": "Coast Guard Commendation Medal",
        "aliases": ["CGCM", "CG COM MDL"],
        "branch": ["Coast Guard"],
        "precedence": {"Coast Guard": 18},
        "wiki_file": "U.S._Coast_Guard_Commendation_Medal_ribbon.svg",
        "category": "service"
    },
    
    # =========================================================================
    # ACHIEVEMENT MEDALS
    # =========================================================================
    {
        "id": "joint_service_achievement_medal",
        "name": "Joint Service Achievement Medal",
        "aliases": ["JSAM", "JT SVC ACH MDL", "JOINT SERVICE ACHIEVEMENT"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 17, "Navy": 17, "Marines": 17, "Air Force": 17, "Coast Guard": 19, "Space Force": 17},
        "wiki_file": "Joint_Service_Achievement_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "army_achievement_medal",
        "name": "Army Achievement Medal",
        "aliases": ["AAM", "ARMY ACH MDL", "ARMY ACHIEVEMENT MEDAL"],
        "branch": ["Army"],
        "precedence": {"Army": 18},
        "wiki_file": "Army_Achievement_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "navy_marine_corps_achievement_medal",
        "name": "Navy and Marine Corps Achievement Medal",
        "aliases": ["NMCAM", "NAV ACH MDL", "NAVY ACHIEVEMENT MEDAL", "NAVY ACH"],
        "branch": ["Navy", "Marines"],
        "precedence": {"Navy": 18, "Marines": 18},
        "wiki_file": "Navy_and_Marine_Corps_Achievement_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "air_force_achievement_medal",
        "name": "Air Force Achievement Medal",
        "aliases": ["AFAM", "AF ACH MDL", "AIR FORCE ACHIEVEMENT MEDAL"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 18, "Space Force": 18},
        "wiki_file": "Air_Force_Achievement_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "coast_guard_achievement_medal",
        "name": "Coast Guard Achievement Medal",
        "aliases": ["CGAM", "CG ACH MDL"],
        "branch": ["Coast Guard"],
        "precedence": {"Coast Guard": 20},
        "wiki_file": "U.S._Coast_Guard_Achievement_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "combat_action_ribbon",
        "name": "Combat Action Ribbon",
        "aliases": ["CAR", "COMBAT ACTION RIBBON"],
        "branch": ["Navy", "Marines", "Coast Guard"],
        "precedence": {"Navy": 19, "Marines": 19, "Coast Guard": 21},
        "wiki_file": "Combat_Action_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "combat_action_badge",
        "name": "Combat Action Badge",
        "aliases": ["CAB", "COMBAT ACTION BADGE"],
        "branch": ["Army"],
        "precedence": {"Army": 19},
        "wiki_file": None,  # Badge, not ribbon
        "category": "badge"
    },
    {
        "id": "combat_infantryman_badge",
        "name": "Combat Infantryman Badge",
        "aliases": ["CIB", "COMBAT INFANTRY BADGE", "COMBAT INFANTRYMAN BADGE"],
        "branch": ["Army"],
        "precedence": {"Army": 20},
        "wiki_file": None,  # Badge, not ribbon
        "category": "badge"
    },
    
    # =========================================================================
    # UNIT AWARDS
    # =========================================================================
    {
        "id": "presidential_unit_citation_army",
        "name": "Presidential Unit Citation (Army)",
        "aliases": ["PUC", "PRESIDENTIAL UNIT CITATION"],
        "branch": ["Army"],
        "precedence": {"Army": 25},
        "wiki_file": "U.S._Army_and_U.S._Air_Force_Presidential_Unit_Citation_ribbon.svg",
        "category": "unit"
    },
    {
        "id": "presidential_unit_citation_navy",
        "name": "Presidential Unit Citation (Navy)",
        "aliases": ["PUC", "PRESIDENTIAL UNIT CITATION"],
        "branch": ["Navy", "Marines", "Coast Guard"],
        "precedence": {"Navy": 25, "Marines": 25, "Coast Guard": 25},
        "wiki_file": "United_States_Navy_Presidential_Unit_Citation_ribbon.svg",
        "category": "unit"
    },
    {
        "id": "air_force_presidential_unit_citation",
        "name": "Air Force Presidential Unit Citation",
        "aliases": ["PUC", "AF PUC"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 25, "Space Force": 25},
        "wiki_file": "AF_Presidential_Unit_Citation_Ribbon.png",
        "category": "unit"
    },
    {
        "id": "valorous_unit_award",
        "name": "Valorous Unit Award",
        "aliases": ["VUA", "VALOROUS UNIT AWARD"],
        "branch": ["Army"],
        "precedence": {"Army": 26},
        "wiki_file": "Valorous_Unit_Award_ribbon.svg",
        "category": "unit"
    },
    {
        "id": "navy_unit_commendation",
        "name": "Navy Unit Commendation",
        "aliases": ["NUC", "NAVY UNIT COMMENDATION"],
        "branch": ["Navy", "Marines", "Coast Guard"],
        "precedence": {"Navy": 26, "Marines": 26, "Coast Guard": 26},
        "wiki_file": "Navy_Unit_Commendation_ribbon.svg",
        "category": "unit"
    },
    {
        "id": "air_force_gallant_unit_citation",
        "name": "Air Force Gallant Unit Citation",
        "aliases": ["AFGUC", "GALLANT UNIT CITATION"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 26, "Space Force": 26},
        "wiki_file": "Gallant_Unit_Citation_ribbon.svg",
        "category": "unit"
    },
    {
        "id": "meritorious_unit_commendation_army",
        "name": "Meritorious Unit Commendation (Army)",
        "aliases": ["MUC", "MERITORIOUS UNIT COMMENDATION"],
        "branch": ["Army"],
        "precedence": {"Army": 27},
        "wiki_file": "Meritorious_Unit_Commendation_ribbon.svg",
        "category": "unit"
    },
    {
        "id": "meritorious_unit_commendation_navy",
        "name": "Meritorious Unit Commendation (Navy)",
        "aliases": ["MUC", "NAVY MUC"],
        "branch": ["Navy", "Marines", "Coast Guard"],
        "precedence": {"Navy": 27, "Marines": 27, "Coast Guard": 27},
        "wiki_file": "Meritorious_Unit_Commendation_ribbon.svg",
        "category": "unit"
    },
    {
        "id": "air_force_meritorious_unit_award",
        "name": "Air Force Meritorious Unit Award",
        "aliases": ["AFMUA", "AF MUA"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 27, "Space Force": 27},
        "wiki_file": "Air_Force_Meritorious_Unit_ribbon.svg",
        "category": "unit"
    },
    {
        "id": "army_superior_unit_award",
        "name": "Army Superior Unit Award",
        "aliases": ["ASUA", "SUP UNIT AWARD"],
        "branch": ["Army"],
        "precedence": {"Army": 28},
        "wiki_file": "Army_Superior_Unit_Award_ribbon.svg",
        "category": "unit"
    },
    
    # =========================================================================
    # CAMPAIGN MEDALS (GWOT Era)
    # =========================================================================
    {
        "id": "prisoner_of_war_medal",
        "name": "Prisoner of War Medal",
        "aliases": ["POW", "POW MEDAL", "PRISONER OF WAR MEDAL"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 30, "Navy": 30, "Marines": 30, "Air Force": 30, "Coast Guard": 30, "Space Force": 30},
        "wiki_file": "Prisoner_of_War_ribbon.svg",
        "category": "campaign"
    },
    {
        "id": "good_conduct_medal_army",
        "name": "Good Conduct Medal (Army)",
        "aliases": ["GCM", "GOOD CONDUCT MEDAL", "ARMY GCM"],
        "branch": ["Army"],
        "precedence": {"Army": 31},
        "wiki_file": "Army_Good_Conduct_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "good_conduct_medal_navy",
        "name": "Good Conduct Medal (Navy)",
        "aliases": ["GCM", "NAVY GCM"],
        "branch": ["Navy"],
        "precedence": {"Navy": 31},
        "wiki_file": "U.S._Navy_Good_Conduct_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "good_conduct_medal_marine",
        "name": "Good Conduct Medal (Marine Corps)",
        "aliases": ["GCM", "MARINE GCM"],
        "branch": ["Marines"],
        "precedence": {"Marines": 31},
        "wiki_file": "U.S._Marine_Corps_Good_Conduct_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "good_conduct_medal_air_force",
        "name": "Good Conduct Medal (Air Force)",
        "aliases": ["GCM", "AF GCM"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 31, "Space Force": 31},
        "wiki_file": "U.S._Air_Force_Good_Conduct_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "good_conduct_medal_coast_guard",
        "name": "Good Conduct Medal (Coast Guard)",
        "aliases": ["GCM", "CG GCM"],
        "branch": ["Coast Guard"],
        "precedence": {"Coast Guard": 31},
        "wiki_file": "U.S._Coast_Guard_Good_Conduct_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "army_reserve_components_achievement_medal",
        "name": "Army Reserve Components Achievement Medal",
        "aliases": ["ARCAM", "RESERVE ACHIEVEMENT"],
        "branch": ["Army"],
        "precedence": {"Army": 32},
        "wiki_file": "Army_Reserve_Components_Achievement_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "naval_reserve_meritorious_service_medal",
        "name": "Naval Reserve Meritorious Service Medal",
        "aliases": ["NRMSM"],
        "branch": ["Navy", "Marines"],
        "precedence": {"Navy": 32, "Marines": 32},
        "wiki_file": "Naval_Reserve_Meritorious_Service_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "selected_marine_corps_reserve_medal",
        "name": "Selected Marine Corps Reserve Medal",
        "aliases": ["SMCRM"],
        "branch": ["Marines"],
        "precedence": {"Marines": 33},
        "wiki_file": "Selected_Marine_Corps_Reserve_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "air_reserve_forces_meritorious_service_medal",
        "name": "Air Reserve Forces Meritorious Service Medal",
        "aliases": ["ARFMSM"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 32, "Space Force": 32},
        "wiki_file": "Air_Reserve_Forces_Meritorious_Service_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "coast_guard_reserve_good_conduct_medal",
        "name": "Coast Guard Reserve Good Conduct Medal",
        "aliases": ["CGRGCM"],
        "branch": ["Coast Guard"],
        "precedence": {"Coast Guard": 32},
        "wiki_file": "Coast_Guard_Reserve_Good_Conduct_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "national_defense_service_medal",
        "name": "National Defense Service Medal",
        "aliases": ["NDSM", "NAT DEF SVC MDL", "NATIONAL DEFENSE SERVICE MEDAL", "NAT DEF"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 40, "Navy": 40, "Marines": 40, "Air Force": 40, "Coast Guard": 40, "Space Force": 40},
        "wiki_file": "National_Defense_Service_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "afghanistan_campaign_medal",
        "name": "Afghanistan Campaign Medal",
        "aliases": ["ACM", "AFGHAN CAMP MDL", "AFGHANISTAN CAMPAIGN MEDAL", "OEF"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 41, "Navy": 41, "Marines": 41, "Air Force": 41, "Coast Guard": 41, "Space Force": 41},
        "wiki_file": "Afghanistan_Campaign_ribbon.svg",
        "category": "campaign"
    },
    {
        "id": "iraq_campaign_medal",
        "name": "Iraq Campaign Medal",
        "aliases": ["ICM", "IRAQ CAMP MDL", "IRAQ CAMPAIGN MEDAL", "OIF", "OND", "OIR"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 42, "Navy": 42, "Marines": 42, "Air Force": 42, "Coast Guard": 42, "Space Force": 42},
        "wiki_file": "Iraq_Campaign_Medal_ribbon.svg",
        "category": "campaign"
    },
    {
        "id": "inherent_resolve_campaign_medal",
        "name": "Inherent Resolve Campaign Medal",
        "aliases": ["IRCM", "OIR"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 43, "Navy": 43, "Marines": 43, "Air Force": 43, "Coast Guard": 43, "Space Force": 43},
        "wiki_file": "Inherent_Resolve_Campaign_Medal_ribbon.svg",
        "category": "campaign"
    },
    {
        "id": "global_war_on_terrorism_expeditionary_medal",
        "name": "Global War on Terrorism Expeditionary Medal",
        "aliases": ["GWOTEM", "GWOT EXP", "GWOT EXPEDITIONARY"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 44, "Navy": 44, "Marines": 44, "Air Force": 44, "Coast Guard": 44, "Space Force": 44},
        "wiki_file": "Global_War_on_Terrorism_Expeditionary_ribbon.svg",
        "category": "campaign"
    },
    {
        "id": "global_war_on_terrorism_service_medal",
        "name": "Global War on Terrorism Service Medal",
        "aliases": ["GWOTSM", "GWOT SVC", "GWOT SERVICE"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 45, "Navy": 45, "Marines": 45, "Air Force": 45, "Coast Guard": 45, "Space Force": 45},
        "wiki_file": "Global_War_on_Terrorism_Service_ribbon.svg",
        "category": "campaign"
    },
    {
        "id": "korean_defense_service_medal",
        "name": "Korean Defense Service Medal",
        "aliases": ["KDSM", "KOREAN DEFENSE"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 46, "Navy": 46, "Marines": 46, "Air Force": 46, "Coast Guard": 46, "Space Force": 46},
        "wiki_file": "Korea_Defense_Service_Medal_ribbon.svg",
        "category": "campaign"
    },
    {
        "id": "armed_forces_expeditionary_medal",
        "name": "Armed Forces Expeditionary Medal",
        "aliases": ["AFEM", "ARMED FORCES EXP", "AFE MEDAL"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 47, "Navy": 47, "Marines": 47, "Air Force": 47, "Coast Guard": 47, "Space Force": 47},
        "wiki_file": "Armed_Forces_Expeditionary_Medal_ribbon.svg",
        "category": "campaign"
    },
    {
        "id": "armed_forces_service_medal",
        "name": "Armed Forces Service Medal",
        "aliases": ["AFSM", "ARMED FORCES SVC", "AFS MEDAL"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 48, "Navy": 48, "Marines": 48, "Air Force": 48, "Coast Guard": 48, "Space Force": 48},
        "wiki_file": "Armed_Forces_Service_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "humanitarian_service_medal",
        "name": "Humanitarian Service Medal",
        "aliases": ["HSM", "HUMANITARIAN SVC", "HUMANITARIAN SERVICE MEDAL"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 49, "Navy": 49, "Marines": 49, "Air Force": 49, "Coast Guard": 49, "Space Force": 49},
        "wiki_file": "Humanitarian_Service_ribbon.svg",
        "category": "service"
    },
    {
        "id": "military_outstanding_volunteer_service_medal",
        "name": "Military Outstanding Volunteer Service Medal",
        "aliases": ["MOVSM", "VOLUNTEER SVC", "VOLUNTEER SERVICE MEDAL"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 50, "Navy": 50, "Marines": 50, "Air Force": 50, "Coast Guard": 50, "Space Force": 50},
        "wiki_file": "Military_Outstanding_Volunteer_Service_Medal_ribbon.svg",
        "category": "service"
    },
    
    # =========================================================================
    # SERVICE MEDALS (Reserves, Training, etc.)
    # =========================================================================
    {
        "id": "armed_forces_reserve_medal",
        "name": "Armed Forces Reserve Medal",
        "aliases": ["AFRM", "AF RESERVE MEDAL"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 55, "Navy": 55, "Marines": 55, "Air Force": 55, "Coast Guard": 55, "Space Force": 55},
        "wiki_file": "Armed_Forces_Reserve_Medal_ribbon.svg",
        "category": "service"
    },
    {
        "id": "nco_professional_development_ribbon",
        "name": "NCO Professional Development Ribbon",
        "aliases": ["NCOPDR", "NCO DEV RIBBON"],
        "branch": ["Army"],
        "precedence": {"Army": 56},
        "wiki_file": "NCO_Professional_Development_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "army_service_ribbon",
        "name": "Army Service Ribbon",
        "aliases": ["ASR", "ARMY SVC RIBBON"],
        "branch": ["Army"],
        "precedence": {"Army": 57},
        "wiki_file": "Army_Service_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "navy_sea_service_ribbon",
        "name": "Navy Sea Service Deployment Ribbon",
        "aliases": ["SSDR", "SEA SERVICE"],
        "branch": ["Navy", "Marines", "Coast Guard"],
        "precedence": {"Navy": 56, "Marines": 56, "Coast Guard": 56},
        "wiki_file": "Sea_Service_Deployment_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "air_force_overseas_ribbon_short",
        "name": "Air Force Overseas Ribbon (Short Tour)",
        "aliases": ["AFOSR SHORT", "AF OVERSEAS SHORT"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 56, "Space Force": 56},
        "wiki_file": "Air_Force_Overseas_Short_Tour_Service_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "air_force_overseas_ribbon_long",
        "name": "Air Force Overseas Ribbon (Long Tour)",
        "aliases": ["AFOSR LONG", "AF OVERSEAS LONG"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 57, "Space Force": 57},
        "wiki_file": "Air_Force_Overseas_Long_Tour_Service_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "overseas_service_ribbon_army",
        "name": "Overseas Service Ribbon (Army)",
        "aliases": ["OSR", "ARMY OVERSEAS"],
        "branch": ["Army"],
        "precedence": {"Army": 58},
        "wiki_file": "Army_Overseas_Service_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "air_force_expeditionary_service_ribbon",
        "name": "Air Force Expeditionary Service Ribbon",
        "aliases": ["AFESR", "AF EXP SVC"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 58, "Space Force": 58},
        "wiki_file": "Air_and_Space_Expeditionary_Service_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "air_force_longevity_service_award",
        "name": "Air Force Longevity Service Award",
        "aliases": ["AFLSA", "LONGEVITY SVC"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 59, "Space Force": 59},
        "wiki_file": "Air_Force_Longevity_Service_ribbon.svg",
        "category": "service"
    },
    {
        "id": "navy_arctic_service_ribbon",
        "name": "Navy Arctic Service Ribbon",
        "aliases": ["ASR", "ARCTIC SERVICE"],
        "branch": ["Navy", "Marines", "Coast Guard"],
        "precedence": {"Navy": 57, "Marines": 57, "Coast Guard": 57},
        "wiki_file": "Navy_Arctic_Service_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "navy_reserve_sea_service_ribbon",
        "name": "Navy and Marine Corps Overseas Service Ribbon",
        "aliases": ["NMCOSR", "OVERSEAS SVC"],
        "branch": ["Navy", "Marines"],
        "precedence": {"Navy": 58, "Marines": 58},
        "wiki_file": "Navy_and_Marine_Corps_Overseas_Service_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "navy_recruiting_service_ribbon",
        "name": "Navy Recruiting Service Ribbon",
        "aliases": ["NRSR", "RECRUITING"],
        "branch": ["Navy"],
        "precedence": {"Navy": 59},
        "wiki_file": "Navy_Recruiting_Service_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "marine_corps_recruiting_ribbon",
        "name": "Marine Corps Recruiting Ribbon",
        "aliases": ["MCRR"],
        "branch": ["Marines"],
        "precedence": {"Marines": 59},
        "wiki_file": "Marine_Corps_Recruiting_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "army_recruiter_badge",
        "name": "Army Recruiter Badge",
        "aliases": ["RECRUITER"],
        "branch": ["Army"],
        "precedence": {"Army": 59},
        "wiki_file": None,  # Badge, not ribbon
        "category": "badge"
    },
    {
        "id": "air_force_recruiter_ribbon",
        "name": "Air Force Recruiter Ribbon",
        "aliases": ["AFRR"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 60, "Space Force": 60},
        "wiki_file": "Air_Force_Recruiter_Ribbon.svg",
        "category": "service"
    },
    {
        "id": "air_force_training_ribbon",
        "name": "Air Force Training Ribbon",
        "aliases": ["AFTR", "AF TRAINING"],
        "branch": ["Air Force", "Space Force"],
        "precedence": {"Air Force": 61, "Space Force": 61},
        "wiki_file": "Air_and_Space_Training_Ribbon.svg",
        "category": "service"
    },
    
    # =========================================================================
    # FOREIGN AWARDS (Common)
    # =========================================================================
    {
        "id": "nato_medal",
        "name": "NATO Medal",
        "aliases": ["NATO", "NATO MEDAL", "NATO SVC"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 70, "Navy": 70, "Marines": 70, "Air Force": 70, "Coast Guard": 70, "Space Force": 70},
        "wiki_file": "NATO_Medal_Yugoslavia_ribbon_bar.svg",
        "category": "foreign"
    },
    {
        "id": "multinational_force_observers_medal",
        "name": "Multinational Force and Observers Medal",
        "aliases": ["MFO", "MULTINATIONAL FORCE"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 71, "Navy": 71, "Marines": 71, "Air Force": 71, "Coast Guard": 71, "Space Force": 71},
        "wiki_file": "MFO_Ribbon_bar.svg",
        "category": "foreign"
    },
    {
        "id": "united_nations_medal",
        "name": "United Nations Medal",
        "aliases": ["UN MEDAL", "UNITED NATIONS"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"],
        "precedence": {"Army": 72, "Navy": 72, "Marines": 72, "Air Force": 72, "Coast Guard": 72, "Space Force": 72},
        "wiki_file": "United_Nations_Medal_ribbon.svg",
        "category": "foreign"
    },
    {
        "id": "republic_of_vietnam_campaign_medal",
        "name": "Republic of Vietnam Campaign Medal",
        "aliases": ["RVNCM", "RVN CAMPAIGN", "VIETNAM CAMPAIGN"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard"],
        "precedence": {"Army": 73, "Navy": 73, "Marines": 73, "Air Force": 73, "Coast Guard": 73},
        "wiki_file": "Republic_of_Vietnam_Campaign_Medal_ribbon,_with_60-_clasp.svg",
        "category": "foreign"
    },
    {
        "id": "kuwait_liberation_medal_saudi",
        "name": "Kuwait Liberation Medal (Saudi Arabia)",
        "aliases": ["KLM SAUDI", "KUWAIT LIB SAUDI"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard"],
        "precedence": {"Army": 74, "Navy": 74, "Marines": 74, "Air Force": 74, "Coast Guard": 74},
        "wiki_file": "Kuwait_Liberation_Medal_(Saudi_Arabia)_ribbon.svg",
        "category": "foreign"
    },
    {
        "id": "kuwait_liberation_medal_kuwait",
        "name": "Kuwait Liberation Medal (Kuwait)",
        "aliases": ["KLM KUWAIT", "KUWAIT LIB KUWAIT"],
        "branch": ["Army", "Navy", "Marines", "Air Force", "Coast Guard"],
        "precedence": {"Army": 75, "Navy": 75, "Marines": 75, "Air Force": 75, "Coast Guard": 75},
        "wiki_file": "Kuwait_Liberation_Medal_(Kuwait)_ribbon.svg",
        "category": "foreign"
    },
]

# ============================================================================
# RIBBON DEVICES
# ============================================================================

RIBBON_DEVICES = [
    {
        "id": "bronze_star_device",
        "name": "Bronze Service Star",
        "aliases": ["*", "BRONZE STAR", "BSS"],
        "wiki_file": "Bronze-service-star-3d.png",
        "represents": "additional_award"
    },
    {
        "id": "silver_star_device",
        "name": "Silver Service Star",
        "aliases": ["SILVER STAR DEVICE", "SSS"],
        "wiki_file": "Silver-service-star-3d.png",
        "represents": "5_bronze_stars"
    },
    {
        "id": "gold_star_device",
        "name": "Gold Service Star",
        "aliases": ["GOLD STAR DEVICE", "GSS"],
        "wiki_file": "Gold-service-star.png",
        "represents": "5_silver_stars"
    },
    {
        "id": "bronze_oak_leaf_cluster",
        "name": "Bronze Oak Leaf Cluster",
        "aliases": ["OLC", "BRONZE OLC", "BOLC"],
        "wiki_file": "Bronze_oak_leaf-3d.svg",
        "represents": "additional_award_army_af"
    },
    {
        "id": "silver_oak_leaf_cluster",
        "name": "Silver Oak Leaf Cluster",
        "aliases": ["SILVER OLC", "SOLC"],
        "wiki_file": "Silver_oakleaf-3d.svg",
        "represents": "5_bronze_olc"
    },
    {
        "id": "v_device",
        "name": "V Device (Valor)",
        "aliases": ["V", "W/V", "WITH V", "V DEVICE", "VALOR"],
        "wiki_file": "\"V\"_device,_brass.svg",
        "represents": "valor_in_combat"
    },
    {
        "id": "c_device",
        "name": "C Device (Combat)",
        "aliases": ["C", "W/C", "COMBAT DISTINGUISHING DEVICE"],
        "wiki_file": "Combat_Distinguishing_Device.png",
        "represents": "combat_conditions"
    },
    {
        "id": "r_device",
        "name": "R Device (Remote)",
        "aliases": ["R", "W/R", "REMOTE"],
        "wiki_file": "Ribbon_Device_R_Bronze.png",
        "represents": "remote_impact"
    },
    {
        "id": "arrowhead_device",
        "name": "Arrowhead Device",
        "aliases": ["ARROWHEAD", "ARROW"],
        "wiki_file": "Arrowhead_device.svg",
        "represents": "combat_assault"
    },
    {
        "id": "hourglass_device",
        "name": "Hourglass Device",
        "aliases": ["HOURGLASS", "10 YEARS"],
        "wiki_file": "Hourglass_Device_Bronze.svg",
        "represents": "10_years_reserve"
    },
    {
        "id": "numeral_device",
        "name": "Numeral Device",
        "aliases": ["2", "3", "4", "5", "NUMERAL"],
        "wiki_file": "Award_numeral_2.svg",
        "represents": "multiple_awards"
    },
]


# ============================================================================
# SCRAPER FUNCTIONS
# ============================================================================

def sanitize_filename(name: str) -> str:
    """Convert award name to clean filename."""
    # Remove special characters and convert to lowercase
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', name)
    # Replace spaces with underscores
    clean = re.sub(r'\s+', '_', clean.strip())
    return clean.lower()


def get_commons_file_url(filename: str) -> Optional[str]:
    """Get the direct download URL for a Wikimedia Commons file."""
    if not filename:
        return None
    
    try:
        params = {
            'action': 'query',
            'titles': f'File:{filename}',
            'prop': 'imageinfo',
            'iiprop': 'url',
            'format': 'json'
        }
        
        response = requests.get(
            COMMONS_API,
            params=params,
            headers={'User-Agent': USER_AGENT},
            timeout=30
        )
        response.raise_for_status()
        
        data = response.json()
        pages = data.get('query', {}).get('pages', {})
        
        for page_id, page_data in pages.items():
            if page_id != '-1':
                imageinfo = page_data.get('imageinfo', [])
                if imageinfo:
                    return imageinfo[0].get('url')
        
        return None
    except Exception as e:
        print(f"  ⚠️  Error getting URL for {filename}: {e}")
        return None


def download_file(url: str, output_path: Path) -> bool:
    """Download a file from URL to the specified path."""
    try:
        response = requests.get(
            url,
            headers={'User-Agent': USER_AGENT},
            timeout=60,
            stream=True
        )
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return True
    except Exception as e:
        print(f"  ⚠️  Error downloading {url}: {e}")
        return False


def convert_svg_to_png(svg_path: Path, png_path: Path) -> bool:
    """Convert SVG to PNG (requires cairosvg or PIL)."""
    try:
        # Try cairosvg first (better quality)
        import cairosvg
        cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), output_width=240, output_height=90)
        return True
    except ImportError:
        pass
    
    try:
        # Fallback to Pillow with svg support
        from PIL import Image
        import io
        with open(svg_path, 'rb') as f:
            img = Image.open(io.BytesIO(f.read()))
            img.save(png_path, 'PNG')
        return True
    except Exception:
        pass
    
    # If no conversion possible, just copy the SVG
    print(f"  ℹ️  SVG conversion not available, keeping SVG format for {svg_path.name}")
    return False


def scrape_ribbon(award: dict, output_dir: Path) -> Optional[str]:
    """Scrape a single ribbon image from Wikimedia Commons."""
    wiki_file = award.get('wiki_file')
    if not wiki_file:
        return None
    
    # Generate clean filename
    clean_name = sanitize_filename(award['name'])
    
    # Determine output extension based on source
    is_svg = wiki_file.lower().endswith('.svg')
    output_ext = '.png'  # Always output as PNG for consistency
    output_filename = f"{clean_name}{output_ext}"
    output_path = output_dir / output_filename
    
    # Skip if already downloaded
    if output_path.exists():
        print(f"  ✓ Already exists: {output_filename}")
        return output_filename
    
    # Get download URL
    url = get_commons_file_url(wiki_file)
    if not url:
        print(f"  ✗ Could not find: {wiki_file}")
        return None
    
    print(f"  ↓ Downloading: {award['name']}")
    
    if is_svg:
        # Download SVG first, then convert
        temp_svg = output_dir / f"{clean_name}.svg"
        if download_file(url, temp_svg):
            if convert_svg_to_png(temp_svg, output_path):
                temp_svg.unlink()  # Remove temp SVG
            else:
                # Keep SVG if conversion failed
                output_filename = f"{clean_name}.svg"
            time.sleep(REQUEST_DELAY)
            return output_filename
    else:
        # Direct download for PNG/JPG
        if download_file(url, output_path):
            time.sleep(REQUEST_DELAY)
            return output_filename
    
    return None


def scrape_device(device: dict, output_dir: Path) -> Optional[str]:
    """Scrape a single device image from Wikimedia Commons."""
    wiki_file = device.get('wiki_file')
    if not wiki_file:
        return None
    
    # Generate clean filename
    clean_name = sanitize_filename(device['name'])
    
    # Keep original extension for devices (they're often PNG already)
    source_ext = Path(wiki_file).suffix.lower()
    output_filename = f"{clean_name}{source_ext}"
    output_path = output_dir / output_filename
    
    # Skip if already downloaded
    if output_path.exists():
        print(f"  ✓ Already exists: {output_filename}")
        return output_filename
    
    # Get download URL
    url = get_commons_file_url(wiki_file)
    if not url:
        print(f"  ✗ Could not find: {wiki_file}")
        return None
    
    print(f"  ↓ Downloading: {device['name']}")
    
    if download_file(url, output_path):
        time.sleep(REQUEST_DELAY)
        return output_filename
    
    return None


def generate_manifest(awards: List[dict], devices: List[dict]) -> dict:
    """Generate the ribbon_manifest.json structure."""
    manifest = {
        "version": "1.0.0",
        "generated": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_awards": len([a for a in awards if a.get('asset_filename')]),
        "total_devices": len([d for d in devices if d.get('asset_filename')]),
        "awards": awards,
        "devices": devices,
        "precedence_rules": {
            "Army": "AR 670-1",
            "Navy": "NAVPERS 15665I",
            "Marines": "MCO 1020.34H",
            "Air Force": "DAFI 36-2903",
            "Space Force": "DAFI 36-2903",
            "Coast Guard": "COMDTINST M1020.6K"
        },
        "branches": ["Army", "Navy", "Marines", "Air Force", "Coast Guard", "Space Force"]
    }
    return manifest


def main():
    """Main scraper execution."""
    print("=" * 60)
    print("🎖️  Vet-Rate.org Ribbon Asset Scraper")
    print("=" * 60)
    print()
    
    # Create output directories
    print("📁 Creating output directories...")
    RIBBON_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DEVICE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"   Ribbons: {RIBBON_OUTPUT_DIR}")
    print(f"   Devices: {DEVICE_OUTPUT_DIR}")
    print(f"   Manifest: {MANIFEST_OUTPUT_PATH}")
    print()
    
    # Scrape ribbons
    print("🎗️  Scraping ribbon images from Wikimedia Commons...")
    print("-" * 60)
    
    awards_with_files = []
    success_count = 0
    skip_count = 0
    fail_count = 0
    
    for award in MASTER_AWARDS:
        if award.get('wiki_file'):
            filename = scrape_ribbon(award, RIBBON_OUTPUT_DIR)
            award_copy = award.copy()
            award_copy['asset_filename'] = filename
            awards_with_files.append(award_copy)
            
            if filename:
                if "Already exists" in str(filename):
                    skip_count += 1
                else:
                    success_count += 1
            else:
                fail_count += 1
        else:
            # Badge without ribbon (still include in manifest)
            award_copy = award.copy()
            award_copy['asset_filename'] = None
            awards_with_files.append(award_copy)
    
    print()
    print(f"   ✅ Downloaded: {success_count}")
    print(f"   ⏭️  Skipped (exists): {skip_count}")
    print(f"   ❌ Failed: {fail_count}")
    print()
    
    # Scrape devices
    print("⭐ Scraping device images from Wikimedia Commons...")
    print("-" * 60)
    
    devices_with_files = []
    device_success = 0
    device_skip = 0
    device_fail = 0
    
    for device in RIBBON_DEVICES:
        filename = scrape_device(device, DEVICE_OUTPUT_DIR)
        device_copy = device.copy()
        device_copy['asset_filename'] = filename
        devices_with_files.append(device_copy)
        
        if filename:
            device_success += 1
        else:
            device_fail += 1
    
    print()
    print(f"   ✅ Downloaded: {device_success}")
    print(f"   ❌ Failed: {device_fail}")
    print()
    
    # Generate manifest
    print("📋 Generating ribbon_manifest.json...")
    manifest = generate_manifest(awards_with_files, devices_with_files)
    
    with open(MANIFEST_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"   ✅ Manifest saved to: {MANIFEST_OUTPUT_PATH}")
    print()
    
    # Summary
    print("=" * 60)
    print("✨ SCRAPING COMPLETE!")
    print("=" * 60)
    print(f"   Total Awards in Manifest: {manifest['total_awards']}")
    print(f"   Total Devices in Manifest: {manifest['total_devices']}")
    print()
    print("Next steps:")
    print("   1. Review downloaded images in public/images/ribbons/")
    print("   2. The manifest is at src/data/ribbon_manifest.json")
    print("   3. Import the manifest in your React components")
    print()


if __name__ == "__main__":
    main()
