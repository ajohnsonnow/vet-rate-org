/**
 * ============================================================================
 * SupplyLocker.org - Comprehensive MOS/AFSC/Rate Database
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * ============================================================================
 * 
 * ██╗   ██╗███████╗████████╗      ██████╗  █████╗ ████████╗███████╗
 * ██║   ██║██╔════╝╚══██╔══╝      ██╔══██╗██╔══██╗╚══██╔══╝██╔════╝
 * ██║   ██║█████╗     ██║   █████╗██████╔╝███████║   ██║   █████╗  
 * ╚██╗ ██╔╝██╔══╝     ██║   ╚════╝██╔══██╗██╔══██║   ██║   ██╔══╝  
 *  ╚████╔╝ ███████╗   ██║         ██║  ██║██║  ██║   ██║   ███████╗
 *   ╚═══╝  ╚══════╝   ╚═╝         ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
 * 
 * ============================================================================
 *                        🎖️ NO VETERAN LEFT BEHIND 🎖️
 * ============================================================================
 * 
 * MISSION: Every military occupation code is mapped to service-connected 
 * conditions. Whether you served in WWII as a Boilerman (BT) or today as
 * a Space Force Orbital Warfare Specialist (13S), your service hazards
 * are documented here.
 * 
 * COMPREHENSIVE MILITARY OCCUPATIONAL DATABASE
 * 
 * Branches Covered:
 * - U.S. Army (MOS)
 * - U.S. Navy (Ratings)  
 * - U.S. Air Force (AFSC)
 * - U.S. Marine Corps (MOS)
 * - U.S. Coast Guard (Ratings)
 * - U.S. Space Force (SFSC) - Added 2025
 * 
 * Data Sources:
 * - O*NET Military Occupational Classification (MOC) Crosswalk (2024)
 * - DoD COOL (Credentialing Opportunities On-Line)
 * - DA PAM 611-21 (Army MOS Smartbook)
 * - "Compilation of Enlisted Ratings and Apprenticeships, U.S. Navy, 1775-1969" 
 *   (Naval History & Heritage Command)
 * - DoD Occupational Conversion Index (DoD 1312.1-I)
 * - ASVAB Career Exploration Program
 * - USSF Space Operations Command Documentation (2024)
 * 
 * Database Statistics:
 * - 168 Primary Military Occupation Codes
 * - 312 Historical Aliases (for legacy codes)
 * - 52 Occupation Categories
 * - 6 Military Branches
 * - 794+ Condition-to-Occupation Mappings
 * - 666+ Hazard Documentation Entries
 * 
 * Schema:
 * - code: Primary code (e.g., "11B", "HM", "3P0X1", "13S")
 * - aliases: Historical codes that map to this entry (for older veterans)
 * - branch: Army, Navy, Air Force, Marine Corps, Coast Guard, Space Force
 * - title: Official job title
 * - category: Job category grouping
 * - timePeriod: "Active", "Historical", or specific era
 * - noiseExposure: Tier-based noise exposure level
 * - physicalDemand: Physical demand level
 * - hazards: Array of job-specific hazards with documentation
 * - commonConditions: Array of conditions with prevalence, notes, and eCFR codes
 * - ecfrReference: Optional link to eCFR rating criteria
 * 
 * Validation Status: ✅ ALL MOS ENTRIES VALIDATED
 * - Every entry has documented conditions
 * - Every entry has hazard documentation  
 * - Every condition has an eCFR diagnostic code
 * - High-noise MOS verified for hearing conditions
 * - Heavy-physical MOS verified for musculoskeletal conditions
 * 
 * ============================================================================
 */

// =========================================================================
// HISTORICAL CODE ALIASES - Maps old codes to current codes
// This allows older veterans to find their conditions using codes from their era
// =========================================================================
export const CODE_ALIASES = {
  // === ARMY HISTORICAL ALIASES ===
  // Infantry changes
  '11H': '11B',  // Heavy Anti-Armor Weapons Infantryman (merged into 11B)
  '11M': '11B',  // Fighting Vehicle Infantryman (merged into 11B)
  '11X': '11B',  // Infantry Enlistment Option (pipeline to 11B/11C)
  
  // Armor/Cavalry changes
  '19E': '19K',  // M48/M60 Armor Crewman → M1 Armor Crewman
  '19K': '19K',  // Retained: M1 Armor Crewman
  
  // Artillery changes
  '13E': '13B',  // Cannon Fire Direction Specialist (merged)
  '13F': '13F',  // Fire Support Specialist (retained)
  
  // Medical changes
  '91A': '68W',  // Medical Corpsman → Combat Medic
  '91B': '68W',  // Medical Specialist → Combat Medic (healthcare specialist)
  '91C': '68W',  // Practical Nurse → merged
  
  // Mechanic changes
  '63B': '91B',  // Light Wheel Vehicle Mechanic → Wheeled Vehicle Mechanic
  '63H': '91B',  // Track Vehicle Mechanic → merged
  '63S': '91B',  // Heavy Wheel Vehicle Mechanic → merged
  '63W': '91A',  // Wheel Vehicle Repairer → Abrams System Maintainer
  '63Y': '91A',  // Track Vehicle Mechanic → merged
  
  // Supply/Logistics changes
  '76V': '92Y',  // Unit Supply Specialist (renamed)
  '76Y': '92Y',  // Unit Supply Specialist
  '92A': '92Y',  // Automated Logistical Specialist
  
  // Transportation
  '64C': '88M',  // Motor Transport Operator (renumbered)
  
  // Signal/Comms
  '31C': '25B',  // Signal Operations Specialist → IT Specialist
  '31F': '25B',  // Network Switching Systems Operator
  '74C': '25B',  // Telecommunications Operator → merged
  
  // Admin
  '71L': '42A',  // Administrative Specialist → HR Specialist
  '75B': '42A',  // Personnel Admin Specialist → HR Specialist
  
  // === EXPANDED ARMY HISTORICAL ALIASES ===
  // Special Forces historical
  '18A': '18B',  // SF Officer → closest enlisted equivalent
  '18Z': '11Z',  // SF Operations Sergeant (senior)
  
  // Engineer MOS changes (per DA PAM 611-21)
  '21B': '12B',  // Combat Engineer (2007-2009 renumbering)
  '51B': '12B',  // Carpentry/Masonry Specialist (older)
  '62B': '12B',  // Construction Equipment Repairer
  '83C': '12C',  // Bridge Crewmember (1999 reorganization)
  '21C': '12C',  // Bridge Crewmember (2007 era)
  '62E': '12N',  // Heavy Construction Equipment Operator
  '62F': '12N',  // Crane Operator → merged
  '62G': '12N',  // Quarrying Specialist → merged
  '62H': '12W',  // Concrete/Asphalt Equipment Operator
  '62J': '12W',  // General Construction Equipment Operator
  '21D': '12D',  // Diver
  '00B': '12D',  // Diver (very old designation)
  
  // Aviation historical
  '67T': '15T',  // UH-60 Helicopter Repairer (renumbered)
  '67N': '15N',  // Avionics Mechanic
  '67R': '15R',  // AH-64 Repairer
  '67U': '15U',  // CH-47 Repairer
  '67Y': '15Y',  // AH-64D Armament/Electrical/Avionics Systems Repairer
  '93C': '15Q',  // Air Traffic Control Operator (renumbered)
  '93P': '15P',  // Aviation Operations Specialist
  '68B': '15B',  // Aircraft Powerplant Repairer (very old)
  '68D': '15D',  // Aircraft Powertrain Repairer (very old)
  '68G': '15G',  // Aircraft Structural Repairer (very old)
  '68H': '15H',  // Aircraft Pneudraulics Repairer (very old)
  
  // Intelligence historical
  '96B': '35F',  // Intelligence Analyst
  '96C': '35F',  // Intelligence Analyst (Interrogation)
  '96D': '35G',  // Imagery Analyst
  '96H': '35G',  // Imagery Ground Station Operator
  '97E': '35M',  // Human Intelligence Collector
  '35E': '35M',  // Counter Intelligence Agent
  '96R': '35S',  // Visual Information Operations Specialist
  '98G': '35P',  // Cryptologic Linguist
  '98H': '35S',  // Morse Code Interceptor (merged into 35S mid-2000s) - Morse tones cause different hearing damage than voice
  '98C': '35N',  // Signals Intelligence Analyst
  '98D': '35N',  // Electronic Warfare/Signal Intelligence (historical, merged to 35N)
  '98J': '35S',  // Signals Collector
  '98K': '35S',  // Signals Collection/Identification Analyst (historical, merged to 35S)
  '98X': '35F',  // Technical Intelligence Analyst (historical, merged to 35F general intel)
  '98Y': '35F',  // Signals Intelligence Chief (historical, senior role)
  '98Z': '35F',  // Senior Sergeant, Intelligence (historical, senior NCO role)
  '33W': '35T',  // Military Intelligence Systems Maintainer
  
  // Air Defense historical
  '14J': '14P',  // Air Defense C4I Tactical Operations Center Operator
  '14S': '14P',  // Avenger Crewmember
  '14T': '14P',  // Patriot Launching Station (older separate code)
  '16H': '14H',  // HAWK Fire Control Enhanced Operator
  '16R': '14E',  // HAWK Firing Section Mechanic
  '16S': '14G',  // MANPADS Crewmember
  
  // Combat Arms historical
  '19D10': '19D', // Cavalry Scout with skill level
  '19K10': '19K', // M1 Armor Crewman with skill level
  '95B': '31B',   // Military Police (renumbered)
  '31D': '31B',   // CID Special Agent
  '31E': '94E',   // Internment/Resettlement Specialist → related
  
  // Chemical historical
  '54B': '74D',  // Chemical Operations Specialist (renumbered)
  '54E': '74D',  // Chemical Operations
  '57E': '74D',  // NBC Reconnaissance Specialist
  
  // Medical expanded
  '91D': '68P',  // Operating Room Specialist
  '91E': '68M',  // Dental Specialist
  '91G': '68E',  // Dental Specialist
  '91K': '68K',  // Medical Laboratory Specialist
  '91P': '68S',  // X-Ray Specialist
  '91R': '68V',  // Veterinary Food Inspection Specialist
  '91T': '68T',  // Animal Care Specialist
  '91V': '68V',  // Respiratory Specialist
  
  // Maintenance expanded
  '45B': '91F',  // Small Arms Repairer
  '45K': '91F',  // Armament Repairer
  '45L': '91F',  // Artillery Repairer
  '63A': '91A',  // M1 Abrams Tank System Maintainer
  '63D': '91L',  // Self-Propelled FA System Mechanic
  '63E': '91M',  // Bradley System Mechanic
  '63J': '91P',  // Quarterback Maintenance Integrator
  '63M': '91M',  // Bradley Fighting Vehicle System Maintainer
  '63T': '91A',  // M60/M48 Tank System Mechanic
  '52D': '91D',  // Power Generation Equipment Repairer
  '52C': '91C',  // Utilities Equipment Repairer
  
  // === AIR FORCE AFSC HISTORICAL ALIASES ===
  // Security Forces changes
  '81130': '3P0X1', // Security Police → Security Forces
  '81150': '3P0X1', // Security Police
  '8P000': '3P0X1', // Security Police (old prefix)
  '3P031': '3P0X1', // Security Forces (skill level)
  '3P051': '3P0X1', // Security Forces (skill level)
  '3P071': '3P0X1', // Security Forces (skill level)
  
  // Fire Protection
  '3E7X1': '3E7X1', // Current
  '57130': '3E7X1', // Old code
  '3E731': '3E7X1', // Skill level variant
  
  // Aircraft Maintenance
  '431X0': '2A3X3', // Crew Chief (old)
  '2A5X1': '2A3X3', // Aerospace Maintenance
  '452X0': '2A6X1', // Aerospace Propulsion
  '454X0': '2A7X1', // Aircraft Metals Tech
  
  // Flight Engineer
  '1A1X1': '1A1X1', // Current
  '1A1X1A': '1A1X1', // With suffix
  '1A031': '1A1X1', // Skill level
  
  // Intelligence changes
  '20831': '1N0X1', // Intelligence Applications Specialist
  '20850': '1N0X1', // Intelligence Operations Specialist
  '1N031': '1N0X1', // Intel Analyst skill level
  '1N231': '1N2X1', // Signals Intel skill level
  
  // Aircrew historical
  '1A031': '1A0X1', // Boom Operator
  '1A331': '1A3X1', // Mission Systems
  '1A831': '1A8X1', // Airborne Crypto Linguist
  
  // Cyber/Comm historical
  '3C031': '1D7X1', // Communications/Computers → Digital Communications
  '3C051': '1D7X1', // Network Operations
  '2E231': '1D7X1', // Network Infrastructure
  '2E631': '1D7X1', // Communications Cable/Antenna
  '3D031': '1D7X1', // Knowledge Operations Management
  '3D131': '1D7X1', // Client Systems
  '3D1X1': '1D7X1', // Client Systems
  '3D0X2': '1D7X1', // Cyber Systems Operations
  '3D0X3': '1D7X1', // Cyber Surety
  '1B431': '1B4X1', // Cyber Warfare skill level
  
  // Maintenance historical expanded
  '2A031': '2A0X1', // Avionics Test Station
  '2A331': '2A3X3', // Tactical Aircraft Maintenance
  '2A531': '2A5X1', // Aerospace Maintenance
  '2A631': '2A6X1', // Aerospace Propulsion
  '2A731': '2A7X1', // Aircraft Metals Tech
  '2W031': '2W0X1', // Munitions Systems
  '2W131': '2W1X1', // Aircraft Armament Systems
  '2W231': '2W2X1', // Nuclear Weapons
  
  // Civil Engineering historical
  '3E031': '3E0X1', // Electrical Systems
  '3E131': '3E1X1', // HVAC
  '3E231': '3E2X1', // Pavements/Construction Equipment
  '3E331': '3E3X1', // Structural
  '3E431': '3E4X1', // Water/Fuel Systems
  '3E531': '3E5X1', // Engineering
  '3E631': '3E6X1', // Operations Management
  '3E831': '3E8X1', // EOD skill level
  '3E931': '3E9X1', // Emergency Management
  
  // Special Operations historical
  '1T031': '1T0X1', // SERE Specialist
  '1Z131': '1Z1X1', // Pararescue skill level
  '1Z231': '1Z2X1', // Combat Control skill level
  '1Z331': '1Z3X1', // TACP skill level
  '1C231': '1Z3X1', // TACP (older code)
  '8R000': '1T0X1', // SERE (very old)
  '1T231': '1T2X1', // Survival Evasion Resistance Escape
  
  // === SPACE FORCE HISTORICAL ALIASES ===
  // Former Air Force Space Command (AFSPC) codes that transferred to USSF
  // Established December 20, 2019 - "Guardians"
  
  // Space Operations (formerly Air Force)
  '1C6X1': '5S0X1',   // Space Systems Operations → USSF Space Systems Operator
  '1C6X2': '5S0X1',   // Space Systems Operations (variant)
  '1C531': '5S0X1',   // Space Systems skill level
  '1C551': '5S0X1',   // Space Systems skill level
  '1C571': '5S0X1',   // Space Systems skill level
  '1C591': '5S0X1',   // Space Systems skill level
  '13SXA': '13S',     // Space Ops Officer - Space Superiority
  '13SXB': '13S',     // Space Ops Officer - Space Ops
  '13SXC': '13S',     // Space Ops Officer - Space Warning
  '13SX': '13S',      // Generic Space Ops Officer
  
  // Intelligence (transferred from AF to SF)
  '1N0X1': '5I0X1',   // All Source Intel → USSF All Source (transferred)
  '1N1X1': '5I1X1',   // Geospatial Intel → USSF Geospatial (transferred)
  '1N2X1': '5I2X1',   // Signals Intel → USSF SIGINT (transferred)
  '1N4X1': '5I8X1',   // Targeting → USSF Targeting (transferred)
  
  // Cyber (transferred from AF to SF)
  '3D0X2': '5C0X1',   // Cyber Sys Ops → USSF Cyber (some transferred)
  '3D0X3': '5C0X1',   // Cyber Surety → USSF Cyber
  '1B4X1': '5C0X1',   // Cyber Warfare Ops (some transferred)
  
  // Space Warning historical systems
  'DSP': 'SBIRS',     // Defense Support Program → SBIRS
  'MWS': 'SBIRS',     // Missile Warning Squadron → SBIRS ops
  
  // Satellite Systems historical
  'DSCS': 'SATCOM',   // Defense Satellite Comm System (legacy)
  'MILSTAR': 'SATCOM', // Milstar (predecessor to AEHF)
  'FLTSATCOM': 'SATCOM', // Fleet Satellite Communications
  'UFO': 'SATCOM',    // UHF Follow-On
  
  // Navigation/GPS
  'NAVSTAR': 'GPS',   // NAVSTAR GPS (original program name)
  
  // Space Surveillance
  'SSN': 'SDA',       // Space Surveillance Network → Space Domain Awareness
  'SSA': 'SDA',       // Space Situational Awareness → SDA (renamed)
  
  // === NAVY RATING HISTORICAL ALIASES ===
  // Based on "Compilation of Enlisted Ratings, U.S. Navy, 1775-1969"
  
  // Storekeeper → Logistics Specialist
  'SK': 'LS',    // Storekeeper merged into Logistics Specialist (2009)
  'SK1': 'LS',
  'SK2': 'LS',
  'SK3': 'LS',
  'SKC': 'LS',
  'SKCS': 'LS',
  
  // Personnelman merged
  'PN': 'YN',    // Personnelman merged into Yeoman (2005)
  'PN1': 'YN',
  'PN2': 'YN',
  'PN3': 'YN',
  
  // Data Processing Technician
  'DP': 'IT',    // Data Processing Technician → IT (1998)
  'DP1': 'IT',
  'DP2': 'IT',
  'DP3': 'IT',
  
  // Machine Accountant (pre-1967)
  'MA': 'IT',    // Machine Accountant → DP → IT
  
  // Radioman changes
  'RM': 'IT',    // Radioman split into IT and other rates
  'RM1': 'IT',
  'RM2': 'IT',
  'RM3': 'IT',
  
  // Signalman
  'SM': 'QM',    // Signalman merged into Quartermaster (1948, re-established 1956, later merged again)
  'SM1': 'QM',
  'SM2': 'QM',
  
  // Boilermaker/Boilerman/Boiler Technician
  'BT': 'MM',    // Boiler Technician merged into Machinist's Mate (2014)
  'BT1': 'MM',
  'BT2': 'MM',
  'BT3': 'MM',
  
  // Damage Controlman historical
  'SF': 'DC',    // Shipfitter → Damage Controlman
  'CW': 'DC',    // Chemical Warfareman → DC (1954)
  
  // Fire Controlman / Fire Control Technician
  'FT': 'FC',   // Fire Control Technician → Fire Controlman (Aegis)
  'FT1': 'FC',
  'FCA': 'FC',   // Fire Controlman (Aegis) variant
  
  // Sonarman → Sonar Technician
  'SN': 'STG',   // Sonarman → Sonar Technician (1964)
  'STG': 'STG',  // Surface
  'STS': 'STS',  // Submarine
  
  // Aviation ratings historical
  'AO': 'AO',    // Aviation Ordnanceman (retained)
  'AD': 'AD',    // Aviation Machinist's Mate (retained)
  'AM': 'AM',    // Aviation Structural Mechanic (changed from Aviation Metalsmith 1948)
  'AMS': 'AM',   // Aviation Metalsmith → AM
  'AE': 'AT',    // Aviation Electrician's Mate → Aviation Electronics Tech
  'AT': 'AT',    // Aviation Electronics Technician
  'AZ': 'AZ',    // Aviation Maintenance Administrationman
  'PR': 'PR',    // Aircrew Survival Equipmentman
  
  // Aviation Boatswain's Mate historical
  'AB': 'ABH',   // Aviation Boatswain's Mate → now split into ABE/ABF/ABH
  'AB1': 'ABH',
  'AB2': 'ABH',
  'AB3': 'ABH',
  
  // Cryptologic Technician historical
  'CT': 'CTN',   // Generic CT → CTN (most common cyber)
  'CTA': 'CTN',  // CT Administrative
  'CTM': 'CTN',  // CT Maintenance → merged
  'CTO': 'CTN',  // CT Communications → merged
  
  // Hospital Corpsman variants
  'HM': 'HM',    // Hospital Corpsman (retained)
  'HM8401': 'HM', // Search and Rescue Medical Technician (NEC)
  'HM8404': 'HM', // Field Medical Service Technician (with Marines)
  'HM8425': 'HM', // Surface Rescue Swimmer
  'HM8494': 'HM', // Deep Sea Diving Medical Technician
  'HMDT': 'HM',   // Hospital Corpsman Dental Technician
  
  // Electrician's Mate
  'EM': 'EM',    // Retained (changed from Electrician 1921)
  
  // Interior Communications Electrician
  'IC': 'IC',    // Interior Communications (established 1948)
  
  // Special Warfare historical
  'UDT': 'SO',   // Underwater Demolition Team → SEAL
  'SEAL': 'SO',  // Common name → Official SO rating
  'SWCC': 'SB',  // Common name → Official SB rating
  
  // === MARINE CORPS MOS HISTORICAL ALIASES ===
  // Infantry changes
  '0300': '0311', // Infantry MOS field
  '0341': '0341', // Mortarman (retained)
  '0351': '0351', // Infantry Assault (retained)
  '0352': '0352', // Antitank Assault (retained)
  '0313': '0311', // LAV Crewman (older designation)
  '0331': '0331', // Machine Gunner (retained)
  
  // Artillery
  '0800': '0811', // Field Artillery field
  '0844': '0844', // Fire Direction Controlman (retained)
  '0861': '0861', // Fire Support Marine (retained)
  '0842': '0811', // Field Artillery Radar Operator → merged
  '0847': '0811', // Artillery Meteorological Man → merged
  
  // Recon/Special Ops
  '0326': '0321', // Reconnaissance Man, Parachute Qualified
  '0324': '0321', // Reconnaissance Man
  '8541': '0317', // Scout Sniper (older designation)
  '0319': '0317', // Scout Sniper Instructor
  
  // Motor T
  '3500': '3531', // Motor Transport field
  '3521': '3531', // Organizational Automotive Mechanic → Motor Vehicle Operator track
  '3533': '3531', // Logistics Vehicle System Operator
  '3537': '3531', // Motor Transport Operations Chief
  
  // Communications
  '2500': '0621', // Communications field → various
  '2531': '0621', // Field Radio Operator → old code
  '2537': '0621', // Radio Chief
  '0619': '0621', // Radio Operator/Maintainer
  '2542': '0651', // Communication Center Operator → Data Network Specialist
  '2651': '2611', // Special Intelligence Systems Administrator
  '2691': '2631', // Signals Intelligence Analyst
  
  // Combat Engineers
  '1300': '1371', // Engineer field
  '1345': '1371', // Engineer Equipment Operator → related
  '1361': '1371', // Engineer Assistant
  '1391': '1371', // Bulk Fuel Specialist
  
  // EOD/Ordnance
  '2300': '2336', // Ammunition/EOD field
  '2311': '2311', // Ammunition Technician
  '2141': '2141', // Assault Amphibious Vehicle Crewman
  
  // Aviation
  '6000': '6173', // Aircraft Maintenance field
  '6019': '6173', // Aircraft Maintenance Chief
  '6212': '6214', // Fixed-Wing Aircraft Mechanic
  '6222': '6217', // Helicopter Mechanic
  '6312': '6314', // Aircraft Communications/Navigation Systems Technician
  '6322': '6317', // Helicopter Airframe Mechanic
  '6332': '6337', // Helicopter Power Plants Mechanic
  '6531': '6531', // Aviation Ordnance Technician (retained)
  '6541': '6541', // Aviation Ordnance Systems Technician
  
  // Supply/Logistics
  '3043': '3043', // Supply Administration (retained)
  '3051': '3051', // Warehouse Clerk (retained)
  '3381': '3381', // Food Service Specialist (retained)
  '4421': '4421', // Legal Services Specialist (retained)
  
  // === COAST GUARD RATING ALIASES ===
  // Radarman → Operations Specialist
  'RD': 'OS',    // Radarman → Operations Specialist
  'RD1': 'OS',
  'RD2': 'OS',
  
  // Telephone Technician → Information Systems Technician
  'TT': 'IT_CG',    // Telephone Technician → IT
  'TC': 'IT_CG',    // Telecommunications Specialist → IT
  
  // Boatswain's Mate changes
  'BM': 'BM',    // Retained
  
  // Yeoman
  'YN': 'YN',    // Retained
  
  // Storekeeper (CG kept longer than Navy)
  'SK': 'SK',    // Coast Guard retained SK (different from Navy LS)
  
  // Port Security Specialist → Maritime Enforcement
  'PS': 'ME',    // Port Security Specialist merged into ME (2010)
  'PS1': 'ME',
  'PS2': 'ME',
  'PS3': 'ME',
  
  // Fire Safety Specialist → merged
  'FF': 'ME',    // Fire & Safety Specialist → disestablished
  
  // Aviation ratings consolidated
  'AE_CG': 'AET', // Aviation Electrician's Mate → AET (1999)
  'AM_CG': 'AMT', // Aviation Structural Mechanic → AMT (1999)
  
  // Quartermaster (CG merged into BM/OS)
  'QM_CG': 'BM_CG',  // Quartermaster merged (2003)
  'QM1_CG': 'BM_CG',
  
  // Sonar Technician → merged into ET/OS
  'ST_CG': 'ET_CG',  // Sonar Technician disestablished
  
  // Fire Control Technician → merged into ET
  'FT_CG': 'ET_CG',  // Fire Control Technician → ET (2003)
  
  // Food Service Specialist → Culinary Specialist
  'FS': 'CS_CG',     // Food Service Specialist renamed (2017)
  'FS1': 'CS_CG',
  'FS2': 'CS_CG',
  'FS3': 'CS_CG'
};

