/**
 * Vet-Rate.org - MOS Hazard Matcher
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "It feels like the app KNOWS your military life"
 * 
 * Enter your MOS/AFSC/Rate and instantly get:
 * - Common injuries for that specific job
 * - Noise exposure level
 * - Hazard profile
 * - Direct links to add conditions to your claim
 * 
 * Database includes:
 * - Modern codes (Army MOS, Air Force AFSC, Navy Ratings, Marine MOS, Coast Guard Ratings)
 * - Historical codes with aliases (for older veterans)
 * - Data from O*NET, DoD COOL, Naval History, DA PAM 611-21
 */

import React, { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import BuyMeCoffee from './BuyMeCoffee';
import { MOS_DATABASE, searchMOS as searchMOSFromDB, getDatabaseStats, CODE_ALIASES } from '../data/mosDatabase';
import ReportBugLink from './ReportBugLink';

/**
 * Legacy MOS Database (for backwards compatibility)
 * New comprehensive database is in ../data/mosDatabase.js
 */
const LEGACY_MOS_DATABASE = {
  // ================== ARMY MOS ==================
  '11B': {
    branch: 'Army',
    title: 'Infantryman',
    category: 'Combat Arms',
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
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Weapons fire, explosions' },
      { condition: 'Bilateral Hearing Loss', prevalence: 'Very High', notes: 'Chronic noise exposure' },
      { condition: 'Lumbar Strain / DDD', prevalence: 'Very High', notes: 'Heavy load bearing' },
      { condition: 'Bilateral Knee Strain', prevalence: 'High', notes: 'Ruck marching, terrain' },
      { condition: 'Ankle Injuries', prevalence: 'High', notes: 'Uneven terrain, jumps' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat exposure' },
      { condition: 'TBI', prevalence: 'Moderate', notes: 'Blast exposure' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Helmet weight, posture' },
      { condition: 'Pes Planus (Flat Feet)', prevalence: 'Moderate', notes: 'Prolonged standing/marching' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Ruck straps, weapons carry' }
    ]
  },
  '11C': {
    branch: 'Army',
    title: 'Indirect Fire Infantryman (Mortarman)',
    category: 'Combat Arms',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Mortar fire concussive blasts',
      'Heavy equipment lifting (mortar tubes, baseplates)',
      'Repetitive firing motions',
      'Burn injuries from hot tubes'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Mortar blast concussion' },
      { condition: 'Bilateral Hearing Loss', prevalence: 'Extreme', notes: 'Repeated mortar fire' },
      { condition: 'TBI', prevalence: 'High', notes: 'Blast overpressure' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Carrying mortar equipment' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Repetitive lifting' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat stress' }
    ]
  },
  '13B': {
    branch: 'Army',
    title: 'Cannon Crewmember (Artillery)',
    category: 'Combat Arms',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Artillery fire blast overpressure',
      'Heavy ammunition handling (90+ lb rounds)',
      'Repetitive loading motions',
      'Cordite/propellant exposure'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Howitzer fire' },
      { condition: 'Bilateral Hearing Loss', prevalence: 'Extreme', notes: 'Artillery blasts' },
      { condition: 'Lumbar Strain / Herniated Disc', prevalence: 'Very High', notes: 'Heavy round lifting' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Repetitive loading' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling positions' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Propellant fumes' }
    ]
  },
  '19D': {
    branch: 'Army',
    title: 'Cavalry Scout',
    category: 'Combat Arms',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Vehicle operations (Bradley, Stryker)',
      'Weapons fire exposure',
      'Reconnaissance in hostile territory',
      'Dismounted operations'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Weapons, vehicle noise' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Armored vehicle noise' },
      { condition: 'Back Pain', prevalence: 'High', notes: 'Vehicle vibration, dismounts' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Mounting/dismounting vehicles' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat reconnaissance' },
      { condition: 'TBI', prevalence: 'Moderate', notes: 'IED exposure' }
    ]
  },
  '68W': {
    branch: 'Army',
    title: 'Combat Medic / Healthcare Specialist',
    category: 'Medical',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Patient lifting and carrying',
      'Combat zone operations',
      'Bloodborne pathogen exposure',
      'Psychological trauma from casualties',
      'Sleep deprivation'
    ],
    commonInjuries: [
      { condition: 'PTSD', prevalence: 'Very High', notes: 'Treating combat casualties' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Patient lifting' },
      { condition: 'Secondary PTSD / MST', prevalence: 'High', notes: 'Trauma exposure' },
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Combat environment' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Kneeling for treatment' },
      { condition: 'Sleep Apnea', prevalence: 'Moderate', notes: 'Irregular schedules' }
    ]
  },
  '88M': {
    branch: 'Army',
    title: 'Motor Transport Operator (Truck Driver)',
    category: 'Logistics',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Long-haul driving (convoy operations)',
      'Vehicle vibration exposure',
      'Loading/unloading cargo',
      'IED/ambush exposure in combat zones',
      'Sleep deprivation'
    ],
    commonInjuries: [
      { condition: 'Lumbar Strain / DDD', prevalence: 'Very High', notes: 'Prolonged sitting, vibration' },
      { condition: 'Hemorrhoids', prevalence: 'High', notes: 'Extended sitting' },
      { condition: 'Hearing Loss', prevalence: 'High', notes: 'Engine noise' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Climbing in/out of vehicles' },
      { condition: 'Sleep Apnea', prevalence: 'Moderate', notes: 'Irregular schedules, weight gain' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Convoy attacks (if deployed)' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Whiplash, road conditions' }
    ]
  },
  '91B': {
    branch: 'Army',
    title: 'Wheeled Vehicle Mechanic',
    category: 'Maintenance',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy lifting (tires, parts)',
      'Awkward positions under vehicles',
      'Chemical/solvent exposure',
      'Hand/finger injuries',
      'Heat/burn exposure'
    ],
    commonInjuries: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Lifting, bending' },
      { condition: 'Carpal Tunnel Syndrome', prevalence: 'High', notes: 'Repetitive tool use' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Overhead work' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Power tools, engines' },
      { condition: 'Skin Conditions', prevalence: 'Moderate', notes: 'Chemical exposure' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Kneeling on hard surfaces' }
    ]
  },
  '92Y': {
    branch: 'Army',
    title: 'Unit Supply Specialist',
    category: 'Logistics',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Heavy',
    hazards: [
      'Heavy lifting (supplies, equipment)',
      'Warehouse operations',
      'Forklift operations',
      'Repetitive motion',
      'Hazardous material handling'
    ],
    commonInjuries: [
      { condition: 'Lumbar Strain / Herniated Disc', prevalence: 'Very High', notes: 'Heavy lifting' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Repetitive lifting overhead' },
      { condition: 'Carpal Tunnel', prevalence: 'Moderate', notes: 'Inventory management' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Squatting, kneeling' },
      { condition: 'Respiratory Issues', prevalence: 'Low', notes: 'Dust, HAZMAT exposure' }
    ]
  },
  '25B': {
    branch: 'Army',
    title: 'Information Technology Specialist',
    category: 'Signal/Comms',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged sitting/computer use',
      'Cable running (heavy lifting)',
      'Server room environments',
      'Eye strain'
    ],
    commonInjuries: [
      { condition: 'Carpal Tunnel Syndrome', prevalence: 'High', notes: 'Keyboard/mouse use' },
      { condition: 'Cervical Strain', prevalence: 'High', notes: 'Computer posture' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Prolonged sitting' },
      { condition: 'Migraine/Headaches', prevalence: 'Moderate', notes: 'Screen time' },
      { condition: 'Eye Strain/Vision Issues', prevalence: 'Moderate', notes: 'Screen exposure' }
    ]
  },
  '42A': {
    branch: 'Army',
    title: 'Human Resources Specialist',
    category: 'Administration',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Prolonged sitting',
      'Repetitive typing',
      'High stress (personnel issues)',
      'Irregular hours during deployments'
    ],
    commonInjuries: [
      { condition: 'Carpal Tunnel Syndrome', prevalence: 'High', notes: 'Typing' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Sitting' },
      { condition: 'Cervical Strain', prevalence: 'Moderate', notes: 'Computer posture' },
      { condition: 'Anxiety/Depression', prevalence: 'Moderate', notes: 'Administrative stress' },
      { condition: 'Migraine', prevalence: 'Low', notes: 'Stress, screen time' }
    ]
  },
  
  // ================== AIR FORCE AFSC ==================
  '1A1X1': {
    branch: 'Air Force',
    title: 'Flight Engineer',
    category: 'Aircrew',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Moderate',
    hazards: [
      'Aircraft engine noise',
      'Cabin pressure changes',
      'Vibration exposure',
      'Sleep disruption (missions)',
      'Chemical exposure (fuels, hydraulics)'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Aircraft noise' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Engine exposure' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Vibration, seating' },
      { condition: 'Sleep Apnea', prevalence: 'High', notes: 'Irregular schedules' },
      { condition: 'Sinus Issues', prevalence: 'Moderate', notes: 'Pressure changes' }
    ]
  },
  '2A3X3': {
    branch: 'Air Force',
    title: 'Tactical Aircraft Maintenance',
    category: 'Maintenance',
    noiseExposure: 'Very High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Jet engine noise exposure',
      'Chemical/fuel exposure',
      'Working on elevated platforms',
      'Extreme temperatures (flightline)',
      'Heavy component lifting'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Jet engine runups' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Chronic jet noise' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Awkward positions' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Overhead work' },
      { condition: 'Skin Conditions', prevalence: 'Moderate', notes: 'Chemical exposure' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Fuel fumes, exhaust' }
    ]
  },
  '3E7X1': {
    branch: 'Air Force',
    title: 'Fire Protection (Firefighter)',
    category: 'Emergency Services',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Smoke/toxic fume inhalation',
      'Burn injuries',
      'Heavy equipment carrying',
      'Heat stress',
      'PTSD from casualties'
    ],
    commonInjuries: [
      { condition: 'Respiratory Disease/COPD', prevalence: 'Very High', notes: 'Smoke inhalation' },
      { condition: 'Cancer (various types)', prevalence: 'High', notes: 'Carcinogen exposure - PACT Act' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment weight' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Crawling, kneeling' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Traumatic incidents' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Sirens, equipment' }
    ]
  },
  '3P0X1': {
    branch: 'Air Force',
    title: 'Security Forces',
    category: 'Security',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Weapons qualification firing',
      'Body armor wear (extended periods)',
      'Patrol duties (walking/standing)',
      'Shift work',
      'Hostile encounters'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'High', notes: 'Weapons fire' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Body armor, duty belt' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Patrol duties' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'If deployed/hostile contact' },
      { condition: 'Plantar Fasciitis', prevalence: 'Moderate', notes: 'Standing/walking' }
    ]
  },
  
  // ================== NAVY RATES ==================
  'BM': {
    branch: 'Navy',
    title: 'Boatswain\'s Mate',
    category: 'Deck',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Heavy deck equipment handling',
      'Working over water',
      'Exposure to weather',
      'Line handling (rope burns)',
      'Crane operations'
    ],
    commonInjuries: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Heavy lifting, deck work' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Line handling' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Ladder climbing' },
      { condition: 'Hand/Finger Injuries', prevalence: 'High', notes: 'Line/cable work' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Ship machinery' }
    ]
  },
  'GM': {
    branch: 'Navy',
    title: 'Gunner\'s Mate',
    category: 'Weapons',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Heavy',
    hazards: [
      'Naval gunfire operations',
      'Ammunition handling',
      'Weapons maintenance',
      'Confined spaces',
      'Chemical propellant exposure'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Naval gunfire' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Weapons firing' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Ammo handling' },
      { condition: 'Respiratory Issues', prevalence: 'Moderate', notes: 'Propellant fumes' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Repetitive lifting' }
    ]
  },
  'HM': {
    branch: 'Navy',
    title: 'Hospital Corpsman',
    category: 'Medical',
    noiseExposure: 'Variable',
    physicalDemand: 'Heavy',
    hazards: [
      'Patient lifting',
      'Bloodborne pathogen exposure',
      'Combat operations (with Marines)',
      'Long shifts',
      'Psychological trauma'
    ],
    commonInjuries: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Patient handling' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat/trauma exposure' },
      { condition: 'Needlestick Injuries', prevalence: 'Moderate', notes: 'Medical procedures' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Shift work' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'If attached to Marines' }
    ]
  },
  'MM': {
    branch: 'Navy',
    title: 'Machinist\'s Mate',
    category: 'Engineering',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Engine room noise',
      'High heat environments',
      'Steam/hot surface burns',
      'Asbestos exposure (older ships)',
      'Heavy machinery operation'
    ],
    commonInjuries: [
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Engine room noise' },
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Machinery noise' },
      { condition: 'Respiratory Issues/Asbestosis', prevalence: 'High', notes: 'Older ship insulation' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Steam/hot surfaces' },
      { condition: 'Lumbar Strain', prevalence: 'Moderate', notes: 'Equipment maintenance' }
    ]
  },
  'OS': {
    branch: 'Navy',
    title: 'Operations Specialist',
    category: 'Operations',
    noiseExposure: 'Low (Tier 3)',
    physicalDemand: 'Light',
    hazards: [
      'Radar/electronics exposure',
      'Prolonged standing (watch)',
      'Shift work',
      'Screen eye strain',
      'High-stress combat situations'
    ],
    commonInjuries: [
      { condition: 'Vision Problems', prevalence: 'High', notes: 'Radar screen watching' },
      { condition: 'Lumbar/Cervical Strain', prevalence: 'Moderate', notes: 'Standing watch' },
      { condition: 'Sleep Disorders', prevalence: 'Moderate', notes: 'Watch rotation' },
      { condition: 'Anxiety', prevalence: 'Moderate', notes: 'Combat information stress' },
      { condition: 'Plantar Fasciitis', prevalence: 'Moderate', notes: 'Standing on steel decks' }
    ]
  },
  
  // ================== MARINE CORPS MOS ==================
  '0311': {
    branch: 'Marines',
    title: 'Rifleman',
    category: 'Infantry',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Extreme',
    hazards: [
      'Heavy combat loads (100+ lbs)',
      'Weapons fire exposure',
      'Explosive breaching',
      'Extreme physical conditioning',
      'Combat stress'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Weapons, explosives' },
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Combat noise' },
      { condition: 'Lumbar Strain / DDD', prevalence: 'Very High', notes: 'Heavy pack loads' },
      { condition: 'Bilateral Knee Injuries', prevalence: 'Very High', notes: 'Running, hiking' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat exposure' },
      { condition: 'TBI', prevalence: 'Moderate', notes: 'Blast exposure' },
      { condition: 'Ankle Injuries', prevalence: 'High', notes: 'Terrain, boots' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Ruck/weapons carrying' }
    ]
  },
  '0331': {
    branch: 'Marines',
    title: 'Machine Gunner',
    category: 'Infantry',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Extreme',
    hazards: [
      'Carrying heavy weapon systems (M240, .50 cal)',
      'Extreme sustained noise',
      'Combat stress',
      'Heavy ammunition loads'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Machine gun fire' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Sustained automatic fire' },
      { condition: 'Lumbar/Cervical Strain', prevalence: 'Extreme', notes: 'Weapon weight' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Recoil, carrying' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Combat' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Kneeling/prone positions' }
    ]
  },
  '0811': {
    branch: 'Marines',
    title: 'Field Artillery Cannoneer',
    category: 'Artillery',
    noiseExposure: 'Extreme (Tier 1+)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Howitzer blast overpressure',
      'Heavy round handling',
      'Propellant exposure',
      'Heat/cold extremes'
    ],
    commonInjuries: [
      { condition: 'Tinnitus', prevalence: 'Extreme', notes: 'Artillery fire' },
      { condition: 'Hearing Loss', prevalence: 'Extreme', notes: 'Blast exposure' },
      { condition: 'TBI', prevalence: 'High', notes: 'Repeated blast overpressure' },
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Round lifting' },
      { condition: 'Shoulder Injuries', prevalence: 'High', notes: 'Loading operations' }
    ]
  },
  '3531': {
    branch: 'Marines',
    title: 'Motor Vehicle Operator',
    category: 'Logistics',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Long convoy operations',
      'IED exposure',
      'Vehicle vibration',
      'Cargo handling',
      'Fatigue/sleep deprivation'
    ],
    commonInjuries: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Vibration, sitting' },
      { condition: 'PTSD', prevalence: 'High', notes: 'Convoy attacks' },
      { condition: 'TBI', prevalence: 'Moderate', notes: 'IED blasts' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Climbing in/out' },
      { condition: 'Hearing Loss', prevalence: 'Moderate', notes: 'Engine noise' },
      { condition: 'Sleep Apnea', prevalence: 'Moderate', notes: 'Irregular schedules' }
    ]
  },
  
  // ================== COAST GUARD ==================
  'BM_CG': {
    branch: 'Coast Guard',
    title: 'Boatswain\'s Mate',
    category: 'Deck',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Very Heavy',
    hazards: [
      'Search and rescue operations',
      'Heavy seas/weather exposure',
      'Line handling',
      'Working over water',
      'Trauma exposure (rescues/recoveries)'
    ],
    commonInjuries: [
      { condition: 'Lumbar Strain', prevalence: 'Very High', notes: 'Deck work' },
      { condition: 'Shoulder Injuries', prevalence: 'Very High', notes: 'Line handling' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'SAR operations, body recovery' },
      { condition: 'Knee Injuries', prevalence: 'High', notes: 'Deck movement' },
      { condition: 'Cold Injuries', prevalence: 'Moderate', notes: 'Weather exposure' }
    ]
  },
  'ME': {
    branch: 'Coast Guard',
    title: 'Maritime Enforcement Specialist',
    category: 'Law Enforcement',
    noiseExposure: 'Moderate (Tier 2)',
    physicalDemand: 'Heavy',
    hazards: [
      'Boarding operations',
      'Weapons qualifications',
      'Body armor wear',
      'Hostile encounters',
      'Small boat operations'
    ],
    commonInjuries: [
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Body armor, duty belt' },
      { condition: 'Tinnitus', prevalence: 'Moderate', notes: 'Weapons fire' },
      { condition: 'Knee Injuries', prevalence: 'Moderate', notes: 'Boarding operations' },
      { condition: 'Shoulder Injuries', prevalence: 'Moderate', notes: 'Equipment carry' },
      { condition: 'PTSD', prevalence: 'Moderate', notes: 'Law enforcement stress' }
    ]
  },
  'MK': {
    branch: 'Coast Guard',
    title: 'Machinery Technician',
    category: 'Engineering',
    noiseExposure: 'High (Tier 1)',
    physicalDemand: 'Heavy',
    hazards: [
      'Engine room operations',
      'Diesel fume exposure',
      'Hot machinery',
      'Confined spaces',
      'Chemical exposure'
    ],
    commonInjuries: [
      { condition: 'Hearing Loss', prevalence: 'Very High', notes: 'Engine noise' },
      { condition: 'Tinnitus', prevalence: 'Very High', notes: 'Machinery' },
      { condition: 'Respiratory Issues', prevalence: 'High', notes: 'Fumes' },
      { condition: 'Lumbar Strain', prevalence: 'High', notes: 'Equipment work' },
      { condition: 'Burns', prevalence: 'Moderate', notes: 'Hot machinery' }
    ]
  }
};