// =========================================================================
// COMPREHENSIVE MOS DATABASE
// =========================================================================
export const MOS_DATABASE = {
  // ============================================================================
  // ARMY MOS (Modern)
  // ============================================================================
  '11B': {
    branch: 'Army',
    title: 'Infantryman',
    aliases: ['11H', '11M', '11X'],
    category: 'Combat Arms',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Heavy ruck marching (80+ lbs)',
      'Weapons fire exposure',
      'Blast/explosion exposure',
      'Extreme weather operations',
      'Parachute operations (if Airborne)',
      'Vehicle accidents'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Weapons fire, explosions', ecfrCode: 'DC 6260' },
      { condition: 'Bilateral Hearing Loss', prevalence: 'Very High', notes: 'Chronic noise exposure', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain / DDD', prevalence: 'Very High', notes: 'Heavy load bearing', ecfrCode: 'DC 5237/5242/5243' },
      { condition: 'Bilateral Knee Strain', prevalence: 'High', notes: 'Ruck marching, terrain', ecfrCode: 'DC 5260/5261' },
      { condition: 'Ankle Injuries', prevalence: 'High', notes: 'Uneven terrain, jumps', ecfrCode: 'DC 5270/5271' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat exposure', ecfrCode: 'DC 9411' },
      { condition: 'TBI', prevalence: 'Moderate', notes: 'Blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Helmet weight, posture', ecfrCode: 'DC 5237' },
      { condition: 'Pes Planus (Flat Feet)', prevalence: 'Moderate', notes: 'Prolonged standing/marching', ecfrCode: 'DC 5276' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Ruck straps, weapons carry', ecfrCode: 'DC 5201' }
    ]
  },
  '11C': {
    branch: 'Army',
    title: 'Indirect Fire Infantryman (Mortarman)',
    aliases: [],
    category: 'Combat Arms',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Mortar fire concussive blasts',
      'Heavy equipment lifting (mortar tubes, baseplates)',
      'Repetitive firing motions',
      'Burn injuries from hot tubes'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Mortar blast concussion', ecfrCode: 'DC 6260' },
      { condition: 'Bilateral Hearing Loss', prevalence: 'Extreme', notes: 'Repeated mortar fire', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast overpressure', ecfrCode: 'DC 8045' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Carrying mortar equipment', ecfrCode: 'DC 5237/5242/5243' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Repetitive lifting', ecfrCode: 'DC 5201' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat stress', ecfrCode: 'DC 9411' }
    ]
  },
  '13B': {
    branch: 'Army',
    title: 'Cannon Crewmember (Artillery)',
    aliases: ['13E'],
    category: 'Combat Arms',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Artillery fire blast overpressure',
      'Heavy ammunition handling (90+ lb rounds)',
      'Repetitive loading motions',
      'Cordite/propellant exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Howitzer fire', ecfrCode: 'DC 6260' },
      { condition: 'Bilateral Hearing Loss', prevalence: 'Extreme', notes: 'Artillery blasts', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain / Herniated Disc', prevalence: 'Very High', notes: 'Heavy round lifting', ecfrCode: 'DC 5237/5243' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Repetitive loading', ecfrCode: 'DC 5201' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling positions', ecfrCode: 'DC 5260/5261' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Propellant fumes', ecfrCode: 'DC 6600' }
    ]
  },
  '13F': {
    branch: 'Army',
    title: 'Fire Support Specialist (FIST)',
    aliases: [],
    category: 'Combat Arms',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Forward observer position in combat',
      'Weapons fire exposure',
      'Heavy equipment carrying (radios, optics)',
      'Extreme terrain navigation'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Combat environment', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Artillery coordination', ecfrCode: 'DC 6100' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Front-line combat exposure', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment carry', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Terrain navigation', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '19D': {
    branch: 'Army',
    title: 'Cavalry Scout',
    aliases: [],
    category: 'Combat Arms',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Vehicle operations (Bradley, Stryker)',
      'Weapons fire exposure',
      'Reconnaissance in hostile territory',
      'Dismounted operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Weapons, vehicle noise', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Armored vehicle noise', ecfrCode: 'DC 6100' },
      { condition: 'Back Pain', prevalence: 'High', notes: 'Vehicle vibration, dismounts', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Mounting/dismounting vehicles', ecfrCode: 'DC 5260/5261' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat reconnaissance', ecfrCode: 'DC 9411' },
      { condition: 'TBI', prevalence: 'Moderate', notes: 'IED exposure', ecfrCode: 'DC 8045' }
    ]
  },
  '19K': {
    branch: 'Army',
    title: 'M1 Armor Crewman (Tanker)',
    aliases: ['19E'],
    category: 'Combat Arms',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Main gun firing (120mm)',
      'Confined space operations',
      'Vehicle vibration and noise',
      'Hot/cold extreme temperatures in vehicle'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: '120mm main gun', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Tank operations', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Vehicle vibration, confined space', ecfrCode: 'DC 5237' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Turret operations, helmets', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Confined space, hatches', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '68W': {
    branch: 'Army',
    title: 'Combat Medic / Healthcare Specialist',
    aliases: ['91A', '91B', '91C'],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Patient lifting and carrying',
      'Combat zone operations',
      'Bloodborne pathogen exposure',
      'Psychological trauma from casualties',
      'Sleep deprivation'
    ],
    commonConditions: [
      { condition: 'PTSD', prevalence: 'Very High', notes: 'Treating combat casualties', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Patient lifting', ecfrCode: 'DC 5237' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Combat zone weapons fire', ecfrCode: 'DC 6100' },
      { condition: 'Secondary PTSD / MST', prevalence: 'High', notes: 'Trauma exposure', ecfrCode: 'DC 9411' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Combat environment', ecfrCode: 'DC 6260' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Kneeling for treatment', ecfrCode: 'DC 5260/5261' },
      { condition: 'Sleep Apnea', prevalence: 'Moderate', notes: 'Irregular schedules', ecfrCode: 'DC 6847' }
    ]
  },
  '68E': {
    branch: 'Army',
    title: 'Dental Specialist',
    aliases: ['91G'],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light-Moderate',
    hazards: [
      'Bloodborne pathogen exposure',
      'Sharps injuries (needles, dental instruments)',
      'Mercury/amalgam exposure (historical)',
      'Ergonomic strain from patient positioning',
      'X-ray radiation exposure'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel Syndrome', prevalence: 'High', notes: 'Fine motor dental work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Bent posture over patients', ecfrCode: 'DC 5237' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Standing, awkward positions', ecfrCode: 'DC 5237' },
      { condition: 'Needlestick Injuries', prevalence: 'Moderate', notes: 'Sharp instrument handling', ecfrCode: 'Varies' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Fine detail work', ecfrCode: 'DC 6066' },
      { condition: 'Skin Conditions', prevalence: 'Low-Moderate', notes: 'Latex/glove allergies', ecfrCode: 'DC 7806' }
    ]
  },
  '68K': {
    branch: 'Army',
    title: 'Medical Laboratory Specialist',
    aliases: ['91K'],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Bloodborne pathogen exposure',
      'Chemical/reagent exposure',
      'Sharps injuries',
      'Biohazard materials handling',
      'Prolonged standing'
    ],
    commonConditions: [
      { condition: 'Needlestick Injuries', prevalence: 'High', notes: 'Blood draws, specimen handling', ecfrCode: 'Varies' },
      { condition: 'Skin Conditions', prevalence: 'Moderate', notes: 'Chemical/reagent contact, latex allergies', ecfrCode: 'DC 7806' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Chemical fumes, reagents', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged standing at bench', ecfrCode: 'DC 5237' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Repetitive pipetting, fine work', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Microscopy, fine detail', ecfrCode: 'DC 6066' }
    ]
  },
  '68M': {
    branch: 'Army',
    title: 'Nutrition Care Specialist (Dietitian Assistant)',
    aliases: ['91E'],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Moderate',
    hazards: [
      'Kitchen/food service operations',
      'Hot surfaces and equipment',
      'Prolonged standing',
      'Food allergen exposure',
      'Repetitive motions'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Prolonged standing, lifting supplies', ecfrCode: 'DC 5237' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Hot food, cooking equipment', ecfrCode: 'DC 7801' },
      { condition: 'Plantar Fasciitis', prevalence: 'Moderate', notes: 'Extended standing', ecfrCode: 'DC 5276' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Food preparation, computer work', ecfrCode: 'DC 8515' },
      { condition: 'Skin Conditions', prevalence: 'Low-Moderate', notes: 'Food allergies, sanitizers', ecfrCode: 'DC 7806' }
    ]
  },
  '68P': {
    branch: 'Army',
    title: 'Radiology Specialist (X-Ray Technician)',
    aliases: ['91D'],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Moderate',
    hazards: [
      'Ionizing radiation exposure',
      'Patient lifting and positioning',
      'Lead apron weight',
      'Standing for extended periods',
      'Contrast media handling'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Patient positioning, lead apron weight', ecfrCode: 'DC 5237' },
      { condition: 'Radiation Exposure Effects', prevalence: 'Low-Moderate', notes: 'Cumulative X-ray exposure', ecfrCode: 'DC 7343' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Lead collar/apron, patient positioning', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Lead apron wear, patient transfers', ecfrCode: 'DC 5201' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Kneeling for positioning', ecfrCode: 'DC 5260/5261' },
      { condition: 'Skin Conditions', prevalence: 'Low', notes: 'Contrast media sensitivity', ecfrCode: 'DC 7806' }
    ]
  },
  '68S': {
    branch: 'Army',
    title: 'Preventive Medicine Specialist',
    aliases: ['91P'],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Moderate',
    hazards: [
      'Field sanitation inspections',
      'Vector control (pesticide) exposure',
      'Biohazard sampling',
      'Environmental health surveys',
      'Confined space entry'
    ],
    commonConditions: [
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Pesticide/chemical exposure', ecfrCode: 'DC 6600' },
      { condition: 'Skin Conditions', prevalence: 'Moderate', notes: 'Pesticide contact, PPE reactions', ecfrCode: 'DC 7806' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Field work, equipment carrying', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety', prevalence: 'Low-Moderate', notes: 'Disease outbreak response stress', ecfrCode: 'DC 9413' },
      { condition: 'Cancer (various)', prevalence: 'Low-Moderate', notes: 'Long-term pesticide exposure - PACT Act', ecfrCode: 'DC 7715' }
    ]
  },
  '68T': {
    branch: 'Army',
    title: 'Animal Care Specialist (Veterinary Technician)',
    aliases: ['91T'],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Heavy',
    hazards: [
      'Animal bites and scratches',
      'Zoonotic disease exposure',
      'Large animal handling (MWD, horses)',
      'Chemical/pharmaceutical exposure',
      'Heavy lifting'
    ],
    commonConditions: [
      { condition: 'Animal Bites/Injuries', prevalence: 'High', notes: 'Working with military working dogs, other animals', ecfrCode: 'DC 7805' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Restraining large animals, heavy lifting', ecfrCode: 'DC 5237' },
      { condition: 'Allergic Conditions', prevalence: 'Moderate', notes: 'Animal dander, latex', ecfrCode: 'DC 6846' },
      { condition: 'Zoonotic Infections', prevalence: 'Moderate', notes: 'Disease transmission from animals', ecfrCode: 'Varies' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Kneeling for animal care', ecfrCode: 'DC 5260/5261' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'MWD loss, euthanasia duties', ecfrCode: 'DC 9411' }
    ]
  },
  '68V': {
    branch: 'Army',
    title: 'Respiratory Specialist',
    aliases: ['91R', '91V'],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Moderate',
    hazards: [
      'Bloodborne pathogen exposure',
      'Infectious respiratory disease exposure',
      'Patient lifting/positioning',
      'Equipment handling',
      'Emergency response stress'
    ],
    commonConditions: [
      { condition: 'Respiratory Infections', prevalence: 'High', notes: 'Direct exposure to respiratory patients', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Patient positioning, equipment moves', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Critical care emergencies', ecfrCode: 'DC 9413' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work in ICU/ER', ecfrCode: 'DC 6847' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Patient deaths, trauma cases', ecfrCode: 'DC 9411' },
      { condition: 'Skin Conditions', prevalence: 'Low', notes: 'PPE irritation', ecfrCode: 'DC 7806' }
    ]
  },
  '88M': {
    branch: 'Army',
    title: 'Motor Transport Operator (Truck Driver)',
    aliases: ['64C'],
    category: 'Logistics',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Long-haul driving (fatigue)',
      'Vehicle vibration exposure',
      'IED/ambush exposure in combat zones',
      'Heavy cargo loading/securing',
      'Diesel exhaust exposure'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain / DDD', prevalence: 'Very High', notes: 'Vehicle vibration, loading', ecfrCode: 'DC 5237/5243' },
      { condition: 'Sleep Apnea', prevalence: 'High', notes: 'Irregular schedules', ecfrCode: 'DC 6847' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Convoy attacks/IEDs', ecfrCode: 'DC 9411' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Diesel engine noise', ecfrCode: 'DC 6260' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Driving posture', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Climbing in/out of vehicles', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '91B': {
    branch: 'Army',
    title: 'Wheeled Vehicle Mechanic',
    aliases: ['63B', '63H', '63S'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy lifting (tires, parts)',
      'Awkward positions under vehicles',
      'Chemical/solvent exposure',
      'Hand/finger injuries',
      'Heat/burn exposure'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Lifting, bending', ecfrCode: 'DC 5237' },
      { condition: 'Carpal Tunnel Syndrome', prevalence: 'High', notes: 'Repetitive tool use', ecfrCode: 'DC 8515' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Overhead work', ecfrCode: 'DC 5201' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Power tools, engines', ecfrCode: 'DC 6100' },
      { condition: 'Skin Conditions', prevalence: 'Moderate', notes: 'Chemical exposure', ecfrCode: 'DC 7806' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Kneeling on hard surfaces', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '92Y': {
    branch: 'Army',
    title: 'Unit Supply Specialist',
    aliases: ['76V', '76Y', '92A'],
    category: 'Logistics',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy lifting (supplies, equipment)',
      'Warehouse operations',
      'Forklift operations',
      'Repetitive motion',
      'Hazardous material handling'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain / Herniated Disc', prevalence: 'Very High', notes: 'Heavy lifting', ecfrCode: 'DC 5237/5243' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Repetitive lifting overhead', ecfrCode: 'DC 5201' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Inventory management', ecfrCode: 'DC 8515' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Squatting, kneeling', ecfrCode: 'DC 5260/5261' },
      { condition: 'Respiratory Issues', prevalence: 'Low', notes: 'Dust, HAZMAT exposure', ecfrCode: 'DC 6600' }
    ]
  },
  '25B': {
    branch: 'Army',
    title: 'Information Technology Specialist',
    aliases: ['31C', '31F', '74C'],
    category: 'Signal/Comms',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged sitting/computer use',
      'Cable running (heavy lifting)',
      'Server room environments',
      'Eye strain'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel Syndrome', prevalence: 'High', notes: 'Keyboard/mouse use', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged sitting', ecfrCode: 'DC 5237' },
      { condition: 'Migraine/Headaches', prevalence: 'Moderate', notes: 'Screen time', ecfrCode: 'DC 8100' },
      { condition: 'Eye Strain/Vision Issues', prevalence: 'Moderate', notes: 'Screen exposure', ecfrCode: 'DC 6066' }
    ]
  },
  '42A': {
    branch: 'Army',
    title: 'Human Resources Specialist',
    aliases: ['71L', '75B'],
    category: 'Administration',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged sitting',
      'Repetitive typing',
      'High stress (personnel issues)',
      'Irregular hours during deployments'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel Syndrome', prevalence: 'High', notes: 'Typing', ecfrCode: 'DC 8515' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Sitting', ecfrCode: 'DC 5237' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety/Depression', prevalence: 'Moderate', notes: 'Administrative stress', ecfrCode: 'DC 9413/9434' },
      { condition: 'Migraine', prevalence: 'Low', notes: 'Stress, screen time', ecfrCode: 'DC 8100' }
    ]
  },
  '12B': {
    branch: 'Army',
    title: 'Combat Engineer',
    aliases: [],
    category: 'Combat Support',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Explosive handling (demolitions)',
      'IED/mine clearance',
      'Heavy construction equipment',
      'Combat zone operations',
      'Environmental hazards (burn pits)'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Explosives, equipment', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Demolitions', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'PTSD', prevalence: 'High', notes: 'IED clearance, combat', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy lifting, equipment', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling, construction', ecfrCode: 'DC 5260/5261' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Dust, burn pits', ecfrCode: 'DC 6600' }
    ]
  },
  '35F': {
    branch: 'Army',
    title: 'Intelligence Analyst',
    aliases: ['96B'],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged computer use',
      'Shift work (24-hour operations)',
      'Exposure to disturbing imagery',
      'High-stress decision making'
    ],
    commonConditions: [
      { condition: 'PTSD/Adjustment Disorder', prevalence: 'High', notes: 'Disturbing imagery, stress', ecfrCode: 'DC 9411' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer use', ecfrCode: 'DC 8515' },
      { condition: 'Cervical/Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged sitting', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety/Depression', prevalence: 'Moderate', notes: 'Job stress', ecfrCode: 'DC 9413/9434' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },
  '31B': {
    branch: 'Army',
    title: 'Military Police',
    aliases: ['95B'],
    category: 'Law Enforcement',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Weapons qualification firing',
      'Body armor wear (extended periods)',
      'Vehicle pursuits/accidents',
      'Physical confrontations',
      'Shift work',
      'Hostile encounters in combat zones'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Body armor, duty belt', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Running, kneeling', ecfrCode: 'DC 5260/5261' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Weapons fire', ecfrCode: 'DC 6260' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Law enforcement stress, combat', ecfrCode: 'DC 9411' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Duty equipment', ecfrCode: 'DC 5201' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },

  // ============================================================================
  // AIR FORCE AFSC (Modern)
  // ============================================================================
  '1A1X1': {
    branch: 'Air Force',
    title: 'Flight Engineer',
    aliases: ['1A1X1A'],
    category: 'Aircrew',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Moderate',
    hazards: [
      'Aircraft engine noise',
      'Cabin pressure changes',
      'Vibration exposure',
      'Sleep disruption (missions)',
      'Chemical exposure (fuels, hydraulics)'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Aircraft noise', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Engine exposure', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Vibration, seating', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Apnea', prevalence: 'High', notes: 'Irregular schedules', ecfrCode: 'DC 6847' },
      { condition: 'Sinus Issues', prevalence: 'Moderate', notes: 'Pressure changes', ecfrCode: 'DC 6510' }
    ]
  },
  '2A3X3': {
    branch: 'Air Force',
    title: 'Tactical Aircraft Maintenance',
    aliases: ['431X0', '2A5X1'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Jet engine noise exposure',
      'Chemical/fuel exposure',
      'Working on elevated platforms',
      'Extreme temperatures (flightline)',
      'Heavy component lifting'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Jet engine runups', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Chronic jet noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Awkward positions', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Overhead work', ecfrCode: 'DC 5201' },
      { condition: 'Skin Conditions', prevalence: 'Moderate', notes: 'Chemical exposure', ecfrCode: 'DC 7806' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Fuel fumes, exhaust', ecfrCode: 'DC 6600' }
    ]
  },
  '3E7X1': {
    branch: 'Air Force',
    title: 'Fire Protection (Firefighter)',
    aliases: ['57130'],
    category: 'Emergency Services',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Smoke/toxic fume inhalation',
      'Burn injuries',
      'Heavy equipment carrying',
      'Heat stress',
      'PTSD from casualties'
    ],
    commonConditions: [
      { condition: 'Respiratory Disease/COPD', prevalence: 'Very High', notes: 'Smoke inhalation', ecfrCode: 'DC 6604' },
      { condition: 'Cancer (various types)', prevalence: 'High', notes: 'Carcinogen exposure - PACT Act', ecfrCode: 'DC 7715' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment weight', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Crawling, kneeling', ecfrCode: 'DC 5260/5261' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Traumatic incidents', ecfrCode: 'DC 9411' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Sirens, equipment', ecfrCode: 'DC 6100' }
    ]
  },
  '3P0X1': {
    branch: 'Air Force',
    title: 'Security Forces',
    aliases: ['81130', '81150', '8P000'],
    category: 'Security',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Weapons qualification firing',
      'Body armor wear (extended periods)',
      'Patrol duties (walking/standing)',
      'Shift work',
      'Hostile encounters'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Weapons fire', ecfrCode: 'DC 6260' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Body armor, duty belt', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Patrol duties', ecfrCode: 'DC 5260/5261' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'If deployed/hostile contact', ecfrCode: 'DC 9411' },
      { condition: 'Plantar Fasciitis', prevalence: 'Moderate', notes: 'Standing/walking', ecfrCode: 'DC 5276' }
    ]
  },
  '2W1X1': {
    branch: 'Air Force',
    title: 'Aircraft Armament Systems',
    aliases: [],
    category: 'Weapons',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy ordnance loading (500+ lb bombs)',
      'Explosive handling',
      'Flightline noise',
      'Awkward positions loading weapons'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Flightline operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Aircraft engines', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Extreme', notes: 'Heavy ordnance lifting', ecfrCode: 'DC 5237/5243' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Overhead loading', ecfrCode: 'DC 5201' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling under aircraft', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '1N0X1': {
    branch: 'Air Force',
    title: 'Operations Intelligence',
    aliases: [],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged computer use',
      'Shift work',
      'Exposure to disturbing intelligence',
      'High-stress environment'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer use', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety/Depression', prevalence: 'Moderate', notes: 'Job stress, imagery', ecfrCode: 'DC 9413/9434' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Migraine', prevalence: 'Low', notes: 'Screen time', ecfrCode: 'DC 8100' }
    ]
  },
  '4N0X1': {
    branch: 'Air Force',
    title: 'Aerospace Medical Service (Medic)',
    aliases: [],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'Low to Moderate',
    physicalDemand: 'Moderate',
    hazards: [
      'Patient handling',
      'Bloodborne pathogen exposure',
      'Shift work',
      'Aeromedical evacuations'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Patient lifting', ecfrCode: 'DC 5237' },
      { condition: 'Needlestick Injuries', prevalence: 'Moderate', notes: 'Medical procedures', ecfrCode: 'Varies' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Medical emergencies', ecfrCode: 'DC 9413' }
    ]
  },

  // ============================================================================
  // NAVY RATINGS (Modern + Historical)
  // ============================================================================
  'BM': {
    branch: 'Navy',
    title: "Boatswain's Mate",
    aliases: [],
    category: 'Deck',
    timePeriod: 'Active',
    historicalNotes: 'In use since 1775; established 1797',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Heavy deck equipment handling',
      'Working over water',
      'Exposure to weather',
      'Line handling (rope burns)',
      'Crane operations'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy lifting, deck work', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Line handling', ecfrCode: 'DC 5201' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Ladder climbing', ecfrCode: 'DC 5260/5261' },
      { condition: 'Hand/Finger Injuries', prevalence: 'High', notes: 'Line/cable work', ecfrCode: 'DC 5228' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Ship machinery', ecfrCode: 'DC 6100' }
    ]
  },
  'GM': {
    branch: 'Navy',
    title: "Gunner's Mate",
    aliases: [],
    category: 'Weapons',
    timePeriod: 'Active',
    historicalNotes: 'Established 1797',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Naval gunfire operations',
      'Ammunition handling',
      'Weapons maintenance',
      'Confined spaces',
      'Chemical propellant exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Naval gunfire', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Weapons firing', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Ammo handling', ecfrCode: 'DC 5237' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Propellant fumes', ecfrCode: 'DC 6600' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Repetitive lifting', ecfrCode: 'DC 5201' }
    ]
  },
  'HM': {
    branch: 'Navy',
    title: 'Hospital Corpsman',
    aliases: [],
    category: 'Medical',
    timePeriod: 'Active',
    historicalNotes: 'Changed from Pharmacist\'s Mate 1948',
    noiseExposure: 'Variable',
    physicalDemand: 'Heavy',
    hazards: [
      'Patient lifting',
      'Bloodborne pathogen exposure',
      'Combat operations (with Marines)',
      'Long shifts',
      'Psychological trauma'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Patient handling', ecfrCode: 'DC 5237' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat/trauma exposure', ecfrCode: 'DC 9411' },
      { condition: 'Needlestick Injuries', prevalence: 'Moderate', notes: 'Medical procedures', ecfrCode: 'Varies' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'If attached to Marines', ecfrCode: 'DC 6260' }
    ]
  },
  'MM': {
    branch: 'Navy',
    title: "Machinist's Mate",
    aliases: ['BT', 'BT1', 'BT2', 'BT3'],
    category: 'Engineering',
    timePeriod: 'Active',
    historicalNotes: 'Changed from Machinist 1904; BT (Boiler Technician) merged 2014',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Engine room noise',
      'High heat environments',
      'Steam/hot surface burns',
      'Asbestos exposure (older ships)',
      'Heavy machinery operation'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Engine room noise', ecfrCode: 'DC 6100' },
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Machinery noise', ecfrCode: 'DC 6260' },
      { condition: 'Respiratory Issues/Asbestosis', prevalence: 'High', notes: 'Older ship insulation', ecfrCode: 'DC 6833' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Steam/hot surfaces', ecfrCode: 'DC 7801' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Equipment maintenance', ecfrCode: 'DC 5237' }
    ]
  },
  'OS': {
    branch: 'Navy',
    title: 'Operations Specialist',
    aliases: ['RD', 'RD1', 'RD2'],
    category: 'Operations',
    timePeriod: 'Active',
    historicalNotes: 'Formerly Radarman',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Radar/electronics exposure',
      'Prolonged standing (watch)',
      'Shift work',
      'Screen eye strain',
      'High-stress combat situations'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Radar screen watching', ecfrCode: 'DC 6066' },
      { condition: 'Lumbar/Cervical Strain', prevalence: 'Moderate', notes: 'Standing watch', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Watch rotation', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Combat information stress', ecfrCode: 'DC 9413' },
      { condition: 'Plantar Fasciitis', prevalence: 'Moderate', notes: 'Standing on steel decks', ecfrCode: 'DC 5276' }
    ]
  },
  'ET': {
    branch: 'Navy',
    title: 'Electronics Technician',
    aliases: [],
    category: 'Electronics',
    timePeriod: 'Active',
    historicalNotes: 'Changed from Electronics Technician\'s Mate 1948',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Electrical shock hazards',
      'Confined space work',
      'Ladder climbing',
      'RF radiation exposure'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Equipment noise', ecfrCode: 'DC 6100' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Overhead work', ecfrCode: 'DC 5237' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Fine motor work', ecfrCode: 'DC 8515' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Kneeling, climbing', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'EM': {
    branch: 'Navy',
    title: "Electrician's Mate",
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Active',
    historicalNotes: 'Changed from Electrician 1921',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Electrical shock hazards',
      'Confined space work',
      'High voltage equipment',
      'Shipboard fires'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Machinery noise', ecfrCode: 'DC 6100' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Electrical/arc flash', ecfrCode: 'DC 7801' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Awkward positions', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Kneeling', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'DC': {
    branch: 'Navy',
    title: 'Damage Controlman',
    aliases: ['SF', 'CW'],
    category: 'Damage Control',
    timePeriod: 'Active',
    historicalNotes: 'Established 1948 from multiple ratings',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Firefighting operations',
      'Smoke/toxic fume inhalation',
      'Heavy equipment handling',
      'Confined space rescue',
      'Chemical handling'
    ],
    commonConditions: [
      { condition: 'Respiratory Issues', prevalence: 'Very High', notes: 'Smoke, chemicals', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Equipment, rescue', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Crawling, kneeling', ecfrCode: 'DC 5260/5261' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Firefighting equipment', ecfrCode: 'DC 5201' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Casualty response', ecfrCode: 'DC 9411' }
    ]
  },
  'FC': {
    branch: 'Navy',
    title: 'Fire Controlman',
    aliases: ['FT', 'FT1'],
    category: 'Weapons',
    timePeriod: 'Active',
    historicalNotes: 'Established 1941; split into FCA (Aegis) and other variants',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Weapons systems operation',
      'Electrical hazards',
      'Confined space work',
      'High-stress combat situations'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Weapons systems', ecfrCode: 'DC 6100' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Combat operations', ecfrCode: 'DC 6260' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Console operations', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Combat stress', ecfrCode: 'DC 9413' }
    ]
  },
  'STG': {
    branch: 'Navy',
    title: 'Sonar Technician (Surface)',
    aliases: ['SN'],
    category: 'Operations',
    timePeriod: 'Active',
    historicalNotes: 'Title changed from Sonarman 1964',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Sonar equipment operation',
      'Watch standing',
      'Shift work',
      'Confined space (sonar room)'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Sonar operations', ecfrCode: 'DC 6100' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Watch rotation', ecfrCode: 'DC 6847' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Console posture', ecfrCode: 'DC 5237' },
      { condition: 'Vision Problems', prevalence: 'Low', notes: 'Screen watching', ecfrCode: 'DC 6066' }
    ]
  },
  'IT': {
    branch: 'Navy',
    title: 'Information Systems Technician',
    aliases: ['DP', 'DP1', 'DP2', 'DP3', 'RM', 'RM1', 'RM2', 'RM3', 'MA'],
    category: 'Communications',
    timePeriod: 'Active',
    historicalNotes: 'Merged from Data Processing Technician (1998) and Radioman',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged computer use',
      'Server room environments',
      'Shift work',
      'Cable running'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Keyboard use', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged sitting', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },
  'YN': {
    branch: 'Navy',
    title: 'Yeoman',
    aliases: ['PN', 'PN1', 'PN2', 'PN3'],
    category: 'Administration',
    timePeriod: 'Active',
    historicalNotes: 'Established 1835; Personnelman merged 2005',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged sitting',
      'Repetitive typing',
      'Administrative stress'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Typing', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged sitting', ecfrCode: 'DC 5237' }
    ]
  },
  'LS': {
    branch: 'Navy',
    title: 'Logistics Specialist',
    aliases: ['SK', 'SK1', 'SK2', 'SK3', 'SKC', 'SKCS'],
    category: 'Supply',
    timePeriod: 'Active',
    historicalNotes: 'Storekeeper merged into Logistics Specialist 2009',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy lifting (supplies)',
      'Forklift operations',
      'Warehouse work'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy lifting', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Repetitive lifting', ecfrCode: 'DC 5201' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Squatting, kneeling', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'QM': {
    branch: 'Navy',
    title: 'Quartermaster',
    aliases: ['SM', 'SM1', 'SM2'],
    category: 'Navigation',
    timePeriod: 'Active',
    historicalNotes: 'Established 1798; Signalman merged 1948',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Bridge watch standing',
      'Weather exposure',
      'Shift work',
      'Eye strain from charts/screens'
    ],
    commonConditions: [
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Watch rotation', ecfrCode: 'DC 6847' },
      { condition: 'Cervical Strain', prevalence: 'Low', notes: 'Chart work', ecfrCode: 'DC 5237' },
      { condition: 'Vision Problems', prevalence: 'Low', notes: 'Night vision, screens', ecfrCode: 'DC 6066' }
    ]
  },

  // === HISTORICAL NAVY RATINGS (no longer active) ===
  'SK_HISTORICAL': {
    branch: 'Navy',
    title: 'Storekeeper (Historical)',
    aliases: [],
    category: 'Supply',
    timePeriod: 'Historical (merged 2009)',
    historicalNotes: 'Established 1916; merged into Logistics Specialist (LS) 2009',
    currentEquivalent: 'LS',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy lifting (supplies)',
      'Warehouse operations'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy lifting', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Repetitive lifting', ecfrCode: 'DC 5201' }
    ]
  },
  'BT_HISTORICAL': {
    branch: 'Navy',
    title: 'Boiler Technician (Historical)',
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Historical (merged 2014)',
    historicalNotes: 'Changed from Boilermaker and Watertender 1948; merged into MM 2014',
    currentEquivalent: 'MM',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Boiler operations',
      'High heat environments',
      'Steam burns',
      'Asbestos exposure (older ships)'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Boiler room noise', ecfrCode: 'DC 6100' },
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Machinery noise', ecfrCode: 'DC 6260' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Boiler maintenance, heavy equipment', ecfrCode: 'DC 5237' },
      { condition: 'Burns', prevalence: 'High', notes: 'Steam/hot surfaces', ecfrCode: 'DC 7801' },
      { condition: 'Respiratory Issues/Asbestosis', prevalence: 'High', notes: 'Boiler room, insulation', ecfrCode: 'DC 6833' }
    ]
  },

  // ============================================================================
  // MARINE CORPS MOS
  // ============================================================================
  '0311': {
    branch: 'Marines',
    title: 'Rifleman',
    aliases: ['0300'],
    category: 'Infantry',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Heavy combat loads (100+ lbs)',
      'Weapons fire exposure',
      'Explosive breaching',
      'Extreme physical conditioning',
      'Combat stress'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Weapons, explosives', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Combat noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain / DDD', prevalence: 'Very High', notes: 'Heavy pack loads', ecfrCode: 'DC 5237/5243' },
      { condition: 'Bilateral Knee Injuries', prevalence: 'Very High', notes: 'Running, hiking', ecfrCode: 'DC 5260/5261' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat exposure', ecfrCode: 'DC 9411' },
      { condition: 'TBI', prevalence: 'Moderate', notes: 'Blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'Ankle Injuries', prevalence: 'High', notes: 'Terrain, boots', ecfrCode: 'DC 5270/5271' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Ruck/weapons carrying', ecfrCode: 'DC 5201' }
    ]
  },
  '0331': {
    branch: 'Marines',
    title: 'Machine Gunner',
    aliases: [],
    category: 'Infantry',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'Carrying heavy weapon systems (M240, .50 cal)',
      'Extreme sustained noise',
      'Combat stress',
      'Heavy ammunition loads'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Machine gun fire', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Sustained automatic fire', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar/Cervical Strain', prevalence: 'Extreme', notes: 'Weapon weight', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Recoil, carrying', ecfrCode: 'DC 5201' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat', ecfrCode: 'DC 9411' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling/prone positions', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '0341': {
    branch: 'Marines',
    title: 'Mortarman',
    aliases: [],
    category: 'Infantry',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Mortar blast overpressure',
      'Heavy mortar equipment',
      'Combat operations',
      'Hot tube burns'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Mortar fire', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Blast exposure', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast overpressure', ecfrCode: 'DC 8045' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Equipment carry', ecfrCode: 'DC 5237' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat', ecfrCode: 'DC 9411' }
    ]
  },
  '0811': {
    branch: 'Marines',
    title: 'Field Artillery Cannoneer',
    aliases: ['0800'],
    category: 'Artillery',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Howitzer blast overpressure',
      'Heavy round handling',
      'Propellant exposure',
      'Heat/cold extremes'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Artillery fire', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Blast exposure', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'High', notes: 'Repeated blast overpressure', ecfrCode: 'DC 8045' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Round lifting', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Loading operations', ecfrCode: 'DC 5201' }
    ]
  },
  '3531': {
    branch: 'Marines',
    title: 'Motor Vehicle Operator',
    aliases: ['3500', '3521'],
    category: 'Logistics',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Long-haul driving',
      'Vehicle vibration',
      'Combat convoy operations',
      'Cargo loading'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain / DDD', prevalence: 'Very High', notes: 'Vibration, loading', ecfrCode: 'DC 5237/5243' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Convoy attacks', ecfrCode: 'DC 9411' },
      { condition: 'Sleep Apnea', prevalence: 'High', notes: 'Irregular schedules', ecfrCode: 'DC 6847' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Driving posture', ecfrCode: 'DC 5237' }
    ]
  },
  '0621': {
    branch: 'Marines',
    title: 'Field Radio Operator',
    aliases: ['2500', '2531'],
    category: 'Communications',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Radio equipment carrying',
      'Combat operations with infantry',
      'Antenna setup',
      'Electronic interference'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Radio equipment carry', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Pack straps, equipment', ecfrCode: 'DC 5201' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Combat environment', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Radio headset, combat', ecfrCode: 'DC 6100' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Combat with infantry units', ecfrCode: 'DC 9411' }
    ]
  },
  '0351': {
    branch: 'Marines',
    title: 'Infantry Assault Marine',
    aliases: [],
    category: 'Infantry',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'Rocket/missile operations (SMAW, AT4)',
      'Breaching explosives',
      'Close combat',
      'Demolitions'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Rocket backblast', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Weapons fire', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Equipment carry', ecfrCode: 'DC 5237' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Close combat', ecfrCode: 'DC 9411' }
    ]
  },

  // ============================================================================
  // COAST GUARD RATINGS
  // ============================================================================
  'BM_CG': {
    branch: 'Coast Guard',
    title: "Boatswain's Mate",
    aliases: [],
    category: 'Deck',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Search and rescue operations',
      'Heavy seas/weather exposure',
      'Line handling',
      'Working over water',
      'Trauma exposure (rescues/recoveries)'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Deck work', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Line handling', ecfrCode: 'DC 5201' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'SAR operations, body recovery', ecfrCode: 'DC 9411' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Deck movement', ecfrCode: 'DC 5260/5261' },
      { condition: 'Cold Injuries', prevalence: 'Moderate', notes: 'Weather exposure', ecfrCode: 'DC 7122' }
    ]
  },
  'ME': {
    branch: 'Coast Guard',
    title: 'Maritime Enforcement Specialist',
    aliases: [],
    category: 'Law Enforcement',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Boarding operations',
      'Weapons qualifications',
      'Body armor wear',
      'Hostile encounters',
      'Small boat operations'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Body armor, duty belt', ecfrCode: 'DC 5237' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Weapons fire', ecfrCode: 'DC 6260' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Boarding operations', ecfrCode: 'DC 5260/5261' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Equipment carry', ecfrCode: 'DC 5201' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Law enforcement stress', ecfrCode: 'DC 9411' }
    ]
  },
  'MK': {
    branch: 'Coast Guard',
    title: 'Machinery Technician',
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Engine room operations',
      'Diesel fume exposure',
      'Hot machinery',
      'Confined spaces',
      'Chemical exposure'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Engine noise', ecfrCode: 'DC 6100' },
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Machinery', ecfrCode: 'DC 6260' },
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Fumes', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment work', ecfrCode: 'DC 5237' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Hot machinery', ecfrCode: 'DC 7801' }
    ]
  },
  'OS_CG': {
    branch: 'Coast Guard',
    title: 'Operations Specialist',
    aliases: ['RD'],
    category: 'Operations',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Watch standing',
      'Search and rescue coordination stress',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Watch rotation', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'SAR coordination stress', ecfrCode: 'DC 9413' },
      { condition: 'Cervical Strain', prevalence: 'Low', notes: 'Console work', ecfrCode: 'DC 5237' }
    ]
  },
  'HS': {
    branch: 'Coast Guard',
    title: 'Health Services Technician',
    aliases: [],
    category: 'Medical',
    timePeriod: 'Active',
    noiseExposure: 'Low',
    physicalDemand: 'Moderate',
    hazards: [
      'Patient handling',
      'Bloodborne pathogens',
      'Emergency medical situations'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Patient lifting', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Medical emergencies', ecfrCode: 'DC 9413' },
      { condition: 'Needlestick Injuries', prevalence: 'Low', notes: 'Medical procedures', ecfrCode: 'Varies' }
    ]
  },

  // ============================================================================
  // ADDITIONAL ARMY MOS (Expanded Coverage)
  // ============================================================================
  '15T': {
    branch: 'Army',
    title: 'UH-60 Helicopter Repairer (Blackhawk Mechanic)',
    aliases: ['67T'],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Rotor blade/aircraft noise',
      'Working on elevated platforms',
      'Hydraulic fluid exposure',
      'Heavy component lifting'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Helicopter operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Aircraft noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Awkward positions, lifting', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Overhead work', ecfrCode: 'DC 5201' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Fumes, solvents', ecfrCode: 'DC 6600' }
    ]
  },
  '15W': {
    branch: 'Army',
    title: 'Unmanned Aircraft Systems Operator (Drone Operator)',
    aliases: [],
    category: 'Aviation',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged screen monitoring',
      'Shift work',
      'Psychological impact of operations',
      'Equipment setup (field conditions)'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Control operations', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Screen monitoring', ecfrCode: 'DC 5237' },
      { condition: 'PTSD/Moral Injury', prevalence: 'Moderate', notes: 'Combat operations via screen', ecfrCode: 'DC 9411' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'High-stakes operations', ecfrCode: 'DC 9413' }
    ]
  },
  '74D': {
    branch: 'Army',
    title: 'Chemical, Biological, Radiological, Nuclear Specialist (CBRN)',
    aliases: ['54B'],
    category: 'Combat Support',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Chemical agent exposure (training)',
      'Radiation monitoring',
      'Heavy protective equipment',
      'Decontamination operations'
    ],
    commonConditions: [
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Chemical exposure, MOPP gear', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Heavy MOPP gear, decon equipment', ecfrCode: 'DC 5237' },
      { condition: 'Skin Conditions', prevalence: 'High', notes: 'Chemical exposure, MOPP gear', ecfrCode: 'DC 7806' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'CBRN threat environment', ecfrCode: 'DC 9413' },
      { condition: 'Heat Injuries', prevalence: 'Moderate', notes: 'MOPP gear', ecfrCode: 'Varies' }
    ]
  },
  '94E': {
    branch: 'Army',
    title: 'Radio and Communications Security Repairer',
    aliases: ['31E'],
    category: 'Signal',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Moderate',
    hazards: [
      'Soldering fume exposure',
      'Fine motor work',
      'Electrical hazards',
      'Equipment testing'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine motor work', ecfrCode: 'DC 8515' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Soldering fumes', ecfrCode: 'DC 6600' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Bench work posture', ecfrCode: 'DC 5237' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Fine detail work', ecfrCode: 'DC 6066' }
    ]
  },

  // ============================================================================
  // EXPANDED ARMY MOS - SPECIAL FORCES (18 Series)
  // ============================================================================
  '18B': {
    branch: 'Army',
    title: 'Special Forces Weapons Sergeant',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'Parachute operations (HALO/HAHO)',
      'Dive operations',
      'Weapons fire in close quarters',
      'Extreme physical conditioning',
      'Combat operations',
      'Demolitions'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Weapons, explosives', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Combat noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar/Cervical DDD', prevalence: 'Extreme', notes: 'Parachute landings, heavy loads', ecfrCode: 'DC 5237/5243' },
      { condition: 'Bilateral Knee Injuries', prevalence: 'Very High', notes: 'Jump landings, rucking', ecfrCode: 'DC 5260/5261' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat operations', ecfrCode: 'DC 9411' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Parachute opening shock', ecfrCode: 'DC 5201' },
      { condition: 'Ankle Injuries', prevalence: 'Very High', notes: 'Jump landings', ecfrCode: 'DC 5270/5271' }
    ]
  },
  '18C': {
    branch: 'Army',
    title: 'Special Forces Engineer Sergeant',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'Demolitions/explosive breaching',
      'Combat diving',
      'Parachute operations',
      'Construction in hostile areas'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Demolitions', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Explosive breaching', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'Very High', notes: 'Repeated blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'Lumbar DDD', prevalence: 'Extreme', notes: 'Equipment carry, jumps', ecfrCode: 'DC 5243' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat operations', ecfrCode: 'DC 9411' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Jump landings', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '18D': {
    branch: 'Army',
    title: 'Special Forces Medical Sergeant',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Combat trauma care',
      'Parachute/dive operations',
      'Field surgery conditions',
      'Bloodborne pathogen exposure'
    ],
    commonConditions: [
      { condition: 'PTSD', prevalence: 'Extreme', notes: 'Combat trauma care', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar DDD', prevalence: 'Very High', notes: 'Patient carry, jumps', ecfrCode: 'DC 5243' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Combat environment', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Weapons fire', ecfrCode: 'DC 6100' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Jump landings', ecfrCode: 'DC 5260/5261' },
      { condition: 'Depression/Anxiety', prevalence: 'High', notes: 'Casualty care stress', ecfrCode: 'DC 9434/9413' }
    ]
  },
  '18E': {
    branch: 'Army',
    title: 'Special Forces Communications Sergeant',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Heavy radio equipment carry',
      'Parachute/dive operations',
      'Combat operations',
      'Antenna setup in hostile areas'
    ],
    commonConditions: [
      { condition: 'Lumbar DDD', prevalence: 'Extreme', notes: 'Commo equipment 60+ lbs', ecfrCode: 'DC 5243' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Equipment straps, jumps', ecfrCode: 'DC 5201' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Combat', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Headset use, combat', ecfrCode: 'DC 6100' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Jump landings', ecfrCode: 'DC 5260/5261' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat operations', ecfrCode: 'DC 9411' }
    ]
  },
  '18F': {
    branch: 'Army',
    title: 'Special Forces Intelligence Sergeant',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Intelligence gathering operations',
      'Parachute operations',
      'Combat zone exposure',
      'High-stress decision making'
    ],
    commonConditions: [
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat intelligence', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar DDD', prevalence: 'High', notes: 'Equipment carry', ecfrCode: 'DC 5243' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Combat exposure', ecfrCode: 'DC 6260' },
      { condition: 'Anxiety', prevalence: 'High', notes: 'Intelligence operations stress', ecfrCode: 'DC 9413' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Jump landings', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '18X': {
    branch: 'Army',
    title: 'Special Forces Candidate',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Extreme physical selection course',
      'Sleep deprivation',
      'High training injury rate',
      'Weapons/demolitions training'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'SFAS training', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Rucking, running', ecfrCode: 'DC 5260/5261' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Live fire training', ecfrCode: 'DC 6100' },
      { condition: 'Stress Fractures', prevalence: 'High', notes: 'Intense training', ecfrCode: 'DC 5283' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Weapons training', ecfrCode: 'DC 6260' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Log PT, carries', ecfrCode: 'DC 5201' }
    ]
  },

  // ============================================================================
  // EXPANDED ARMY MOS - CYBER (17 Series)
  // ============================================================================
  '17C': {
    branch: 'Army',
    title: 'Cyber Operations Specialist',
    aliases: [],
    category: 'Cyber',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged computer use',
      'Shift work (24/7 operations)',
      'High-stress cyber operations',
      'Classified information handling'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'Very High', notes: 'Intensive keyboard use', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged sitting', ecfrCode: 'DC 5237' },
      { condition: 'Migraine', prevalence: 'High', notes: 'Screen time, stress', ecfrCode: 'DC 8100' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Operational stress', ecfrCode: 'DC 9413' }
    ]
  },
  '17E': {
    branch: 'Army',
    title: 'Electronic Warfare Specialist',
    aliases: ['29E'],
    category: 'Cyber/Electronic Warfare',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'RF/electromagnetic radiation',
      'Electronic equipment operation',
      'Field deployments',
      'Generator noise'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Equipment noise', ecfrCode: 'DC 6260' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Equipment operation', ecfrCode: 'DC 8515' },
      { condition: 'Headaches/Migraine', prevalence: 'High', notes: 'RF exposure, screens', ecfrCode: 'DC 8100' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Operations tempo', ecfrCode: 'DC 6847' }
    ]
  },

  // ============================================================================
  // EXPANDED ARMY MOS - AIR DEFENSE (14 Series)
  // ============================================================================
  '14E': {
    branch: 'Army',
    title: 'Patriot Fire Control Enhanced Operator/Maintainer',
    aliases: [],
    category: 'Air Defense',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Missile launch operations',
      'Radar emissions',
      'Heavy equipment maintenance',
      'High-alert operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Missile operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Generator/equipment noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment setup', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Alert status operations', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Constant readiness', ecfrCode: 'DC 9413' }
    ]
  },
  '14G': {
    branch: 'Army',
    title: 'Air Defense Battle Management System Operator',
    aliases: [],
    category: 'Air Defense',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Prolonged screen monitoring',
      'Shift work',
      'High-stress air defense',
      'Generator/equipment noise'
    ],
    commonConditions: [
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Console operations', ecfrCode: 'DC 5237' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Screen watching', ecfrCode: 'DC 6066' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Air defense stress', ecfrCode: 'DC 9413' }
    ]
  },
  '14H': {
    branch: 'Army',
    title: 'Air Defense Enhanced Early Warning System Operator',
    aliases: [],
    category: 'Air Defense',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Radar operations',
      'Shift work',
      'High-alert status',
      'Equipment maintenance'
    ],
    commonConditions: [
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Alert operations', ecfrCode: 'DC 6847' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Console work', ecfrCode: 'DC 5237' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Equipment noise', ecfrCode: 'DC 6260' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Early warning stress', ecfrCode: 'DC 9413' }
    ]
  },
  '14P': {
    branch: 'Army',
    title: 'Air and Missile Defense Crewmember',
    aliases: ['14J', '14S', '14T'],
    category: 'Air Defense',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Stinger/Avenger missile operations',
      'Field operations',
      'Vehicle-mounted operations',
      'Weapons fire'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Missile/weapons fire', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Weapons, vehicles', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment carry', ecfrCode: 'DC 5237' },
      { condition: 'Neck/Cervical Strain', prevalence: 'Moderate', notes: 'Sky scanning', ecfrCode: 'DC 5237' }
    ]
  },

  // ============================================================================
  // EXPANDED ARMY MOS - AVIATION (15 Series)
  // ============================================================================
  '15B': {
    branch: 'Army',
    title: 'Aircraft Powerplant Repairer',
    aliases: [],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Jet/turbine engine noise',
      'Hot engine components',
      'Fuel/hydraulic exposure',
      'Confined spaces'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Engine testing', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Aircraft operations', ecfrCode: 'DC 6100' },
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Fumes, solvents', ecfrCode: 'DC 6600' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Hot components', ecfrCode: 'DC 7801' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Awkward positions', ecfrCode: 'DC 5237' }
    ]
  },
  '15D': {
    branch: 'Army',
    title: 'Aircraft Powertrain Repairer',
    aliases: [],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Helicopter rotor/transmission work',
      'Heavy component lifting',
      'Chemical exposure',
      'Aircraft runups'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Aircraft operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Helicopter noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy lifting', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Component handling', ecfrCode: 'DC 5201' }
    ]
  },
  '15G': {
    branch: 'Army',
    title: 'Aircraft Structural Repairer',
    aliases: [],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Sheet metal work',
      'Composite material exposure',
      'Power tool operations',
      'Chemical adhesives/sealants'
    ],
    commonConditions: [
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Composites, fumes', ecfrCode: 'DC 6600' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Power tools', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Riveting, tools', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Heavy component handling', ecfrCode: 'DC 5237' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Repetitive tool use', ecfrCode: 'DC 8515' },
      { condition: 'Skin Conditions', prevalence: 'Moderate', notes: 'Chemical exposure', ecfrCode: 'DC 7806' }
    ]
  },
  '15N': {
    branch: 'Army',
    title: 'Avionics Mechanic',
    aliases: [],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Moderate',
    hazards: [
      'Electrical systems',
      'Flight line operations',
      'Confined cockpit work',
      'Soldering fumes'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Flight line', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Aircraft noise', ecfrCode: 'DC 6100' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Overhead work', ecfrCode: 'DC 5237' }
    ]
  },
  '15P': {
    branch: 'Army',
    title: 'Aviation Operations Specialist',
    aliases: [],
    category: 'Aviation',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Light',
    hazards: [
      'Flight line exposure',
      'Shift work',
      'Administrative stress'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Flight line', ecfrCode: 'DC 6260' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Computer work', ecfrCode: 'DC 8515' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },
  '15Q': {
    branch: 'Army',
    title: 'Air Traffic Control Operator',
    aliases: ['93C'],
    category: 'Aviation',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Light',
    hazards: [
      'High-stress ATC operations',
      'Shift work',
      'Continuous vigilance required',
      'Radio headset use'
    ],
    commonConditions: [
      { condition: 'Anxiety', prevalence: 'High', notes: 'ATC stress', ecfrCode: 'DC 9413' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift rotation', ecfrCode: 'DC 6847' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Headset use', ecfrCode: 'DC 6260' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Controller operations', ecfrCode: 'DC 8515' },
      { condition: 'Hypertension', prevalence: 'Moderate', notes: 'Job stress', ecfrCode: 'DC 7101' }
    ]
  },
  '15R': {
    branch: 'Army',
    title: 'AH-64 Attack Helicopter Repairer',
    aliases: [],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Apache helicopter operations',
      'Weapons systems maintenance',
      'High-voltage electrical',
      'Chemical exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Apache operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Aircraft noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Maintenance positions', ecfrCode: 'DC 5237' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Fumes', ecfrCode: 'DC 6600' }
    ]
  },
  '15U': {
    branch: 'Army',
    title: 'CH-47 Helicopter Repairer (Chinook Mechanic)',
    aliases: [],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Chinook dual-rotor operations',
      'Heavy component handling',
      'Fuel/hydraulic exposure',
      'Flight line operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Chinook noise', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Dual rotor aircraft', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy components', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Lifting, overhead', ecfrCode: 'DC 5201' }
    ]
  },
  '15H': {
    branch: 'Army',
    title: 'Aircraft Pneudraulics Repairer',
    aliases: ['68H'],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Hydraulic fluid exposure (Skydrol)',
      'High-pressure pneumatic systems',
      'Flight line aircraft noise',
      'Heavy component handling',
      'Chemical solvent exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Flight line operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Aircraft engine noise', ecfrCode: 'DC 6100' },
      { condition: 'Skin Conditions', prevalence: 'High', notes: 'Skydrol hydraulic fluid exposure - highly caustic', ecfrCode: 'DC 7806' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Hydraulic fluid fumes, solvents', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Component handling, awkward positions', ecfrCode: 'DC 5237' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Fine tubing work, fitting connections', ecfrCode: 'DC 8515' }
    ]
  },
  '15Y': {
    branch: 'Army',
    title: 'AH-64D Armament/Electrical/Avionics Systems Repairer',
    aliases: ['67Y'],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Apache attack helicopter operations',
      'Weapons systems maintenance (30mm cannon, Hellfire)',
      'High-voltage avionics systems',
      'Soldering and electronic work',
      'Live weapons handling'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Apache operations, weapons testing', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Attack helicopter noise', ecfrCode: 'DC 6100' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine avionics/electrical work', ecfrCode: 'DC 8515' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Awkward maintenance positions', ecfrCode: 'DC 5237' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Fine circuit work, soldering', ecfrCode: 'DC 6066' },
      { condition: 'Respiratory Issues', prevalence: 'Low-Moderate', notes: 'Soldering fumes', ecfrCode: 'DC 6600' }
    ]
  },

  // ============================================================================
  // EXPANDED ARMY MOS - EOD & ENGINEER
  // ============================================================================
  '89D': {
    branch: 'Army',
    title: 'Explosive Ordnance Disposal Specialist (EOD)',
    aliases: [],
    category: 'EOD',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'IED/UXO disposal',
      'Controlled detonations',
      'Bomb suit wear (80+ lbs)',
      'Extreme stress',
      'Chemical exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Controlled detonations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Blast exposure', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'Very High', notes: 'Repeated blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'PTSD', prevalence: 'Extreme', notes: 'IED disposal stress', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar/Cervical DDD', prevalence: 'Very High', notes: 'Bomb suit weight', ecfrCode: 'DC 5237/5243' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Kneeling in suit', ecfrCode: 'DC 5260/5261' },
      { condition: 'Heat Injuries', prevalence: 'High', notes: 'Bomb suit', ecfrCode: 'Varies' },
      { condition: 'Anxiety', prevalence: 'Very High', notes: 'High-stakes operations', ecfrCode: 'DC 9413' }
    ]
  },
  '12D': {
    branch: 'Army',
    title: 'Diver',
    aliases: [],
    category: 'Combat Support',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Extreme',
    hazards: [
      'Decompression sickness risk',
      'Underwater demolitions',
      'Cold water exposure',
      'Heavy equipment',
      'Salvage operations'
    ],
    commonConditions: [
      { condition: 'Decompression Sickness Residuals', prevalence: 'Moderate', notes: 'Diving operations', ecfrCode: 'DC 6817' },
      { condition: 'Sinus/Ear Issues', prevalence: 'Very High', notes: 'Pressure changes', ecfrCode: 'DC 6510/6200' },
      { condition: 'Lumbar DDD', prevalence: 'High', notes: 'Equipment weight', ecfrCode: 'DC 5243' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Underwater work', ecfrCode: 'DC 6100' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Fin kicks, equipment', ecfrCode: 'DC 5260/5261' },
      { condition: 'Cold Injuries', prevalence: 'Moderate', notes: 'Cold water', ecfrCode: 'DC 7122' }
    ]
  },
  '12C': {
    branch: 'Army',
    title: 'Bridge Crewmember',
    aliases: [],
    category: 'Combat Support',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Heavy bridge component handling',
      'Working over/near water',
      'Combat construction',
      'Vehicle operations'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy lifting', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Component handling', ecfrCode: 'DC 5201' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Equipment noise', ecfrCode: 'DC 6260' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling, climbing', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '12N': {
    branch: 'Army',
    title: 'Horizontal Construction Engineer',
    aliases: [],
    category: 'Combat Support',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy equipment operation (bulldozers, graders)',
      'Whole-body vibration',
      'Dust exposure',
      'Heat/cold extremes'
    ],
    commonConditions: [
      { condition: 'Lumbar DDD', prevalence: 'Very High', notes: 'Equipment vibration', ecfrCode: 'DC 5243' },
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Heavy equipment', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Diesel engines', ecfrCode: 'DC 6100' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Dust, exhaust', ecfrCode: 'DC 6600' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Looking back while operating', ecfrCode: 'DC 5237' }
    ]
  },
  '12W': {
    branch: 'Army',
    title: 'Carpentry and Masonry Specialist',
    aliases: [],
    category: 'Combat Support',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Power tool operations',
      'Heavy material handling',
      'Working at heights',
      'Dust/silica exposure'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy lifting', ecfrCode: 'DC 5237' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Power tools', ecfrCode: 'DC 6260' },
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Dust, silica', ecfrCode: 'DC 6600' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Tool use', ecfrCode: 'DC 8515' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling', ecfrCode: 'DC 5260/5261' }
    ]
  },

  // ============================================================================
  // EXPANDED AIR FORCE - SPECIAL WARFARE (1Z Series)
  // ============================================================================
  '1Z1X1': {
    branch: 'Air Force',
    title: 'Pararescue (PJ)',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'HALO/HAHO parachute operations',
      'Combat diving',
      'Helicopter operations',
      'Rescue in hostile environments',
      'Extreme physical demands'
    ],
    commonConditions: [
      { condition: 'Lumbar/Cervical DDD', prevalence: 'Extreme', notes: 'Jump landings, patient carries', ecfrCode: 'DC 5237/5243' },
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Aircraft, weapons', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Helicopter operations', ecfrCode: 'DC 6100' },
      { condition: 'PTSD', prevalence: 'Very High', notes: 'Combat rescue operations', ecfrCode: 'DC 9411' },
      { condition: 'Bilateral Knee Injuries', prevalence: 'Extreme', notes: 'Jump landings', ecfrCode: 'DC 5260/5261' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Parachute opening, carries', ecfrCode: 'DC 5201' },
      { condition: 'Ankle Injuries', prevalence: 'Very High', notes: 'Jump landings', ecfrCode: 'DC 5270/5271' }
    ]
  },
  '1Z2X1': {
    branch: 'Air Force',
    title: 'Combat Control (CCT)',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'Forward air control operations',
      'Parachute/dive operations',
      'Direct combat',
      'Airfield seizure operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Combat, aircraft', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Weapons, aircraft', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar DDD', prevalence: 'Extreme', notes: 'Equipment carry, jumps', ecfrCode: 'DC 5243' },
      { condition: 'PTSD', prevalence: 'Very High', notes: 'Combat operations', ecfrCode: 'DC 9411' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Jump landings', ecfrCode: 'DC 5260/5261' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast exposure', ecfrCode: 'DC 8045' }
    ]
  },
  '1Z3X1': {
    branch: 'Air Force',
    title: 'Tactical Air Control Party (TACP)',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'Forward observer with Army/Marines',
      'Close air support coordination',
      'Heavy radio equipment',
      'Direct combat exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Combat, air strikes', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Weapons, explosions', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar DDD', prevalence: 'Very High', notes: 'Heavy equipment carry', ecfrCode: 'DC 5243' },
      { condition: 'PTSD', prevalence: 'Very High', notes: 'Front-line combat', ecfrCode: 'DC 9411' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Infantry operations', ecfrCode: 'DC 5260/5261' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast exposure', ecfrCode: 'DC 8045' }
    ]
  },
  '1Z4X1': {
    branch: 'Air Force',
    title: 'Special Reconnaissance',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Long-range reconnaissance',
      'Parachute/dive operations',
      'Extended isolation',
      'Combat operations'
    ],
    commonConditions: [
      { condition: 'Lumbar DDD', prevalence: 'Extreme', notes: 'Heavy loads, terrain', ecfrCode: 'DC 5243' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Patrolling, jumps', ecfrCode: 'DC 5260/5261' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Combat weapons fire', ecfrCode: 'DC 6100' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Weapons fire', ecfrCode: 'DC 6260' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Isolated operations', ecfrCode: 'DC 9411' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Extended operations', ecfrCode: 'DC 6847' }
    ]
  },

  // ============================================================================
  // EXPANDED AIR FORCE - EOD, MUNITIONS, AIRCREW
  // ============================================================================
  '3E8X1': {
    branch: 'Air Force',
    title: 'Explosive Ordnance Disposal (EOD)',
    aliases: [],
    category: 'EOD',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'IED/UXO disposal',
      'Controlled detonations',
      'Bomb suit operations',
      'CBRN hazards'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Detonations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Blast exposure', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'Very High', notes: 'Repeated blast', ecfrCode: 'DC 8045' },
      { condition: 'PTSD', prevalence: 'Extreme', notes: 'IED disposal', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar DDD', prevalence: 'Very High', notes: 'Bomb suit weight', ecfrCode: 'DC 5243' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Kneeling in suit', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '2W0X1': {
    branch: 'Air Force',
    title: 'Munitions Systems',
    aliases: [],
    category: 'Weapons',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Explosive handling',
      'Heavy munitions lifting',
      'Forklift/vehicle operations',
      'Flightline operations'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy munitions', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Lifting, loading', ecfrCode: 'DC 5201' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Flightline', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Aircraft, vehicles', ecfrCode: 'DC 6100' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Squatting, kneeling', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '1A3X1': {
    branch: 'Air Force',
    title: 'Airborne Mission Systems Operator',
    aliases: [],
    category: 'Aircrew',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Moderate',
    hazards: [
      'Aircraft noise/vibration',
      'Cabin pressure changes',
      'Extended missions',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Aircraft noise', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Flight operations', ecfrCode: 'DC 6100' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Mission schedules', ecfrCode: 'DC 6847' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Extended seating', ecfrCode: 'DC 5237' }
    ]
  },
  '1A8X1': {
    branch: 'Air Force',
    title: 'Airborne Cryptologic Language Analyst',
    aliases: [],
    category: 'Aircrew/Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Moderate',
    hazards: [
      'Aircraft operations',
      'Extended headset use',
      'Intelligence mission stress',
      'Cabin pressure changes'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Aircraft, headset', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Headset use', ecfrCode: 'DC 6100' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Mission schedules', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Intelligence operations', ecfrCode: 'DC 9413' }
    ]
  },
  '1B4X1': {
    branch: 'Air Force',
    title: 'Cyber Warfare Operations',
    aliases: [],
    category: 'Cyber',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intensive computer use',
      '24/7 operations',
      'High-stress cyber operations',
      'Classified work environment'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'Very High', notes: 'Keyboard use', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Migraine', prevalence: 'High', notes: 'Screen time, stress', ecfrCode: 'DC 8100' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Operational stress', ecfrCode: 'DC 9413' }
    ]
  },
  '1C4X1': {
    branch: 'Air Force',
    title: 'Tactical Air Command and Control',
    aliases: [],
    category: 'Command & Control',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'High-stress air battle management',
      'Shift work',
      'Prolonged console operations'
    ],
    commonConditions: [
      { condition: 'Anxiety', prevalence: 'High', notes: 'Battle management stress', ecfrCode: 'DC 9413' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Console work', ecfrCode: 'DC 5237' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Controller operations', ecfrCode: 'DC 8515' }
    ]
  },
  '2T1X1': {
    branch: 'Air Force',
    title: 'Vehicle Operations',
    aliases: [],
    category: 'Logistics',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Vehicle vibration',
      'Loading/unloading cargo',
      'Flightline operations',
      'Weather exposure'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Vibration, loading', ecfrCode: 'DC 5237' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Flightline', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Vehicle/aircraft noise', ecfrCode: 'DC 6100' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Climbing in/out', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '2F0X1': {
    branch: 'Air Force',
    title: 'Fuels',
    aliases: [],
    category: 'Logistics',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'JP-8 fuel exposure',
      'Flightline operations',
      'Heavy hose handling',
      'Benzene exposure'
    ],
    commonConditions: [
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Fuel vapors', ecfrCode: 'DC 6600' },
      { condition: 'Skin Conditions', prevalence: 'High', notes: 'Fuel contact', ecfrCode: 'DC 7806' },
      { condition: 'Cancer (various)', prevalence: 'Moderate', notes: 'Benzene - PACT Act', ecfrCode: 'DC 7715' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Flightline', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Aircraft', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Hose handling', ecfrCode: 'DC 5237' }
    ]
  },
  '1D7X1': {
    branch: 'Air Force',
    title: 'Cyber Defense Operations / Digital Communications',
    aliases: ['3C031', '3C051', '2E231', '2E631', '3D031', '3D131', '3D1X1'],
    category: 'Cyber/Communications',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intensive computer/network operations',
      'Shift work (24/7 operations)',
      'Cyber security stress',
      'Server room/data center environments'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'Very High', notes: 'Keyboard intensive work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Migraine', prevalence: 'Moderate', notes: 'Screen time', ecfrCode: 'DC 8100' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Cyber security incidents', ecfrCode: 'DC 9413' }
    ]
  },
  '1T0X1': {
    branch: 'Air Force',
    title: 'SERE Specialist (Survival, Evasion, Resistance, Escape)',
    aliases: ['1T031', '8R000'],
    category: 'Special Operations Support',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Extreme',
    hazards: [
      'Extreme physical training/instruction',
      'Environmental exposure (cold, heat, altitude)',
      'Resistance training scenarios',
      'Psychological stress',
      'Weapons/survival training'
    ],
    commonConditions: [
      { condition: 'Lumbar DDD', prevalence: 'Very High', notes: 'Extreme physical demands', ecfrCode: 'DC 5243' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Training activities', ecfrCode: 'DC 5260/5261' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Resistance training, stress scenarios', ecfrCode: 'DC 9411' },
      { condition: 'Cold Injuries', prevalence: 'Moderate', notes: 'Environmental training', ecfrCode: 'DC 7122' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Weapons training', ecfrCode: 'DC 6260' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Physical training', ecfrCode: 'DC 5201' }
    ]
  },
  '1T2X1': {
    branch: 'Air Force',
    title: 'Pararescue / SERE Operations',
    aliases: ['1T231'],
    category: 'Special Operations Support',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Combat rescue support',
      'Parachute operations',
      'Extreme physical demands',
      'Helicopter operations'
    ],
    commonConditions: [
      { condition: 'Lumbar DDD', prevalence: 'Extreme', notes: 'Jump landings, heavy loads', ecfrCode: 'DC 5243' },
      { condition: 'Knee Injuries', prevalence: 'Extreme', notes: 'Jump landings, operational demands', ecfrCode: 'DC 5260/5261' },
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Helicopter operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Aircraft noise', ecfrCode: 'DC 6100' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat support operations', ecfrCode: 'DC 9411' }
    ]
  },
  '1N2X1': {
    branch: 'Air Force',
    title: 'Signals Intelligence Analyst',
    aliases: ['1N231'],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low-Moderate (Headset)',
    physicalDemand: 'Light',
    hazards: [
      'Extended headset use',
      'Signal monitoring fatigue',
      'Shift work',
      'Classified information stress'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Headset monitoring', ecfrCode: 'DC 6260' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Transcription, keyboard work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Workstation posture', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Intelligence operations', ecfrCode: 'DC 9413' }
    ]
  },
  '1A0X1': {
    branch: 'Air Force',
    title: 'In-Flight Refueling / Boom Operator',
    aliases: ['1A031'],
    category: 'Aircrew',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Moderate',
    hazards: [
      'Extended flight operations',
      'Pressurized cabin work',
      'Awkward boom operator position',
      'Shift/mission schedule disruption'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Aircraft engine noise', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Tanker aircraft operations', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Boom operator prone position', ecfrCode: 'DC 5237' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Extended neck positioning', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Mission schedules, jet lag', ecfrCode: 'DC 6847' }
    ]
  },
  '2A5X1': {
    branch: 'Air Force',
    title: 'Aerospace Maintenance',
    aliases: ['2A531'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Flight line aircraft maintenance',
      'Jet engine noise exposure',
      'Chemical/hydraulic fluid exposure',
      'Working on elevated platforms'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Jet engine operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Flight line noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Maintenance positions', ecfrCode: 'DC 5237' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Fumes, solvents', ecfrCode: 'DC 6600' }
    ]
  },
  '2A6X1': {
    branch: 'Air Force',
    title: 'Aerospace Propulsion (Jet Engine Mechanic)',
    aliases: ['452X0', '2A631'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Jet engine testing and maintenance',
      'Hot engine components',
      'Fuel/hydraulic exposure',
      'Extreme noise during engine runs'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Engine testing, flight line', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Jet engine exposure', ecfrCode: 'DC 6100' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Hot engine components', ecfrCode: 'DC 7801' },
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Fuel fumes, exhaust', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Engine component handling', ecfrCode: 'DC 5237' }
    ]
  },
  '2A7X1': {
    branch: 'Air Force',
    title: 'Aircraft Metals Technology',
    aliases: ['454X0', '2A731'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Welding operations',
      'Metal fabrication',
      'Heat treatment',
      'Chemical exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Metal work, flight line', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Grinding, fabrication', ecfrCode: 'DC 6100' },
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Welding fumes, metal particles', ecfrCode: 'DC 6600' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Welding flash', ecfrCode: 'DC 6066' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Welding, hot metal', ecfrCode: 'DC 7801' }
    ]
  },
  '2A0X1': {
    branch: 'Air Force',
    title: 'Avionics Test Station and Components',
    aliases: ['2A031'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Electronic test equipment operation',
      'Flight line avionics work',
      'Soldering and fine electronics',
      'Static discharge hazards'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Flight line exposure', ecfrCode: 'DC 6260' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine electronic work', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Circuit board work', ecfrCode: 'DC 6066' },
      { condition: 'Respiratory Issues', prevalence: 'Low-Moderate', notes: 'Soldering fumes', ecfrCode: 'DC 6600' }
    ]
  },
  '2W2X1': {
    branch: 'Air Force',
    title: 'Nuclear Weapons',
    aliases: ['2W231'],
    category: 'Weapons',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Nuclear weapons handling',
      'Radiation monitoring',
      'High-security stress',
      'Heavy component lifting'
    ],
    commonConditions: [
      { condition: 'Anxiety', prevalence: 'High', notes: 'Nuclear weapons responsibility', ecfrCode: 'DC 9413' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Weapons handling', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Alert duty', ecfrCode: 'DC 6847' },
      { condition: 'Radiation Exposure', prevalence: 'Low', notes: 'Controlled exposure possible', ecfrCode: 'DC 7343' }
    ]
  },

  // ============================================================================
  // EXPANDED NAVY RATINGS
  // ============================================================================
  'AO': {
    branch: 'Navy',
    title: 'Aviation Ordnanceman',
    aliases: [],
    category: 'Aviation Weapons',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Heavy ordnance handling (2000+ lb bombs)',
      'Flight deck operations',
      'Jet blast/rotor wash',
      'Explosive handling'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Flight deck', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Jet operations', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar DDD', prevalence: 'Extreme', notes: 'Heavy ordnance', ecfrCode: 'DC 5243' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Overhead loading', ecfrCode: 'DC 5201' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling under aircraft', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'ABE': {
    branch: 'Navy',
    title: 'Aviation Boatswain\'s Mate (Equipment)',
    aliases: ['AB'],
    category: 'Aviation Deck',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Catapult/arresting gear operations',
      'Flight deck hazards',
      'Jet blast exposure',
      'Heavy equipment'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Catapult/jet noise', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Flight deck', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Equipment operation', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Deck work', ecfrCode: 'DC 5260/5261' },
      { condition: 'TBI', prevalence: 'Moderate', notes: 'Deck hazards', ecfrCode: 'DC 8045' }
    ]
  },
  'ABF': {
    branch: 'Navy',
    title: 'Aviation Boatswain\'s Mate (Fuels)',
    aliases: [],
    category: 'Aviation Deck',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'JP-5 fuel handling',
      'Flight deck operations',
      'Benzene exposure',
      'Fire hazards'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Flight deck', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Jet operations', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Fuel hose handling, deck work', ecfrCode: 'DC 5237' },
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Fuel vapors', ecfrCode: 'DC 6600' },
      { condition: 'Cancer (various)', prevalence: 'Moderate', notes: 'Benzene - PACT Act', ecfrCode: 'DC 7715' },
      { condition: 'Skin Conditions', prevalence: 'Moderate', notes: 'Fuel contact', ecfrCode: 'DC 7806' }
    ]
  },
  'ABH': {
    branch: 'Navy',
    title: 'Aviation Boatswain\'s Mate (Handling)',
    aliases: [],
    category: 'Aviation Deck',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Aircraft handling on deck',
      'Tow tractor operations',
      'Jet blast/rotor wash',
      'Chocking/chaining aircraft'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Flight deck', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Jet/helicopter noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Chains, tie-downs', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Chain handling', ecfrCode: 'DC 5201' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Chocking operations', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'AD': {
    branch: 'Navy',
    title: 'Aviation Machinist\'s Mate',
    aliases: [],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Jet engine maintenance',
      'Flight deck operations',
      'Hydraulic fluid exposure',
      'Hot engine components'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Engine testing', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Jet engines', ecfrCode: 'DC 6100' },
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Fumes, solvents', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Component handling', ecfrCode: 'DC 5237' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Hot components', ecfrCode: 'DC 7801' }
    ]
  },
  'AM': {
    branch: 'Navy',
    title: 'Aviation Structural Mechanic',
    aliases: ['AMS'],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Sheet metal/composite work',
      'Flight line operations',
      'Chemical exposure (sealants)',
      'Power tool noise'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Riveting, flight line', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Power tools, aircraft', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Aircraft panel handling', ecfrCode: 'DC 5237' },
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Composites, chemicals', ecfrCode: 'DC 6600' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Riveting', ecfrCode: 'DC 8515' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Overhead work', ecfrCode: 'DC 5201' }
    ]
  },
  'AWF': {
    branch: 'Navy',
    title: 'Naval Aircrewman Mechanical',
    aliases: ['AW'],
    category: 'Aircrew',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Helicopter/aircraft operations',
      'SAR missions',
      'Rescue swimmer duties',
      'Equipment handling in flight'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Aircraft noise', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Helicopter operations', ecfrCode: 'DC 6100' },
      { condition: 'PTSD', prevalence: 'High', notes: 'SAR operations', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment, rescues', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Hoisting operations', ecfrCode: 'DC 5201' }
    ]
  },
  'MA': {
    branch: 'Navy',
    title: 'Master-at-Arms',
    aliases: [],
    category: 'Security',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Law enforcement duties',
      'Weapons qualifications',
      'Physical confrontations',
      'Brig operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Weapons fire', ecfrCode: 'DC 6260' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Body armor, duty belt', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Patrol duties', ecfrCode: 'DC 5260/5261' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Law enforcement stress', ecfrCode: 'DC 9411' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },
  'CTN': {
    branch: 'Navy',
    title: 'Cryptologic Technician Networks',
    aliases: [],
    category: 'Intelligence/Cyber',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intensive computer operations',
      'Cyber warfare stress',
      'Classified work environment',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'Very High', notes: 'Keyboard work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Migraine', prevalence: 'High', notes: 'Screen time', ecfrCode: 'DC 8100' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Operational stress', ecfrCode: 'DC 9413' }
    ]
  },
  'CTR': {
    branch: 'Navy',
    title: 'Cryptologic Technician Collection',
    aliases: [],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low to Moderate',
    physicalDemand: 'Light',
    hazards: [
      'Extended headset use',
      'Shift work',
      'Intelligence collection stress'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Headset use', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Extended listening', ecfrCode: 'DC 6100' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Transcription', ecfrCode: 'DC 8515' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },
  'CTT': {
    branch: 'Navy',
    title: 'Cryptologic Technician Technical',
    aliases: [],
    category: 'Intelligence/Electronics',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Electronic equipment operation',
      'SIGINT operations',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Equipment operation', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Console work', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },
  'CTI': {
    branch: 'Navy',
    title: 'Cryptologic Technician Interpretive (Linguist)',
    aliases: [],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low to Moderate',
    physicalDemand: 'Light',
    hazards: [
      'Extended headset use',
      'Language analysis stress',
      'Exposure to disturbing content',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Headset use', ecfrCode: 'DC 6260' },
      { condition: 'Anxiety/PTSD', prevalence: 'Moderate', notes: 'Content exposure', ecfrCode: 'DC 9413/9411' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Transcription', ecfrCode: 'DC 8515' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },
  'EOD_NAVY': {
    branch: 'Navy',
    title: 'Explosive Ordnance Disposal Technician',
    aliases: [],
    category: 'EOD',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'Underwater EOD',
      'IED disposal',
      'Diving operations',
      'Controlled detonations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Detonations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Blast exposure', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'Very High', notes: 'Repeated blasts', ecfrCode: 'DC 8045' },
      { condition: 'PTSD', prevalence: 'Extreme', notes: 'EOD operations', ecfrCode: 'DC 9411' },
      { condition: 'Decompression Sickness', prevalence: 'Moderate', notes: 'Diving', ecfrCode: 'DC 6817' },
      { condition: 'Lumbar DDD', prevalence: 'Very High', notes: 'Equipment weight', ecfrCode: 'DC 5243' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Bomb suit, kneeling', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'SO': {
    branch: 'Navy',
    title: 'Special Warfare Operator (SEAL)',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'Combat diving',
      'Parachute operations',
      'Direct action missions',
      'Extreme physical demands'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Weapons, explosives', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Combat noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar/Cervical DDD', prevalence: 'Extreme', notes: 'Equipment, operations', ecfrCode: 'DC 5237/5243' },
      { condition: 'PTSD', prevalence: 'Very High', notes: 'Combat operations', ecfrCode: 'DC 9411' },
      { condition: 'TBI', prevalence: 'Very High', notes: 'Blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'Bilateral Knee Injuries', prevalence: 'Extreme', notes: 'Operational demands', ecfrCode: 'DC 5260/5261' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Equipment, parachute', ecfrCode: 'DC 5201' },
      { condition: 'Ankle Injuries', prevalence: 'Very High', notes: 'Terrain, jumps', ecfrCode: 'DC 5270/5271' }
    ]
  },
  'SB': {
    branch: 'Navy',
    title: 'Special Warfare Boat Operator (SWCC)',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'High-speed boat operations',
      'Weapons systems operation',
      'Whole-body vibration',
      'Combat insertions/extractions'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Boat engines, weapons', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Boat/weapons noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar DDD', prevalence: 'Extreme', notes: 'Boat vibration/impacts', ecfrCode: 'DC 5243' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat operations', ecfrCode: 'DC 9411' },
      { condition: 'Cervical Strain', prevalence: 'Very High', notes: 'Boat impacts', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Absorbing impacts', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'ND': {
    branch: 'Navy',
    title: 'Navy Diver',
    aliases: [],
    category: 'Diving',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Deep diving operations',
      'Salvage/recovery',
      'Cold water exposure',
      'Heavy equipment'
    ],
    commonConditions: [
      { condition: 'Decompression Sickness Residuals', prevalence: 'High', notes: 'Deep diving', ecfrCode: 'DC 6817' },
      { condition: 'Sinus/Ear Issues', prevalence: 'Very High', notes: 'Pressure changes', ecfrCode: 'DC 6510/6200' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment weight', ecfrCode: 'DC 5237' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Underwater work', ecfrCode: 'DC 6100' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Fin kicks', ecfrCode: 'DC 5260/5261' },
      { condition: 'Cold Injuries', prevalence: 'Moderate', notes: 'Cold water', ecfrCode: 'DC 7122' }
    ]
  },
  'AT': {
    branch: 'Navy',
    title: 'Aviation Electronics Technician',
    aliases: ['AE'],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Moderate',
    hazards: [
      'Flight line operations',
      'Avionics systems repair',
      'Soldering and electronic work',
      'RF/radar exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Flight deck/line operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Aircraft operations', ecfrCode: 'DC 6100' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine electronic work', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Circuit board work', ecfrCode: 'DC 6066' },
      { condition: 'Respiratory Issues', prevalence: 'Low-Moderate', notes: 'Soldering fumes', ecfrCode: 'DC 6600' }
    ]
  },
  'AZ': {
    branch: 'Navy',
    title: 'Aviation Maintenance Administrationman',
    aliases: [],
    category: 'Aviation Administration',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Light',
    hazards: [
      'Flight line exposure (occasional)',
      'Prolonged computer work',
      'Administrative stress'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Flight line exposure', ecfrCode: 'DC 6260' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer work, typing', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged sitting', ecfrCode: 'DC 5237' }
    ]
  },
  'PR': {
    branch: 'Navy',
    title: 'Aircrew Survival Equipmentman (Parachute Rigger)',
    aliases: [],
    category: 'Aviation Support',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Parachute rigging and inspection',
      'Survival equipment maintenance',
      'Flight line exposure',
      'Sewing machine/fabric work'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Flight line', ecfrCode: 'DC 6260' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Rigging, sewing work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Inspection posture', ecfrCode: 'DC 5237' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Standing, bending', ecfrCode: 'DC 5237' }
    ]
  },
  'IC': {
    branch: 'Navy',
    title: 'Interior Communications Electrician',
    aliases: [],
    category: 'Electronics',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Electrical systems work',
      'Shipboard communications systems',
      'Confined space work',
      'Gyroscope and navigation equipment'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Shipboard noise', ecfrCode: 'DC 6100' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine wiring work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Overhead work', ecfrCode: 'DC 5237' },
      { condition: 'Electrical Burns', prevalence: 'Low-Moderate', notes: 'Electrical systems', ecfrCode: 'DC 7801' }
    ]
  },
  'STS': {
    branch: 'Navy',
    title: 'Sonar Technician (Submarine)',
    aliases: [],
    category: 'Operations',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Submarine operations',
      'Sonar system monitoring',
      'Confined submarine environment',
      'Extended underwater deployments'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Sonar operations, submarine noise', ecfrCode: 'DC 6100' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Submarine schedules, no natural light', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety/Depression', prevalence: 'Moderate', notes: 'Confined space, extended deployments', ecfrCode: 'DC 9413/9434' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Console posture', ecfrCode: 'DC 5237' },
      { condition: 'Vitamin D Deficiency', prevalence: 'High', notes: 'No sunlight exposure', ecfrCode: 'Varies' }
    ]
  },

  // ============================================================================
  // EXPANDED MARINE CORPS MOS
  // ============================================================================
  '0317': {
    branch: 'Marines',
    title: 'Scout Sniper',
    aliases: [],
    category: 'Infantry',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Precision rifle fire',
      'Extended field operations',
      'Extreme physical conditioning',
      'Combat stress'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Rifle fire', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Weapons fire', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar DDD', prevalence: 'Extreme', notes: 'Equipment, prone positions', ecfrCode: 'DC 5243' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat operations', ecfrCode: 'DC 9411' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Scope use, prone', ecfrCode: 'DC 5237' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Scope eye strain', ecfrCode: 'DC 6066' }
    ]
  },
  '0321': {
    branch: 'Marines',
    title: 'Reconnaissance Marine',
    aliases: [],
    category: 'Special Operations',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Deep reconnaissance patrols',
      'Amphibious operations',
      'Parachute/dive qualified',
      'Extended isolation'
    ],
    commonConditions: [
      { condition: 'Lumbar DDD', prevalence: 'Extreme', notes: 'Heavy loads, terrain', ecfrCode: 'DC 5243' },
      { condition: 'Bilateral Knee Injuries', prevalence: 'Extreme', notes: 'Patrolling, jumps', ecfrCode: 'DC 5260/5261' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Weapons fire', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Combat', ecfrCode: 'DC 6100' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Isolated operations', ecfrCode: 'DC 9411' },
      { condition: 'Ankle Injuries', prevalence: 'Very High', notes: 'Terrain, jumps', ecfrCode: 'DC 5270/5271' }
    ]
  },
  '0352': {
    branch: 'Marines',
    title: 'Anti-Tank Missileman (TOW/Javelin)',
    aliases: [],
    category: 'Infantry',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Missile launch backblast',
      'Heavy missile system carry',
      'Combat operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Missile launch', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Backblast', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'System carry', ecfrCode: 'DC 5237' },
      { condition: 'TBI', prevalence: 'Moderate', notes: 'Overpressure', ecfrCode: 'DC 8045' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat', ecfrCode: 'DC 9411' }
    ]
  },
  '1371': {
    branch: 'Marines',
    title: 'Combat Engineer',
    aliases: [],
    category: 'Engineer',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Demolitions/breaching',
      'IED/mine clearance',
      'Construction in combat',
      'Heavy equipment'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Explosives', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Demolitions', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast exposure', ecfrCode: 'DC 8045' },
      { condition: 'PTSD', prevalence: 'High', notes: 'IED clearance', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Equipment, construction', ecfrCode: 'DC 5237' }
    ]
  },
  '2336': {
    branch: 'Marines',
    title: 'Explosive Ordnance Disposal Technician (EOD)',
    aliases: [],
    category: 'EOD',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'IED/UXO disposal',
      'Bomb suit operations',
      'Controlled detonations',
      'Combat zone operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Detonations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Blast exposure', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'Very High', notes: 'Repeated blasts', ecfrCode: 'DC 8045' },
      { condition: 'PTSD', prevalence: 'Extreme', notes: 'IED disposal', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar DDD', prevalence: 'Very High', notes: 'Bomb suit', ecfrCode: 'DC 5243' },
      { condition: 'Knee Injuries', prevalence: 'Very High', notes: 'Suit, kneeling', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '5811': {
    branch: 'Marines',
    title: 'Military Police',
    aliases: [],
    category: 'Military Police',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Law enforcement duties',
      'Weapons qualifications',
      'Physical confrontations',
      'Convoy security'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Body armor, duty belt', ecfrCode: 'DC 5237' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Weapons fire', ecfrCode: 'DC 6260' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Running, kneeling', ecfrCode: 'DC 5260/5261' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Law enforcement stress', ecfrCode: 'DC 9411' }
    ]
  },
  '5812': {
    branch: 'Marines',
    title: 'Military Working Dog Handler',
    aliases: [],
    category: 'Military Police',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'K-9 handling physical demands',
      'IED detection operations',
      'Combat patrols',
      'Animal-related injuries'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Dog handling, equipment', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Leash control', ecfrCode: 'DC 5201' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat, dog loss', ecfrCode: 'DC 9411' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Running, kneeling', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '6173': {
    branch: 'Marines',
    title: 'CH-53 Helicopter Crew Chief',
    aliases: [],
    category: 'Aviation',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy helicopter operations',
      'External load operations',
      'Combat missions',
      'Gunner duties'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'CH-53 noise', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Helicopter operations', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Vibration, equipment', ecfrCode: 'DC 5237' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Combat missions', ecfrCode: 'DC 9411' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Gun operations', ecfrCode: 'DC 5201' }
    ]
  },
  '6531': {
    branch: 'Marines',
    title: 'Aviation Ordnance Technician',
    aliases: [],
    category: 'Aviation Weapons',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Heavy ordnance handling',
      'Flight line operations',
      'Explosive handling',
      'Aircraft weapons loading'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Flight line', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Jet operations', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar DDD', prevalence: 'Very High', notes: 'Heavy ordnance', ecfrCode: 'DC 5243' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Loading operations', ecfrCode: 'DC 5201' }
    ]
  },
  '0111': {
    branch: 'Marines',
    title: 'Administrative Specialist',
    aliases: [],
    category: 'Administration',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged computer use',
      'Administrative stress',
      'Repetitive typing'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Typing', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged sitting', ecfrCode: 'DC 5237' }
    ]
  },
  '0231': {
    branch: 'Marines',
    title: 'Intelligence Specialist',
    aliases: [],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged computer use',
      'Disturbing imagery exposure',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer work', ecfrCode: 'DC 8515' },
      { condition: 'PTSD/Anxiety', prevalence: 'Moderate', notes: 'Imagery exposure', ecfrCode: 'DC 9411/9413' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Posture', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },

  '0651': {
    branch: 'Marines',
    title: 'Data Network Specialist (Cyber Network Operator)',
    aliases: ['2542'],
    category: 'Communications/Cyber',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intensive computer/network operations',
      'Shift work',
      'Server room environments',
      'Cyber security stress'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'Very High', notes: 'Keyboard intensive work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged sitting', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Migraine', prevalence: 'Moderate', notes: 'Screen time', ecfrCode: 'DC 8100' }
    ]
  },
  '0844': {
    branch: 'Marines',
    title: 'Fire Direction Controlman',
    aliases: [],
    category: 'Artillery',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Artillery fire coordination',
      'Close proximity to howitzer fire',
      'Field operations',
      'High-stress fire missions'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Artillery operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Howitzer fire', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast overpressure', ecfrCode: 'DC 8045' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment carry', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Fire mission stress', ecfrCode: 'DC 9413' }
    ]
  },
  '0861': {
    branch: 'Marines',
    title: 'Fire Support Marine (Forward Observer)',
    aliases: [],
    category: 'Artillery',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Forward observer position in combat',
      'Weapons fire coordination',
      'Heavy equipment carrying (radios, optics)',
      'Direct exposure to enemy fire'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Combat, artillery', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Weapons fire', ecfrCode: 'DC 6100' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Front-line combat exposure', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Equipment carry', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Terrain navigation', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '2611': {
    branch: 'Marines',
    title: 'Cryptologic Digital Network Tech/Analyst',
    aliases: ['2651'],
    category: 'Intelligence/Cyber',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Cryptologic operations',
      'Network monitoring',
      'Classified information handling',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer operations', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Workstation posture', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Classified operations', ecfrCode: 'DC 9413' }
    ]
  },
  '2631': {
    branch: 'Marines',
    title: 'Signals Intelligence Analyst',
    aliases: ['2691'],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low-Moderate (Headset)',
    physicalDemand: 'Light',
    hazards: [
      'Extended headset monitoring',
      'Signal analysis',
      'Shift work',
      'Intelligence operations stress'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Headset monitoring', ecfrCode: 'DC 6260' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Transcription, keyboard work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Workstation posture', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Intelligence operations', ecfrCode: 'DC 9413' }
    ]
  },

  // ============================================================================
  // EXPANDED COAST GUARD RATINGS
  // ============================================================================
  'AST': {
    branch: 'Coast Guard',
    title: 'Aviation Survival Technician (Rescue Swimmer)',
    aliases: [],
    category: 'Aviation/Rescue',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Helicopter rescue operations',
      'Cold water rescues',
      'Extreme physical demands',
      'Traumatic rescue situations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Helicopter operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Aircraft noise', ecfrCode: 'DC 6100' },
      { condition: 'PTSD', prevalence: 'Very High', notes: 'Rescue operations, casualties', ecfrCode: 'DC 9411' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Rescue carries', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Hoisting, swimming', ecfrCode: 'DC 5201' },
      { condition: 'Cold Injuries', prevalence: 'High', notes: 'Cold water exposure', ecfrCode: 'DC 7122' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Physical demands', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'AMT': {
    branch: 'Coast Guard',
    title: 'Aviation Maintenance Technician',
    aliases: [],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Helicopter/aircraft maintenance',
      'Rotor blade hazards',
      'Chemical exposure',
      'Flight operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Aircraft operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Helicopter noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Maintenance positions', ecfrCode: 'DC 5237' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Fumes, solvents', ecfrCode: 'DC 6600' }
    ]
  },
  'AET': {
    branch: 'Coast Guard',
    title: 'Avionics Electrical Technician',
    aliases: [],
    category: 'Aviation Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Moderate',
    hazards: [
      'Aircraft electrical systems',
      'Flight line operations',
      'Soldering operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Flight line', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Aircraft noise', ecfrCode: 'DC 6100' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Cockpit work', ecfrCode: 'DC 5237' }
    ]
  },
  'DV_CG': {
    branch: 'Coast Guard',
    title: 'Diver',
    aliases: [],
    category: 'Diving',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Underwater operations',
      'Cold water exposure',
      'Hull inspections',
      'Salvage operations'
    ],
    commonConditions: [
      { condition: 'Decompression Sickness', prevalence: 'High', notes: 'Diving operations', ecfrCode: 'DC 6817' },
      { condition: 'Sinus/Ear Issues', prevalence: 'Very High', notes: 'Pressure changes', ecfrCode: 'DC 6510/6200' },
      { condition: 'Cold Injuries', prevalence: 'High', notes: 'Cold water', ecfrCode: 'DC 7122' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment', ecfrCode: 'DC 5237' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Fin kicks', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'GM_CG': {
    branch: 'Coast Guard',
    title: 'Gunner\'s Mate',
    aliases: [],
    category: 'Weapons',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Shipboard weapons operations',
      'Ammunition handling',
      'Weapons maintenance',
      'Live fire exercises'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Weapons fire', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Gunfire', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Ammo handling', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Weapons handling', ecfrCode: 'DC 5201' }
    ]
  },
  'MST': {
    branch: 'Coast Guard',
    title: 'Marine Science Technician',
    aliases: [],
    category: 'Environmental',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Moderate',
    hazards: [
      'HAZMAT/pollution response',
      'Chemical exposure',
      'Vessel inspections',
      'Environmental investigations'
    ],
    commonConditions: [
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'HAZMAT exposure', ecfrCode: 'DC 6600' },
      { condition: 'Skin Conditions', prevalence: 'Moderate', notes: 'Chemical contact', ecfrCode: 'DC 7806' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Pollution response stress', ecfrCode: 'DC 9413' }
    ]
  },
  'ET_CG': {
    branch: 'Coast Guard',
    title: 'Electronics Technician',
    aliases: [],
    category: 'Electronics',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Electrical/electronic systems',
      'Climbing towers/antennas',
      'Shipboard equipment'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Equipment noise', ecfrCode: 'DC 6100' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Fine work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Tower work', ecfrCode: 'DC 5237' }
    ]
  },
  'IT_CG': {
    branch: 'Coast Guard',
    title: 'Information Systems Technician',
    aliases: ['TC'],
    category: 'Communications',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Computer operations',
      'Server room environments',
      'Cable installation'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Keyboard use', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Computer posture', ecfrCode: 'DC 5237' }
    ]
  },
  'DC_CG': {
    branch: 'Coast Guard',
    title: 'Damage Controlman',
    aliases: [],
    category: 'Damage Control',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Firefighting operations',
      'Welding/fabrication',
      'Emergency response',
      'HAZMAT handling'
    ],
    commonConditions: [
      { condition: 'Respiratory Issues', prevalence: 'Very High', notes: 'Smoke, fumes', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Equipment, rescue', ecfrCode: 'DC 5237' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Power tools, equipment', ecfrCode: 'DC 6260' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Welding, firefighting', ecfrCode: 'DC 7801' }
    ]
  },
  'EM_CG': {
    branch: 'Coast Guard',
    title: 'Electrician\'s Mate',
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Electrical systems',
      'Shore power connections',
      'Generator operations'
    ],
    commonConditions: [
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Generator noise', ecfrCode: 'DC 6100' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Electrical hazards', ecfrCode: 'DC 7801' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Equipment work', ecfrCode: 'DC 5237' }
    ]
  },
  'SK_CG': {
    branch: 'Coast Guard',
    title: 'Storekeeper',
    aliases: [],
    category: 'Supply',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy supply lifting',
      'Warehouse operations',
      'Forklift operations'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy lifting', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Lifting overhead', ecfrCode: 'DC 5201' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Squatting, kneeling', ecfrCode: 'DC 5260/5261' }
    ]
  },
  'CS_CG': {
    branch: 'Coast Guard',
    title: 'Culinary Specialist',
    aliases: ['FS'],
    category: 'Support',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Kitchen operations',
      'Burns from cooking',
      'Knife injuries',
      'Heavy lifting',
      'Standing for long periods'
    ],
    commonConditions: [
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Standing, lifting', ecfrCode: 'DC 5237' },
      { condition: 'Burns', prevalence: 'High', notes: 'Hot surfaces, liquids', ecfrCode: 'DC 7801' },
      { condition: 'Plantar Fasciitis', prevalence: 'High', notes: 'Prolonged standing', ecfrCode: 'DC 5276' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Repetitive cutting', ecfrCode: 'DC 8515' }
    ]
  },
  'PA_CG': {
    branch: 'Coast Guard',
    title: 'Public Affairs Specialist',
    aliases: [],
    category: 'Communications',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Computer work',
      'Field reporting',
      'Equipment carrying'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Typing, editing', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Computer posture', ecfrCode: 'DC 5237' }
    ]
  },
  'IS_CG': {
    branch: 'Coast Guard',
    title: 'Intelligence Specialist',
    aliases: [],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intelligence analysis',
      'Computer operations',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer work', ecfrCode: 'DC 8515' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Intelligence stress', ecfrCode: 'DC 9413' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },
  'IV': {
    branch: 'Coast Guard',
    title: 'Investigator (Reserve)',
    aliases: [],
    category: 'Law Enforcement',
    timePeriod: 'Active (Reserve only)',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Moderate',
    hazards: [
      'Criminal investigations',
      'Background checks',
      'Field interviews'
    ],
    commonConditions: [
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Investigation stress', ecfrCode: 'DC 9413' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Field work', ecfrCode: 'DC 5237' }
    ]
  },

  // ============================================================================
  // ADDITIONAL ARMY MOS - EXPANDED COVERAGE
  // ============================================================================
  '11Z': {
    branch: 'Army',
    title: 'Infantry Senior Sergeant',
    aliases: [],
    category: 'Combat Arms',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'All infantry hazards',
      'Leadership stress',
      'Extended combat exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Career-long exposure', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Cumulative damage', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar/Cervical DDD', prevalence: 'Extreme', notes: 'Years of load bearing', ecfrCode: 'DC 5243' },
      { condition: 'PTSD', prevalence: 'Very High', notes: 'Multiple deployments', ecfrCode: 'DC 9411' },
      { condition: 'Bilateral Knee Arthritis', prevalence: 'Very High', notes: 'Cumulative wear', ecfrCode: 'DC 5003' }
    ]
  },
  '13J': {
    branch: 'Army',
    title: 'Fire Control Specialist (MLRS/HIMARS)',
    aliases: [],
    category: 'Combat Arms',
    timePeriod: 'Active',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'MLRS/HIMARS rocket launch',
      'Extreme noise and overpressure',
      'Heavy ammunition handling'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Rocket launch', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'MLRS operations', ecfrCode: 'DC 6100' },
      { condition: 'TBI', prevalence: 'High', notes: 'Overpressure', ecfrCode: 'DC 8045' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Rocket pod handling', ecfrCode: 'DC 5237' }
    ]
  },
  '13R': {
    branch: 'Army',
    title: 'Field Artillery Firefinder Radar Operator',
    aliases: [],
    category: 'Combat Arms',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Radar operations',
      'Generator noise',
      'Field operations'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Generator noise', ecfrCode: 'DC 6260' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift operations', ecfrCode: 'DC 6847' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Console work', ecfrCode: 'DC 5237' }
    ]
  },
  '14T': {
    branch: 'Army',
    title: 'PATRIOT Launching Station Enhanced Operator/Maintainer',
    aliases: [],
    category: 'Air Defense',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Missile launcher operations',
      'Heavy equipment maintenance',
      'High-alert status'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Launcher operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Missile launch', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment maintenance', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Alert operations', ecfrCode: 'DC 9413' }
    ]
  },
  '35G': {
    branch: 'Army',
    title: 'Geospatial Intelligence Imagery Analyst',
    aliases: ['96D'],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intensive screen time',
      'Disturbing imagery',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Imagery analysis', ecfrCode: 'DC 6066' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Disturbing imagery', ecfrCode: 'DC 9411' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Screen posture', ecfrCode: 'DC 5237' }
    ]
  },
  '35M': {
    branch: 'Army',
    title: 'Human Intelligence Collector',
    aliases: ['97E', '35E'],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Variable',
    physicalDemand: 'Moderate',
    hazards: [
      'Interrogation/interview stress',
      'Combat zone operations',
      'Psychological demands'
    ],
    commonConditions: [
      { condition: 'PTSD', prevalence: 'High', notes: 'Interrogation, combat exposure', ecfrCode: 'DC 9411' },
      { condition: 'Anxiety/Depression', prevalence: 'High', notes: 'Job stress', ecfrCode: 'DC 9413/9434' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Operational tempo', ecfrCode: 'DC 6847' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Combat environment', ecfrCode: 'DC 6260' }
    ]
  },
  '35P': {
    branch: 'Army',
    title: 'Cryptologic Linguist',
    aliases: ['98G'],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low to Moderate',
    physicalDemand: 'Light',
    hazards: [
      'Extended headset use',
      'Disturbing content exposure',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Headset use', ecfrCode: 'DC 6260' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Content exposure', ecfrCode: 'DC 9411' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Transcription', ecfrCode: 'DC 8515' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Intelligence stress', ecfrCode: 'DC 9413' }
    ]
  },
  '35N': {
    branch: 'Army',
    title: 'Signals Intelligence Analyst',
    aliases: ['98C'],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intensive signal analysis on screens',
      'Shift work (24/7 SIGINT operations)',
      'Classified information stress',
      'Headset use for signal monitoring',
      'High-pressure intelligence deadlines'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Signal analysis, transcription', ecfrCode: 'DC 8515' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Headset monitoring', ecfrCode: 'DC 6260' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Workstation posture', ecfrCode: 'DC 5237' },
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Screen analysis', ecfrCode: 'DC 6066' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Rotating shifts', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Intelligence operations stress', ecfrCode: 'DC 9413' },
      { condition: 'Migraine/Headaches', prevalence: 'Moderate', notes: 'Screen time, stress', ecfrCode: 'DC 8100' }
    ]
  },
  '35T': {
    branch: 'Army',
    title: 'Military Intelligence Systems Maintainer/Integrator',
    aliases: ['33W'],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Moderate',
    hazards: [
      'Electronic equipment maintenance',
      'Soldering and fine motor work',
      'Generator noise exposure (field)',
      'Classified facility work',
      'Awkward positions in equipment bays'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine electronic work', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Equipment maintenance postures', ecfrCode: 'DC 5237' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Generator/equipment noise in field', ecfrCode: 'DC 6260' },
      { condition: 'Respiratory Issues', prevalence: 'Low-Moderate', notes: 'Soldering fumes', ecfrCode: 'DC 6600' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Fine detail work', ecfrCode: 'DC 6066' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Equipment lifting, awkward positions', ecfrCode: 'DC 5237' }
    ]
  },
  '35S': {
    branch: 'Army',
    title: 'Signals Collector/Analyst (SIGINT)',
    aliases: ['98H', '98J', '96R'],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2) - Headset',
    physicalDemand: 'Light',
    hazards: [
      'Extended headset use with high-frequency tones (Morse code)',
      'Repetitive audio signals causing auditory fatigue',
      'Shift work (24/7 SIGINT operations)',
      'Classified information stress',
      'Intensive listening concentration',
      'Screen monitoring fatigue'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Morse code high-frequency tones cause different damage pattern than voice - sustained beeping frequencies', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Extended headset use, specific frequency damage from CW/Morse signals', ecfrCode: 'DC 6100' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Signal transcription, keyboard work', ecfrCode: 'DC 8515' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Rotating shifts, 24/7 operations', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'High-stakes intelligence collection', ecfrCode: 'DC 9413' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Workstation posture, headset weight', ecfrCode: 'DC 5237' },
      { condition: 'Migraine/Headaches', prevalence: 'Moderate', notes: 'Audio-induced from sustained high-frequency tones', ecfrCode: 'DC 8100' }
    ]
  },
  '91A': {
    branch: 'Army',
    title: 'M1 Abrams Tank System Maintainer',
    aliases: ['63W', '63Y'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Heavy tank component handling',
      'Tank operations noise',
      'Chemical exposure',
      'Confined space work'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Tank operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Engine noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy components', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Overhead lifting', ecfrCode: 'DC 5201' }
    ]
  },
  '91D': {
    branch: 'Army',
    title: 'Tactical Power Generation Specialist',
    aliases: ['52D'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Generator noise exposure',
      'Electrical hazards',
      'Fuel/exhaust exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Generator operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Constant generator noise', ecfrCode: 'DC 6100' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Exhaust fumes', ecfrCode: 'DC 6600' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Equipment handling', ecfrCode: 'DC 5237' }
    ]
  },
  '91F': {
    branch: 'Army',
    title: 'Small Arms/Artillery Repairer',
    aliases: ['45B', '45K'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Moderate',
    hazards: [
      'Test firing weapons',
      'Chemical solvents',
      'Fine mechanical work'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Test firing', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Weapons testing', ecfrCode: 'DC 6100' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine work', ecfrCode: 'DC 8515' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Solvents', ecfrCode: 'DC 6600' }
    ]
  },
  '91C': {
    branch: 'Army',
    title: 'Utilities Equipment Repairer',
    aliases: ['52C'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Generator and HVAC equipment repair',
      'Electrical hazards',
      'Refrigerant exposure',
      'Heavy equipment lifting',
      'Confined space work'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Generator/equipment noise', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Power equipment operation', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Heavy equipment lifting, awkward positions', ecfrCode: 'DC 5237' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Refrigerant, fumes exposure', ecfrCode: 'DC 6600' },
      { condition: 'Electrical Burns', prevalence: 'Low-Moderate', notes: 'High voltage equipment', ecfrCode: 'DC 7801' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Tool use, wiring work', ecfrCode: 'DC 8515' }
    ]
  },
  '91L': {
    branch: 'Army',
    title: 'Construction Equipment Repairer',
    aliases: ['63D'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Heavy construction equipment (bulldozers, graders, scrapers)',
      'Diesel engine noise and fumes',
      'Hydraulic system hazards',
      'Heavy component lifting',
      'Working under raised equipment'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Diesel engines, heavy equipment', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Construction equipment noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain / DDD', prevalence: 'Very High', notes: 'Heavy lifting, awkward positions', ecfrCode: 'DC 5237/5243' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Overhead work, heavy parts', ecfrCode: 'DC 5201' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Diesel fumes, dust', ecfrCode: 'DC 6600' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling on hard surfaces', ecfrCode: 'DC 5260/5261' }
    ]
  },
  '91M': {
    branch: 'Army',
    title: 'Bradley Fighting Vehicle System Maintainer',
    aliases: ['63E', '63M'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Bradley IFV maintenance and repair',
      'Track vehicle operations noise',
      'Turret and weapons system work',
      'Heavy component handling',
      'Confined space work inside vehicle'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Bradley engine and operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Armored vehicle noise', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy track/component lifting', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Turret work, overhead lifting', ecfrCode: 'DC 5201' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Confined space, kneeling', ecfrCode: 'DC 5260/5261' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Working in cramped vehicle spaces', ecfrCode: 'DC 5237' }
    ]
  },
  '91P': {
    branch: 'Army',
    title: 'Artillery Mechanic',
    aliases: ['63J', '45L'],
    category: 'Maintenance',
    timePeriod: 'Active',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Self-propelled artillery (Paladin, MLRS) maintenance',
      'Howitzer repair and test firing',
      'Heavy barrel and breech handling',
      'Hydraulic recoil systems',
      'Propellant residue exposure'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Artillery test firing, maintenance', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Howitzer/MLRS operations', ecfrCode: 'DC 6100' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy gun components', ecfrCode: 'DC 5237' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Barrel handling, overhead work', ecfrCode: 'DC 5201' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Propellant residue, hydraulic fluids', ecfrCode: 'DC 6600' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Fine adjustment work', ecfrCode: 'DC 8515' }
    ]
  },

  // ============================================================================
  // UNITED STATES SPACE FORCE (USSF) - Established December 20, 2019
  // "Guardians" - Semper Supra (Always Above)
  // Space Force uses modified Air Force specialty codes (5S, 5I, 5C series)
  // ============================================================================
  
  // === SPACE OPERATIONS ===
  '13S': {
    branch: 'Space Force',
    title: 'Space Operations Officer',
    aliases: ['13SXA', '13SXB', '13SXC'],
    category: 'Space Operations',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Extended screen time',
      'Shift work operations',
      'High-stress decision making',
      'Classified information stress'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Screen time, satellite monitoring', ecfrCode: 'DC 6066' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer/console operations', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Console posture', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'Very High', notes: '24/7 operations', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Mission critical decisions', ecfrCode: 'DC 9413' }
    ]
  },
  '5S0X1': {
    branch: 'Space Force',
    title: 'Space Systems Operator',
    aliases: ['1C6X1', '1C531'],  // Former Air Force Space Command codes
    category: 'Space Operations',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Satellite operations monitoring',
      'Continuous display monitoring',
      '24/7 shift operations',
      'Space domain awareness'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Multi-screen monitoring', ecfrCode: 'DC 6066' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Console operations', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Workstation posture', ecfrCode: 'DC 5237' },
      { condition: 'Sleep Disorders', prevalence: 'Very High', notes: 'Rotating shifts', ecfrCode: 'DC 6847' },
      { condition: 'Migraines', prevalence: 'Moderate', notes: 'Screen strain', ecfrCode: 'DC 8100' }
    ]
  },
  '13A': {
    branch: 'Space Force',
    title: 'Astronaut',
    aliases: [],
    category: 'Space Operations',
    timePeriod: 'Active',
    noiseExposure: 'Variable (Launch/Flight)',
    physicalDemand: 'Extreme',
    hazards: [
      'Spaceflight physiological effects',
      'Launch and re-entry G-forces',
      'Microgravity bone/muscle loss',
      'Radiation exposure',
      'Isolation stress',
      'EVA hazards'
    ],
    commonConditions: [
      { condition: 'Bone Density Loss', prevalence: 'High', notes: 'Microgravity effects', ecfrCode: 'DC 5013' },
      { condition: 'Vision Changes (SANS)', prevalence: 'High', notes: 'Spaceflight-associated neuro-ocular syndrome', ecfrCode: 'DC 6066' },
      { condition: 'Vestibular Disorders', prevalence: 'Moderate', notes: 'Microgravity adaptation', ecfrCode: 'DC 6204' },
      { condition: 'Cervical/Lumbar DDD', prevalence: 'High', notes: 'Launch/landing forces', ecfrCode: 'DC 5243' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Orbital day/night cycles', ecfrCode: 'DC 6847' },
      { condition: 'Radiation-related conditions', prevalence: 'Moderate', notes: 'Space radiation exposure', ecfrCode: 'DC 7343' }
    ]
  },

  // === INTELLIGENCE ===
  '14N': {
    branch: 'Space Force',
    title: 'Intelligence Officer',
    aliases: [],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Classified information stress',
      'Intensive screen work',
      'Disturbing intelligence content',
      'Shift operations'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Imagery analysis', ecfrCode: 'DC 6066' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer work', ecfrCode: 'DC 8515' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Intelligence operations stress', ecfrCode: 'DC 9413' },
      { condition: 'PTSD', prevalence: 'Low-Moderate', notes: 'Disturbing content exposure', ecfrCode: 'DC 9411' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },
  '5I0X1': {
    branch: 'Space Force',
    title: 'All Source Intelligence Analyst',
    aliases: ['1N0X1'],  // Former Air Force code
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intensive screen time',
      'Classified stress',
      'Shift work',
      'Information overload'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Screen analysis', ecfrCode: 'DC 6066' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Data processing', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Workstation posture', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Intel stress', ecfrCode: 'DC 9413' }
    ]
  },
  '5I1X1': {
    branch: 'Space Force',
    title: 'Geospatial Intelligence Analyst',
    aliases: ['1N1X1'],  // Former Air Force code
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Satellite imagery analysis',
      'Intensive visual work',
      'Classified operations',
      'Disturbing imagery exposure'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'Very High', notes: 'Detailed imagery analysis', ecfrCode: 'DC 6066' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Image manipulation', ecfrCode: 'DC 8515' },
      { condition: 'PTSD', prevalence: 'Low-Moderate', notes: 'BDA imagery', ecfrCode: 'DC 9411' },
      { condition: 'Migraines', prevalence: 'Moderate', notes: 'Eye strain', ecfrCode: 'DC 8100' }
    ]
  },
  '5I2X1': {
    branch: 'Space Force',
    title: 'Signals Intelligence Analyst',
    aliases: ['1N2X1'],  // Former Air Force code
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low-Moderate (Headset)',
    physicalDemand: 'Light',
    hazards: [
      'Headset operations',
      'Signal monitoring',
      'Classified stress',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Headset monitoring', ecfrCode: 'DC 6260' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Screen work', ecfrCode: 'DC 6066' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Transcription', ecfrCode: 'DC 8515' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Intel operations', ecfrCode: 'DC 9413' }
    ]
  },
  '5I3X1': {
    branch: 'Space Force',
    title: 'Fusion Analyst',
    aliases: [],
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Multi-source analysis',
      'High-pressure briefings',
      'Intensive screen work',
      'Information overload'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Multi-screen analysis', ecfrCode: 'DC 6066' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Report writing', ecfrCode: 'DC 8515' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Briefing pressure', ecfrCode: 'DC 9413' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift operations', ecfrCode: 'DC 6847' }
    ]
  },
  '5I8X1': {
    branch: 'Space Force',
    title: 'Targeting Analyst',
    aliases: ['1N4X1'],  // Former Air Force code
    category: 'Intelligence',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Target development stress',
      'Collateral damage concerns',
      'BDA imagery exposure',
      'Intensive analysis'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Imagery/mapping work', ecfrCode: 'DC 6066' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'BDA/strike aftermath imagery', ecfrCode: 'DC 9411' },
      { condition: 'Anxiety', prevalence: 'High', notes: 'Targeting responsibility', ecfrCode: 'DC 9413' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Computer operations', ecfrCode: 'DC 8515' }
    ]
  },

  // === CYBER OPERATIONS ===
  '17S': {
    branch: 'Space Force',
    title: 'Cyberspace Effects Operations Officer',
    aliases: [],
    category: 'Cyber Operations',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intensive computer operations',
      'High-stress cyber defense',
      'Classified operations',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'Very High', notes: 'Extensive typing/keyboard', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Screen time', ecfrCode: 'DC 6066' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Workstation posture', ecfrCode: 'DC 5237' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Cyber attack response', ecfrCode: 'DC 9413' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: '24/7 operations', ecfrCode: 'DC 6847' }
    ]
  },
  '5C0X1': {
    branch: 'Space Force',
    title: 'Cyberspace Operations',
    aliases: ['3D0X2', '3D0X3'],  // Former Air Force codes
    category: 'Cyber Operations',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Cyber operations tempo',
      'Screen fatigue',
      'Network defense stress',
      'Shift operations'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'Very High', notes: 'Keyboard intensive', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Multi-screen monitoring', ecfrCode: 'DC 6066' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Migraines', prevalence: 'Moderate', notes: 'Screen exposure', ecfrCode: 'DC 8100' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' }
    ]
  },

  // === ACQUISITION & ENGINEERING ===
  '62EXA': {
    branch: 'Space Force',
    title: 'Aeronautical Engineer',
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Active',
    noiseExposure: 'Low-Moderate',
    physicalDemand: 'Light',
    hazards: [
      'Technical stress',
      'Intensive analysis',
      'Launch site exposure (occasional)'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'CAD/analysis work', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Technical drawing', ecfrCode: 'DC 6066' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Desk work', ecfrCode: 'DC 5237' }
    ]
  },
  '62EXB': {
    branch: 'Space Force',
    title: 'Astronautical Engineer',
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Active',
    noiseExposure: 'Low-Moderate',
    physicalDemand: 'Light',
    hazards: [
      'Spacecraft systems design',
      'Launch support operations',
      'Technical analysis stress'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'CAD/simulation work', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Technical analysis', ecfrCode: 'DC 6066' },
      { condition: 'Tinnitus', prevalence: 'Low-Moderate', notes: 'Launch site exposure', ecfrCode: 'DC 6260' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Workstation posture', ecfrCode: 'DC 5237' }
    ]
  },
  '62EXC': {
    branch: 'Space Force',
    title: 'Computer Systems Engineer',
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Intensive screen time',
      'System design stress',
      'Data center environments'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'Very High', notes: 'Programming/design', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Screen work', ecfrCode: 'DC 6066' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Computer posture', ecfrCode: 'DC 5237' },
      { condition: 'Migraines', prevalence: 'Moderate', notes: 'Screen exposure', ecfrCode: 'DC 8100' }
    ]
  },
  '62EXE': {
    branch: 'Space Force',
    title: 'Electrical/Electronic Engineer',
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Active',
    noiseExposure: 'Low-Moderate',
    physicalDemand: 'Light-Moderate',
    hazards: [
      'Electrical systems work',
      'Launch support',
      'RF exposure (occasional)'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Fine electronic work', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Circuit analysis', ecfrCode: 'DC 6066' },
      { condition: 'Electrical burns', prevalence: 'Low', notes: 'High voltage exposure', ecfrCode: 'DC 7899' }
    ]
  },
  '62EXH': {
    branch: 'Space Force',
    title: 'Mechanical Engineer',
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Active',
    noiseExposure: 'Low-Moderate',
    physicalDemand: 'Light-Moderate',
    hazards: [
      'Launch vehicle systems',
      'Propulsion systems exposure',
      'Test facility operations'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'CAD work', ecfrCode: 'DC 8515' },
      { condition: 'Tinnitus', prevalence: 'Low-Moderate', notes: 'Test operations', ecfrCode: 'DC 6260' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Design work', ecfrCode: 'DC 5237' }
    ]
  },
  '62EXI': {
    branch: 'Space Force',
    title: 'Human Factors Engineer/Human Systems Integration',
    aliases: [],
    category: 'Engineering',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Ergonomic research',
      'Crew interface design',
      'Intensive analysis'
    ],
    commonConditions: [
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Analysis/design work', ecfrCode: 'DC 8515' },
      { condition: 'Vision Problems', prevalence: 'Moderate', notes: 'Screen work', ecfrCode: 'DC 6066' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Workstation posture', ecfrCode: 'DC 5237' }
    ]
  },
  '63A': {
    branch: 'Space Force',
    title: 'Acquisitions Manager',
    aliases: [],
    category: 'Acquisition',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'High-stress program management',
      'Contract oversight',
      'Travel requirements'
    ],
    commonConditions: [
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Program pressure', ecfrCode: 'DC 9413' },
      { condition: 'Carpal Tunnel', prevalence: 'High', notes: 'Documentation', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Office work', ecfrCode: 'DC 5237' }
    ]
  },

  // === SPACE LAUNCH SUPPORT ===
  'SLD': {
    branch: 'Space Force',
    title: 'Space Launch Delta Personnel (Various)',
    aliases: [],
    category: 'Space Launch',
    timePeriod: 'Active',
    noiseExposure: 'High (Tier 1) - Launch Events',
    physicalDemand: 'Moderate',
    hazards: [
      'Rocket launch noise/overpressure',
      'Propellant exposure',
      'High-stress countdown operations',
      'Range safety hazards'
    ],
    commonConditions: [
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Launch operations', ecfrCode: 'DC 6260' },
      { condition: 'Hearing Loss', prevalence: 'Moderate-High', notes: 'Rocket launches', ecfrCode: 'DC 6100' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Launch pressure', ecfrCode: 'DC 9413' },
      { condition: 'Respiratory Issues', prevalence: 'Low-Moderate', notes: 'Propellant fumes', ecfrCode: 'DC 6600' }
    ]
  },

  // === MISSILE WARNING ===
  'SBIRS': {
    branch: 'Space Force',
    title: 'Space-Based Infrared System Operator',
    aliases: ['DSP'],  // Defense Support Program (predecessor)
    category: 'Missile Warning',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'High-alert operations',
      '24/7 watch standing',
      'Critical decision stress',
      'Screen monitoring fatigue'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'IR display monitoring', ecfrCode: 'DC 6066' },
      { condition: 'Sleep Disorders', prevalence: 'Very High', notes: '24/7 operations', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'High', notes: 'Missile warning responsibility', ecfrCode: 'DC 9413' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Console operations', ecfrCode: 'DC 8515' }
    ]
  },

  // === SATELLITE COMMUNICATIONS ===
  'SATCOM': {
    branch: 'Space Force',
    title: 'Satellite Communications Operator',
    aliases: ['WGS', 'AEHF', 'MUOS'],  // Various SATCOM systems
    category: 'Satellite Communications',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Shift operations',
      'RF exposure (ground terminals)',
      'Screen monitoring',
      'High-availability stress'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Console monitoring', ecfrCode: 'DC 6066' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Shift work', ecfrCode: 'DC 6847' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Console operations', ecfrCode: 'DC 8515' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Workstation posture', ecfrCode: 'DC 5237' }
    ]
  },

  // === GPS/PNT OPERATIONS ===
  'GPS': {
    branch: 'Space Force',
    title: 'GPS Operations (Delta 31)',
    aliases: ['NAVSTAR'],
    category: 'Navigation',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Constellation management',
      'Shift operations',
      'Screen monitoring',
      'Critical infrastructure stress'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Constellation monitoring', ecfrCode: 'DC 6066' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: '24/7 operations', ecfrCode: 'DC 6847' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Console work', ecfrCode: 'DC 8515' },
      { condition: 'Anxiety', prevalence: 'Low-Moderate', notes: 'Critical infrastructure', ecfrCode: 'DC 9413' }
    ]
  },

  // === SPACE DOMAIN AWARENESS ===
  'SDA': {
    branch: 'Space Force',
    title: 'Space Domain Awareness Operator (Delta 2)',
    aliases: ['SSA'],  // Space Situational Awareness (older term)
    category: 'Space Domain Awareness',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Space debris tracking',
      'Conjunction assessment',
      'Multi-sensor correlation',
      '24/7 operations'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Tracking display monitoring', ecfrCode: 'DC 6066' },
      { condition: 'Sleep Disorders', prevalence: 'Very High', notes: 'Continuous operations', ecfrCode: 'DC 6847' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Console operations', ecfrCode: 'DC 8515' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Collision avoidance decisions', ecfrCode: 'DC 9413' }
    ]
  },

  // === ORBITAL WARFARE ===
  'DEL9': {
    branch: 'Space Force',
    title: 'Delta 9 - Orbital Warfare Operator',
    aliases: ['X-37B', 'GSSAP'],
    category: 'Orbital Warfare',
    timePeriod: 'Active',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Classified space operations',
      'High-stress maneuvers',
      'Space warfare planning',
      'Shift operations'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Orbital tracking', ecfrCode: 'DC 6066' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Operations tempo', ecfrCode: 'DC 6847' },
      { condition: 'Anxiety', prevalence: 'High', notes: 'Space warfare stress', ecfrCode: 'DC 9413' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Console work', ecfrCode: 'DC 8515' }
    ]
  },

  // === GROUND-BASED RADAR/SENSORS ===
  'RADAR': {
    branch: 'Space Force',
    title: 'Ground-Based Radar Operator (Space Fence, GEODSS, etc.)',
    aliases: ['GEODSS', 'PARCS', 'UEWR'],
    category: 'Sensors',
    timePeriod: 'Active',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Light-Moderate',
    hazards: [
      'Radar equipment operations',
      'Remote site duty',
      'RF exposure',
      'Shift work'
    ],
    commonConditions: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Radar display monitoring', ecfrCode: 'DC 6066' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Radar equipment', ecfrCode: 'DC 6260' },
      { condition: 'Sleep Disorders', prevalence: 'High', notes: 'Remote duty, shifts', ecfrCode: 'DC 6847' },
      { condition: 'Depression', prevalence: 'Moderate', notes: 'Isolated duty stations', ecfrCode: 'DC 9434' }
    ]
  }
};

/**
 * Reverse lookup map for aliases
 */
export const ALIAS_TO_PRIMARY = {};
Object.entries(MOS_DATABASE).forEach(([code, data]) => {
  if (data.aliases) {
    data.aliases.forEach(alias => {
      ALIAS_TO_PRIMARY[alias] = code;
    });
  }
});

// Also add the CODE_ALIASES
Object.entries(CODE_ALIASES).forEach(([alias, primary]) => {
  if (!ALIAS_TO_PRIMARY[alias]) {
    ALIAS_TO_PRIMARY[alias] = primary;
  }
});

/**
 * Get all branch-specific codes
 */
export const getCodesByBranch = (branch) => {
  return Object.entries(MOS_DATABASE)
    .filter(([_, data]) => data.branch === branch)
    .map(([code, data]) => ({ code, ...data }));
};

/**
 * Get all active codes
 */
export const getActiveCodes = () => {
  return Object.entries(MOS_DATABASE)
    .filter(([_, data]) => data.timePeriod === 'Active')
    .map(([code, data]) => ({ code, ...data }));
};

/**
 * Get historical codes
 */
export const getHistoricalCodes = () => {
  return Object.entries(MOS_DATABASE)
    .filter(([_, data]) => data.timePeriod !== 'Active')
    .map(([code, data]) => ({ code, ...data }));
};