/**
 * Enhanced search combining new comprehensive database with legacy data
 * Supports historical code aliases for older veterans
 */
const searchMOS = (query) => {
  if (!query || query.length < 2) return [];
  
  // First, search the new comprehensive database
  const newDBResults = searchMOSFromDB(query);
  
  // Then search legacy database for any codes not in new DB
  const searchTermLower = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  const legacyResults = Object.entries(LEGACY_MOS_DATABASE)
    .filter(([code, data]) => {
      const codeLower = code.toLowerCase().replace(/[^a-z0-9]/g, '');
      const titleLower = data.title.toLowerCase();
      return codeLower.includes(searchTermLower) || 
             searchTermLower.includes(codeLower) ||
             titleLower.includes(searchTermLower);
    })
    .map(([code, data]) => ({ code, ...data, source: 'legacy' }));
  
  // Merge results, preferring new DB entries
  const seenCodes = new Set(newDBResults.map(r => r.code));
  const mergedResults = [
    ...newDBResults.map(r => ({
      ...r,
      // Normalize field names: commonConditions -> commonInjuries for UI compatibility
      commonInjuries: r.commonConditions || r.commonInjuries
    })),
    ...legacyResults.filter(r => !seenCodes.has(r.code))
  ];
  
  return mergedResults.slice(0, 15);
};

/**
 * Get noise level color
 */
const getNoiseColor = (level) => {
  if (!level) return 'bg-gray-500 text-white';
  if (level.includes('Extreme')) return 'bg-red-600 text-white';
  if (level.includes('Very High')) return 'bg-orange-500 text-white';
  if (level.includes('High')) return 'bg-yellow-500 text-black';
  if (level.includes('Moderate')) return 'bg-blue-500 text-white';
  return 'bg-green-500 text-white';
};

/**
 * Get prevalence color
 */
const getPrevalenceColor = (prevalence) => {
  if (prevalence === 'Extreme') return 'text-red-400';
  if (prevalence === 'Very High') return 'text-orange-400';
  if (prevalence === 'High') return 'text-yellow-400';
  if (prevalence === 'Moderate') return 'text-blue-400';
  return 'text-gray-400';
};

export default function MOSHazardMatcher({ onClose, onAddToPathfinder, onReportBug }) {
  const { t } = useLanguage();
  useBodyScrollLock(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMOS, setSelectedMOS] = useState(null);
  const [selectedConditions, setSelectedConditions] = useState([]);
  
  // Search results
  const searchResults = useMemo(() => searchMOS(searchQuery), [searchQuery]);
  
  // Toggle condition selection
  const toggleCondition = (condition) => {
    setSelectedConditions(prev => 
      prev.includes(condition)
        ? prev.filter(c => c !== condition)
        : [...prev, condition]
    );
  };
  
  // Get branch color
  const getBranchColor = (branch) => {
    switch (branch) {
      case 'Army': return 'from-green-700 to-green-900';
      case 'Air Force': return 'from-blue-600 to-blue-900';
      case 'Navy': return 'from-blue-800 to-indigo-900';
      case 'Marines': return 'from-red-700 to-red-900';
      case 'Coast Guard': return 'from-orange-600 to-orange-800';
      default: return 'from-gray-600 to-gray-800';
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mos-hazard-matcher-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-500 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">🎖️</span>
                </div>
                <div>
                  <h2 id="mos-hazard-matcher-title" className="text-2xl sm:text-3xl font-bold text-black">
                    MOS Hazard Matcher <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded align-middle">BETA</span>
                  </h2>
                  <p className="text-yellow-800 text-sm sm:text-base mt-1">
                    Your Job → Your Injuries
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-black hover:bg-black/10 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6 bg-gray-900">
            {/* Intro */}
            <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/30 rounded-2xl p-6 border border-slate-600/50">
              <p className="text-slate-200 text-center">
                <span className="text-2xl mr-2">💡</span>
                <strong>You aren't weak.</strong> You did a job that breaks bodies. Here's the proof.
              </p>
            </div>
            
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedMOS(null);
                }}
                placeholder="Enter your MOS code (e.g., 11B, 68W, GM, 0311...)"
                className="w-full p-4 pl-12 bg-gray-800 border-2 border-slate-600 rounded-xl text-white text-lg placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
            </div>
            
            {/* Search Results Dropdown */}
            {searchQuery && !selectedMOS && searchResults.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-slate-600 overflow-hidden">
                {searchResults.map(result => (
                  <button
                    key={result.code}
                    onClick={() => {
                      setSelectedMOS(result);
                      setSearchQuery(result.code);
                    }}
                    className="w-full p-4 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-amber-400">{result.code}</span>
                        <span className="text-white ml-2">{result.title}</span>
                        {result.matchType === 'alias' && result.matchedAlias && (
                          <span className="ml-2 text-xs text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded">
                            🕐 Was: {result.matchedAlias}
                          </span>
                        )}
                        {result.timePeriod && result.timePeriod !== 'Active' && (
                          <span className="ml-2 text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded">
                            Historical
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${getBranchColor(result.branch)}`}>
                        {result.branch}
                      </span>
                    </div>
                    {result.note && (
                      <p className="text-xs text-gray-400 mt-1">{result.note}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {/* No Results */}
            {searchQuery && !selectedMOS && searchResults.length === 0 && (
              <div className="bg-gray-800/50 rounded-xl p-6 text-center">
                <p className="text-gray-400">No matching MOS found. Try a different code or job title.</p>
                <p className="text-gray-500 text-sm mt-2">
                  <strong>Modern:</strong> 11B, 68W, 88M (Army) | 2A3X3, 3P0X1 (Air Force) | GM, HM, BM (Navy) | 0311, 0331 (Marines)
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  <strong>Historical:</strong> 91B, 63B (Army) | SK, BT (Navy) | 81130 (Air Force)
                </p>
                <p className="text-cyan-400/70 text-xs mt-2">
                  💡 We support historical codes that have been merged or renamed!
                </p>
              </div>
            )}
            
            {/* Selected MOS Details */}
            {selectedMOS && (
              <div className="space-y-6">
                {/* MOS Header Card */}
                <div className={`bg-gradient-to-r ${getBranchColor(selectedMOS.branch)} rounded-2xl p-6 shadow-xl`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white/70 text-sm">{selectedMOS.branch} • {selectedMOS.category}</p>
                      <h3 className="text-3xl font-black text-white">{selectedMOS.code}</h3>
                      <p className="text-xl text-white/90">{selectedMOS.title}</p>
                      {/* Historical aliases */}
                      {selectedMOS.aliases && selectedMOS.aliases.length > 0 && (
                        <p className="text-white/60 text-sm mt-2">
                          🕐 Also known as: {selectedMOS.aliases.join(', ')}
                        </p>
                      )}
                      {selectedMOS.historicalNotes && (
                        <p className="text-cyan-300/80 text-xs mt-1">
                          📜 {selectedMOS.historicalNotes}
                        </p>
                      )}
                      {selectedMOS.matchedAlias && (
                        <p className="text-cyan-300 text-sm mt-2 bg-cyan-900/30 px-2 py-1 rounded inline-block">
                          ✓ You searched for "{selectedMOS.matchedAlias}" - this is the current designation
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getNoiseColor(selectedMOS.noiseExposure)}`}>
                        🔊 {selectedMOS.noiseExposure || 'Varies'}
                      </span>
                      <p className="text-white/70 text-sm mt-2">
                        Physical: {selectedMOS.physicalDemand || 'Varies'}
                      </p>
                      {selectedMOS.timePeriod && selectedMOS.timePeriod !== 'Active' && (
                        <span className="mt-2 inline-block px-2 py-1 bg-amber-700/50 text-amber-200 rounded text-xs">
                          {selectedMOS.timePeriod}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Hazards */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-slate-700">
                  <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    ⚠️ Job Hazards
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(selectedMOS.hazards || []).map((hazard, i) => (
                      <span key={i} className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200 text-sm">
                        {hazard}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Common Injuries */}
                <div className="bg-gray-800/50 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="p-4 bg-slate-700/50 border-b border-slate-600">
                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                      🩺 Common Service-Connected Conditions
                    </h4>
                    <p className="text-sm text-slate-400">Click to add to your claim list</p>
                  </div>
                  <div className="divide-y divide-slate-700">
                    {selectedMOS.commonInjuries.map((injury, i) => (
                      <button
                        key={i}
                        onClick={() => toggleCondition(injury.condition)}
                        className={`w-full p-4 text-left transition-colors ${
                          selectedConditions.includes(injury.condition)
                            ? 'bg-green-900/30 border-l-4 border-green-500'
                            : 'hover:bg-slate-700/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xl ${selectedConditions.includes(injury.condition) ? 'text-green-400' : 'text-slate-500'}`}>
                              {selectedConditions.includes(injury.condition) ? '✓' : '○'}
                            </span>
                            <div>
                              <p className="font-semibold text-white">{injury.condition}</p>
                              <p className="text-sm text-slate-400">{injury.notes}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${getPrevalenceColor(injury.prevalence)}`}>
                            {injury.prevalence}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Selected Conditions Summary */}
                {selectedConditions.length > 0 && (
                  <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-6">
                    <h4 className="font-bold text-green-300 mb-3">
                      ✓ {selectedConditions.length} Conditions Selected
                    </h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedConditions.map(cond => (
                        <span key={cond} className="px-3 py-1 bg-green-800/50 text-green-200 rounded-lg text-sm">
                          {cond}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (onAddToPathfinder) {
                          onAddToPathfinder(selectedConditions);
                        }
                        onClose();
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                    >
                      📋 Add to My Claim List
                    </button>
                  </div>
                )}
                
                {/* Validation Message */}
                <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-6 text-center">
                  <p className="text-amber-200 text-lg">
                    <span className="text-2xl mr-2">💪</span>
                    <strong>{selectedMOS.title}s</strong> experience these conditions at rates 
                    far above the general population. <strong>Your service caused this.</strong>
                  </p>
                </div>
              </div>
            )}
            
            {/* Quick Browse by Branch */}
            {!selectedMOS && !searchQuery && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white text-center">Or browse by branch:</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['Army', 'Air Force', 'Navy', 'Marines', 'Coast Guard'].map(branch => (
                    <button
                      key={branch}
                      onClick={() => {
                        const first = Object.entries(MOS_DATABASE).find(([_, d]) => d.branch === branch);
                        if (first) {
                          setSelectedMOS({ code: first[0], ...first[1] });
                          setSearchQuery(first[0]);
                        }
                      }}
                      className={`p-4 rounded-xl font-bold text-white bg-gradient-to-r ${getBranchColor(branch)} hover:opacity-90 transition-opacity`}
                    >
                      {branch}
                    </button>
                  ))}
                </div>
                
                {/* Popular MOS Quick Links */}
                <div className="bg-gray-800/30 rounded-xl p-4 mt-6">
                  <p className="text-gray-400 text-sm text-center mb-3">Popular searches:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['11B', '68W', '88M', '0311', '3P0X1', 'HM', 'GM', 'BM'].map(code => (
                      <button
                        key={code}
                        onClick={() => {
                          setSearchQuery(code);
                          const results = searchMOS(code);
                          if (results.length > 0) setSelectedMOS(results[0]);
                        }}
                        className="px-3 py-1 bg-slate-700 text-slate-200 rounded-lg text-sm hover:bg-slate-600 transition-colors"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Historical Code Quick Links */}
                <div className="bg-cyan-900/20 rounded-xl p-4 mt-4 border border-cyan-700/30">
                  <p className="text-cyan-400 text-sm text-center mb-3">🕐 Historical/Retired codes (for older veterans):</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['91B', '63B', 'SK', 'BT', '81130', '76Y'].map(code => (
                      <button
                        key={code}
                        onClick={() => {
                          setSearchQuery(code);
                          const results = searchMOS(code);
                          if (results.length > 0) setSelectedMOS(results[0]);
                        }}
                        className="px-3 py-1 bg-cyan-800/50 text-cyan-200 rounded-lg text-sm hover:bg-cyan-700/50 transition-colors border border-cyan-700/50"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Support CTA when MOS is selected */}
            {selectedMOS && (
              <div className="bg-gradient-to-r from-slate-800/60 to-gray-800/60 rounded-2xl p-6 border border-slate-600/50 mt-6">
                <div className="flex items-center gap-4">
                  <img 
                    src="/images/Anth.jpg" 
                    alt="Anthony - Vet-Rate Developer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-slate-500 shadow-lg flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-slate-200 font-semibold mb-1">
                      🏅 This database took 200+ hours to research
                    </p>
                    <p className="text-slate-400 text-sm">
                      Every MOS, every hazard, every common injury - compiled from military studies, 
                      VA data, and veteran testimonies. Help add more job codes and keep this resource 
                      free for every veteran who needs to prove their service caused real damage.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* BuyMeCoffee - shows after selecting MOS */}
      <BuyMeCoffee 
        show={selectedMOS !== null} 
        trigger="mos-hazard" 
        context={{ mos: selectedMOS?.code ? `${selectedMOS.code} (${selectedMOS.title})` : null }}
      />
    </div>
  );
}