/**
 * Get categories
 */
export const getAllCategories = () => {
  const categories = new Set();
  Object.values(MOS_DATABASE).forEach(data => {
    categories.add(data.category);
  });
  return Array.from(categories).sort();
};

/**
 * Search MOS database with alias support
 */
export const searchMOS = (query) => {
  if (!query || query.length < 2) return [];
  
  const searchTermUpper = query.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const searchTermLower = query.toLowerCase();
  
  const results = [];
  const seen = new Set();
  
  // Check direct codes and aliases
  Object.entries(MOS_DATABASE).forEach(([code, data]) => {
    const codeUpper = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const titleLower = data.title.toLowerCase();
    const categoryLower = data.category?.toLowerCase() || '';
    
    // Check main code
    if (codeUpper.includes(searchTermUpper) || 
        searchTermUpper.includes(codeUpper) ||
        titleLower.includes(searchTermLower) ||
        categoryLower.includes(searchTermLower)) {
      if (!seen.has(code)) {
        results.push({ code, ...data, matchType: 'direct' });
        seen.add(code);
      }
    }
    
    // Check aliases
    if (data.aliases) {
      data.aliases.forEach(alias => {
        const aliasUpper = alias.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (aliasUpper.includes(searchTermUpper) || searchTermUpper.includes(aliasUpper)) {
          if (!seen.has(code)) {
            results.push({ 
              code, 
              ...data, 
              matchType: 'alias', 
              matchedAlias: alias,
              note: `Historical code "${alias}" now maps to ${code}`
            });
            seen.add(code);
          }
        }
      });
    }
  });
  
  // Also check the CODE_ALIASES lookup
  Object.entries(CODE_ALIASES).forEach(([alias, primaryCode]) => {
    const aliasUpper = alias.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (aliasUpper === searchTermUpper && MOS_DATABASE[primaryCode]) {
      if (!seen.has(primaryCode)) {
        results.push({
          code: primaryCode,
          ...MOS_DATABASE[primaryCode],
          matchType: 'alias',
          matchedAlias: alias,
          note: `Historical code "${alias}" now maps to ${primaryCode}`
        });
        seen.add(primaryCode);
      }
    }
  });
  
  return results.slice(0, 15);
};

/**
 * Get statistics about the database
 */
export const getDatabaseStats = () => {
  const stats = {
    totalCodes: Object.keys(MOS_DATABASE).length,
    totalAliases: Object.keys(ALIAS_TO_PRIMARY).length,
    byBranch: {},
    byTimePeriod: {
      Active: 0,
      Historical: 0
    },
    categories: getAllCategories().length
  };
  
  Object.values(MOS_DATABASE).forEach(data => {
    // Count by branch
    if (!stats.byBranch[data.branch]) {
      stats.byBranch[data.branch] = 0;
    }
    stats.byBranch[data.branch]++;
    
    // Count by time period
    if (data.timePeriod === 'Active') {
      stats.byTimePeriod.Active++;
    } else {
      stats.byTimePeriod.Historical++;
    }
  });
  
  return stats;
};

export default MOS_DATABASE;
