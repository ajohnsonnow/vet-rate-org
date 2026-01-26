/**
 * Vet-Rate.org - Military Badges, Tabs, and Uniform Accoutrements
 * ================================================================
 * 
 * Per AR 670-1 (Army), NAVPERS 15665I (Navy), MCO 1020.34H (Marines),
 * DAFI 36-2903 (Air Force/Space Force), COMDTINST M1020.6K (Coast Guard)
 * 
 * This module provides:
 * 1. Combat and Special Skill Badges (all services)
 * 2. Marksmanship Badges and Qualifications
 * 3. Tabs (Ranger, Special Forces, Sapper, etc.)
 * 4. Overseas Service Bars
 * 5. Unit Awards and Patches
 * 6. Placement rules per regulations
 * 
 * UNIFORM PLACEMENT HIERARCHY:
 * - Combat/Special Skill Badges: Above ribbons (pocket flap area)
 * - Tabs: Shoulder (above unit patch)
 * - Ribbons: Centered on left breast
 * - Marksmanship: Below ribbons
 * - Overseas Bars: Left sleeve
 * - Service Stripes: Left sleeve (below overseas bars)
 */

// ============================================================================
// BADGE CATEGORIES AND PLACEMENT
// ============================================================================

export const BADGE_PLACEMENT = {
  // Position 1: Above ribbons (1st row, centered)
  ABOVE_RIBBONS_1: 'above-1',
  // Position 2: Above ribbons (2nd row if needed)
  ABOVE_RIBBONS_2: 'above-2',
  // Position 3: Below ribbons (marksmanship)
  BELOW_RIBBONS: 'below',
  // Special: Pocket area (identification badges)
  POCKET: 'pocket',
  // Shoulder tabs
  SHOULDER_TAB: 'shoulder-tab',
  // Beret flash
  BERET: 'beret',
};

export const BADGE_GROUPS = {
  COMBAT: 'combat',           // Combat and Special Skill Badges (Group 1)
  SPECIAL_SKILL: 'skill',     // Special Skill Badges (Group 2)
  MARKSMANSHIP: 'marksmanship', // Marksmanship Badges (Group 3)
  IDENTIFICATION: 'id',       // ID Badges (Group 4)
  FOREIGN: 'foreign',         // Foreign Badges (Group 5)
  TAB: 'tab',                 // Shoulder Tabs
};

// ============================================================================
// ARMY BADGES - Per AR 670-1
// ============================================================================

export const ARMY_BADGES = [
  // === COMBAT AND SPECIAL SKILL BADGES (GROUP 1) ===
  // Worn above ribbons, max 3 badges
  {
    id: 'combat-infantryman-badge',
    name: 'Combat Infantryman Badge',
    shortName: 'CIB',
    aliases: ['CIB', 'COMBAT INFANTRYMAN BADGE', 'COMBAT INFANTRY BADGE'],
    group: BADGE_GROUPS.COMBAT,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 1, // Highest precedence combat badge
    branch: ['Army'],
    description: 'Awarded to Infantry soldiers who have engaged in active ground combat',
    combatIndicator: true,
    svg: `<svg viewBox="0 0 100 40"><rect x="5" y="15" width="90" height="10" fill="#4169E1" rx="2"/><ellipse cx="50" cy="20" rx="12" ry="8" fill="silver" stroke="#333"/><path d="M50 8 L53 18 L50 15 L47 18 Z" fill="silver"/></svg>`,
  },
  {
    id: 'combat-action-badge',
    name: 'Combat Action Badge',
    shortName: 'CAB',
    aliases: ['CAB', 'COMBAT ACTION BADGE'],
    group: BADGE_GROUPS.COMBAT,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 2,
    branch: ['Army'],
    description: 'Awarded to soldiers who personally engaged or are engaged by the enemy',
    combatIndicator: true,
    svg: `<svg viewBox="0 0 100 40"><rect x="5" y="15" width="90" height="10" fill="#4169E1" rx="2"/><ellipse cx="50" cy="20" rx="12" ry="8" fill="silver" stroke="#333"/><path d="M42 20 L50 12 L58 20 L50 28 Z" fill="#333"/><circle cx="50" cy="20" r="3" fill="silver"/></svg>`,
  },
  {
    id: 'combat-medical-badge',
    name: 'Combat Medical Badge',
    shortName: 'CMB',
    aliases: ['CMB', 'COMBAT MEDICAL BADGE', 'COMBAT MEDIC BADGE'],
    group: BADGE_GROUPS.COMBAT,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 3,
    branch: ['Army'],
    description: 'Awarded to medical personnel who provide medical care under fire',
    combatIndicator: true,
    svg: `<svg viewBox="0 0 100 40"><rect x="5" y="15" width="90" height="10" fill="#4169E1" rx="2"/><ellipse cx="50" cy="20" rx="12" ry="8" fill="silver" stroke="#333"/><path d="M47 14 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6 z" fill="red"/></svg>`,
  },
  {
    id: 'expert-infantryman-badge',
    name: 'Expert Infantryman Badge',
    shortName: 'EIB',
    aliases: ['EIB', 'EXPERT INFANTRYMAN BADGE', 'EXPERT INFANTRY BADGE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 10,
    branch: ['Army'],
    description: 'Awarded to Infantry soldiers who demonstrate expert proficiency',
    svg: `<svg viewBox="0 0 100 40"><rect x="5" y="15" width="90" height="10" fill="silver" rx="2"/><ellipse cx="50" cy="20" rx="12" ry="8" fill="silver" stroke="#333"/><path d="M50 8 L53 18 L50 15 L47 18 Z" fill="silver"/></svg>`,
  },
  {
    id: 'expert-field-medical-badge',
    name: 'Expert Field Medical Badge',
    shortName: 'EFMB',
    aliases: ['EFMB', 'EXPERT FIELD MEDICAL BADGE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 11,
    branch: ['Army'],
    description: 'Awarded to medical personnel who demonstrate expert proficiency',
    svg: `<svg viewBox="0 0 100 40"><rect x="5" y="15" width="90" height="10" fill="silver" rx="2"/><ellipse cx="50" cy="20" rx="12" ry="8" fill="silver" stroke="#333"/><path d="M47 14 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6 z" fill="red"/></svg>`,
  },
  {
    id: 'expert-soldier-badge',
    name: 'Expert Soldier Badge',
    shortName: 'ESB',
    aliases: ['ESB', 'EXPERT SOLDIER BADGE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 12,
    branch: ['Army'],
    description: 'Awarded to soldiers who demonstrate expert proficiency in warrior tasks',
    svg: `<svg viewBox="0 0 100 40"><rect x="5" y="15" width="90" height="10" fill="silver" rx="2"/><ellipse cx="50" cy="20" rx="12" ry="8" fill="silver" stroke="#333"/><path d="M45 17 L50 12 L55 17 M45 23 L50 28 L55 23" fill="none" stroke="#333" stroke-width="2"/></svg>`,
  },
  
  // === AIRBORNE AND AIR ASSAULT ===
  {
    id: 'master-parachutist-badge',
    name: 'Master Parachutist Badge',
    shortName: 'Master Jump Wings',
    aliases: ['MASTER PARACHUTIST', 'MASTER JUMP WINGS', 'MASTER AIRBORNE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 20,
    branch: ['Army', 'Air Force'],
    description: '65+ jumps including night jumps and jumpmaster duties',
    svg: `<svg viewBox="0 0 100 40"><path d="M10 25 Q50 5 90 25" fill="none" stroke="silver" stroke-width="3"/><ellipse cx="50" cy="22" rx="8" ry="6" fill="silver"/><path d="M50 15 L52 20 L50 18 L48 20 Z" fill="gold"/><path d="M35 32 L50 28 L65 32" fill="none" stroke="silver" stroke-width="2"/></svg>`,
  },
  {
    id: 'senior-parachutist-badge',
    name: 'Senior Parachutist Badge',
    shortName: 'Senior Jump Wings',
    aliases: ['SENIOR PARACHUTIST', 'SENIOR JUMP WINGS', 'SENIOR AIRBORNE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 21,
    branch: ['Army', 'Air Force'],
    description: '30+ jumps including night jumps',
    svg: `<svg viewBox="0 0 100 40"><path d="M10 25 Q50 5 90 25" fill="none" stroke="silver" stroke-width="3"/><ellipse cx="50" cy="22" rx="8" ry="6" fill="silver"/><path d="M50 15 L52 20 L50 18 L48 20 Z" fill="silver"/></svg>`,
  },
  {
    id: 'parachutist-badge',
    name: 'Parachutist Badge',
    shortName: 'Jump Wings',
    aliases: ['PARACHUTIST', 'JUMP WINGS', 'AIRBORNE', 'BASIC PARACHUTIST', 'PARACHUTIST BADGE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 22,
    branch: ['Army', 'Air Force', 'Navy', 'Marines'],
    description: 'Completed airborne training and 5+ jumps',
    svg: `<svg viewBox="0 0 100 40"><path d="M10 25 Q50 5 90 25" fill="none" stroke="silver" stroke-width="3"/><ellipse cx="50" cy="22" rx="8" ry="6" fill="silver"/></svg>`,
  },
  {
    id: 'air-assault-badge',
    name: 'Air Assault Badge',
    shortName: 'Air Assault',
    aliases: ['AIR ASSAULT', 'AIR ASSAULT BADGE', 'AASLT'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 25,
    branch: ['Army'],
    description: 'Completed Air Assault School',
    svg: `<svg viewBox="0 0 100 40"><path d="M15 30 Q50 10 85 30" fill="none" stroke="silver" stroke-width="2"/><path d="M40 25 L50 15 L60 25 L55 25 L55 32 L45 32 L45 25 Z" fill="silver"/><circle cx="50" cy="20" r="3" fill="silver" stroke="#333"/></svg>`,
  },
  {
    id: 'pathfinder-badge',
    name: 'Pathfinder Badge',
    shortName: 'Pathfinder',
    aliases: ['PATHFINDER', 'PATHFINDER BADGE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 26,
    branch: ['Army'],
    description: 'Completed Pathfinder School',
    svg: `<svg viewBox="0 0 100 40"><path d="M10 28 Q50 8 90 28" fill="none" stroke="silver" stroke-width="2"/><path d="M50 10 L55 30 L50 25 L45 30 Z" fill="gold" stroke="silver"/></svg>`,
  },
  
  // === DIVING AND SPECIAL OPERATIONS ===
  {
    id: 'special-forces-tab',
    name: 'Special Forces Tab',
    shortName: 'SF Tab',
    aliases: ['SPECIAL FORCES', 'SF TAB', 'GREEN BERET'],
    group: BADGE_GROUPS.TAB,
    placement: BADGE_PLACEMENT.SHOULDER_TAB,
    precedence: 1,
    branch: ['Army'],
    description: 'Awarded upon completion of Special Forces Qualification Course',
    tabColor: '#228B22', // Jungle Green
    tabText: 'SPECIAL FORCES',
  },
  {
    id: 'ranger-tab',
    name: 'Ranger Tab',
    shortName: 'Ranger',
    aliases: ['RANGER', 'RANGER TAB', 'RGR'],
    group: BADGE_GROUPS.TAB,
    placement: BADGE_PLACEMENT.SHOULDER_TAB,
    precedence: 2,
    branch: ['Army'],
    description: 'Awarded upon completion of Ranger School',
    tabColor: '#000000', // Black with gold border
    tabText: 'RANGER',
    tabBorder: '#FFD700',
  },
  {
    id: 'sapper-tab',
    name: 'Sapper Tab',
    shortName: 'Sapper',
    aliases: ['SAPPER', 'SAPPER TAB'],
    group: BADGE_GROUPS.TAB,
    placement: BADGE_PLACEMENT.SHOULDER_TAB,
    precedence: 3,
    branch: ['Army'],
    description: 'Awarded upon completion of Sapper Leader Course',
    tabColor: '#000000',
    tabText: 'SAPPER',
    tabBorder: '#FFD700',
  },
  {
    id: 'airborne-tab',
    name: 'Airborne Tab',
    shortName: 'Airborne',
    aliases: ['AIRBORNE TAB'],
    group: BADGE_GROUPS.TAB,
    placement: BADGE_PLACEMENT.SHOULDER_TAB,
    precedence: 4,
    branch: ['Army'],
    description: 'Unit designation tab for airborne units',
    tabColor: '#FF0000', // Red
    tabText: 'AIRBORNE',
  },
  {
    id: 'mountain-tab',
    name: 'Mountain Tab',
    shortName: 'Mountain',
    aliases: ['MOUNTAIN', 'MOUNTAIN TAB'],
    group: BADGE_GROUPS.TAB,
    placement: BADGE_PLACEMENT.SHOULDER_TAB,
    precedence: 5,
    branch: ['Army'],
    description: 'Unit designation for 10th Mountain Division',
    tabColor: '#FFFFFF',
    tabText: 'MOUNTAIN',
    tabBorder: '#000000',
  },
  
  // === ARMY MARKSMANSHIP BADGES ===
  {
    id: 'distinguished-pistol-shot',
    name: 'Distinguished Pistol Shot Badge',
    shortName: 'Dist. Pistol',
    aliases: ['DISTINGUISHED PISTOL SHOT', 'DIST PISTOL'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 1,
    branch: ['Army'],
    description: 'Highest Army pistol marksmanship qualification',
    svg: `<svg viewBox="0 0 60 80"><path d="M30 5 L35 20 L50 20 L38 30 L43 45 L30 35 L17 45 L22 30 L10 20 L25 20 Z" fill="gold" stroke="#333"/><rect x="20" y="50" width="20" height="25" fill="gold" stroke="#333"/><text x="30" y="68" font-size="8" text-anchor="middle" fill="#333">PISTOL</text></svg>`,
  },
  {
    id: 'distinguished-rifleman',
    name: 'Distinguished Rifleman Badge',
    shortName: 'Dist. Rifle',
    aliases: ['DISTINGUISHED RIFLEMAN', 'DIST RIFLE'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 2,
    branch: ['Army'],
    description: 'Highest Army rifle marksmanship qualification',
    svg: `<svg viewBox="0 0 60 80"><path d="M30 5 L35 20 L50 20 L38 30 L43 45 L30 35 L17 45 L22 30 L10 20 L25 20 Z" fill="gold" stroke="#333"/><rect x="20" y="50" width="20" height="25" fill="gold" stroke="#333"/><text x="30" y="68" font-size="8" text-anchor="middle" fill="#333">RIFLE</text></svg>`,
  },
  {
    id: 'expert-marksmanship-rifle',
    name: 'Expert Marksmanship Badge (Rifle)',
    shortName: 'Expert Rifle',
    aliases: ['EXPERT RIFLE', 'EXPERT MARKSMAN RIFLE', 'RIFLE EXPERT'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 10,
    branch: ['Army'],
    qualification: 'expert',
    weapon: 'rifle',
    svg: `<svg viewBox="0 0 50 60"><rect x="5" y="5" width="40" height="35" fill="none" stroke="silver" stroke-width="3" rx="3"/><path d="M15 25 L25 15 L35 25 L25 35 Z" fill="silver"/><rect x="15" y="45" width="20" height="12" fill="silver" stroke="#333"/><text x="25" y="55" font-size="6" text-anchor="middle">RIFLE</text></svg>`,
  },
  {
    id: 'sharpshooter-marksmanship-rifle',
    name: 'Sharpshooter Marksmanship Badge (Rifle)',
    shortName: 'Sharpshooter Rifle',
    aliases: ['SHARPSHOOTER RIFLE', 'RIFLE SHARPSHOOTER'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 11,
    branch: ['Army'],
    qualification: 'sharpshooter',
    weapon: 'rifle',
    svg: `<svg viewBox="0 0 50 60"><path d="M15 12 L25 5 L35 12 L35 30 L25 38 L15 30 Z" fill="none" stroke="silver" stroke-width="3"/><rect x="15" y="45" width="20" height="12" fill="silver" stroke="#333"/><text x="25" y="55" font-size="6" text-anchor="middle">RIFLE</text></svg>`,
  },
  {
    id: 'marksman-marksmanship-rifle',
    name: 'Marksman Marksmanship Badge (Rifle)',
    shortName: 'Marksman Rifle',
    aliases: ['MARKSMAN RIFLE', 'RIFLE MARKSMAN', 'MARKSMAN'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 12,
    branch: ['Army'],
    qualification: 'marksman',
    weapon: 'rifle',
    svg: `<svg viewBox="0 0 50 60"><path d="M10 20 L25 5 L40 20 L40 25 L25 35 L10 25 Z" fill="none" stroke="silver" stroke-width="3"/><rect x="15" y="45" width="20" height="12" fill="silver" stroke="#333"/><text x="25" y="55" font-size="6" text-anchor="middle">RIFLE</text></svg>`,
  },
  {
    id: 'expert-marksmanship-pistol',
    name: 'Expert Marksmanship Badge (Pistol)',
    shortName: 'Expert Pistol',
    aliases: ['EXPERT PISTOL', 'EXPERT MARKSMAN PISTOL', 'PISTOL EXPERT'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 13,
    branch: ['Army'],
    qualification: 'expert',
    weapon: 'pistol',
    svg: `<svg viewBox="0 0 50 60"><rect x="5" y="5" width="40" height="35" fill="none" stroke="silver" stroke-width="3" rx="3"/><path d="M15 25 L25 15 L35 25 L25 35 Z" fill="silver"/><rect x="15" y="45" width="20" height="12" fill="silver" stroke="#333"/><text x="25" y="55" font-size="6" text-anchor="middle">PISTOL</text></svg>`,
  },
  {
    id: 'expert-marksmanship-grenade',
    name: 'Expert Marksmanship Badge (Grenade)',
    shortName: 'Expert Grenade',
    aliases: ['EXPERT GRENADE', 'GRENADE EXPERT'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 14,
    branch: ['Army'],
    qualification: 'expert',
    weapon: 'grenade',
  },
  
  // === DRIVER AND MECHANIC ===
  {
    id: 'driver-badge-w',
    name: 'Driver Badge - Wheeled Vehicle',
    shortName: 'Driver-W',
    aliases: ['DRIVER BADGE', 'DRIVER W', 'WHEELED VEHICLE DRIVER'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_2,
    precedence: 50,
    branch: ['Army'],
    svg: `<svg viewBox="0 0 80 40"><ellipse cx="40" cy="20" rx="35" ry="15" fill="none" stroke="silver" stroke-width="2"/><circle cx="25" cy="28" r="6" fill="silver"/><circle cx="55" cy="28" r="6" fill="silver"/><text x="40" y="18" font-size="8" text-anchor="middle" fill="silver">W</text></svg>`,
  },
  {
    id: 'driver-badge-t',
    name: 'Driver Badge - Tracked Vehicle',
    shortName: 'Driver-T',
    aliases: ['DRIVER T', 'TRACKED VEHICLE DRIVER'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_2,
    precedence: 51,
    branch: ['Army'],
  },
  {
    id: 'mechanic-badge',
    name: 'Mechanic Badge',
    shortName: 'Mechanic',
    aliases: ['MECHANIC', 'MECHANIC BADGE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_2,
    precedence: 52,
    branch: ['Army'],
  },
];

// ============================================================================
// NAVY/MARINE CORPS BADGES
// ============================================================================

export const NAVY_BADGES = [
  // === WARFARE PINS ===
  {
    id: 'surface-warfare-officer',
    name: 'Surface Warfare Officer',
    shortName: 'SWO',
    aliases: ['SWO', 'SURFACE WARFARE OFFICER', 'SURFACE WARFARE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 1,
    branch: ['Navy'],
    description: 'Qualified Surface Warfare Officer',
    svg: `<svg viewBox="0 0 100 40"><path d="M10 30 Q30 15 50 20 Q70 25 90 15" fill="none" stroke="gold" stroke-width="3"/><path d="M40 18 L50 8 L60 18" fill="none" stroke="gold" stroke-width="2"/><ellipse cx="50" cy="25" rx="8" ry="5" fill="gold"/></svg>`,
  },
  {
    id: 'enlisted-surface-warfare',
    name: 'Enlisted Surface Warfare Specialist',
    shortName: 'ESWS',
    aliases: ['ESWS', 'ENLISTED SURFACE WARFARE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 2,
    branch: ['Navy'],
    svg: `<svg viewBox="0 0 100 40"><path d="M10 30 Q30 15 50 20 Q70 25 90 15" fill="none" stroke="silver" stroke-width="3"/><ellipse cx="50" cy="25" rx="8" ry="5" fill="silver"/></svg>`,
  },
  {
    id: 'submarine-warfare-officer',
    name: 'Submarine Warfare Officer',
    shortName: 'Dolphins (Gold)',
    aliases: ['SUBMARINE WARFARE', 'GOLD DOLPHINS', 'SUBMARINE OFFICER'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 3,
    branch: ['Navy'],
    svg: `<svg viewBox="0 0 100 40"><ellipse cx="50" cy="20" rx="40" ry="10" fill="none" stroke="gold" stroke-width="2"/><path d="M20 20 Q35 10 50 20 Q65 30 80 20" fill="gold"/><circle cx="50" cy="20" r="5" fill="gold" stroke="#333"/></svg>`,
  },
  {
    id: 'submarine-warfare-enlisted',
    name: 'Submarine Warfare Enlisted',
    shortName: 'Dolphins (Silver)',
    aliases: ['SILVER DOLPHINS', 'SUBMARINE ENLISTED'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 4,
    branch: ['Navy'],
    svg: `<svg viewBox="0 0 100 40"><ellipse cx="50" cy="20" rx="40" ry="10" fill="none" stroke="silver" stroke-width="2"/><path d="M20 20 Q35 10 50 20 Q65 30 80 20" fill="silver"/><circle cx="50" cy="20" r="5" fill="silver" stroke="#333"/></svg>`,
  },
  {
    id: 'naval-aviator',
    name: 'Naval Aviator',
    shortName: 'Wings of Gold',
    aliases: ['NAVAL AVIATOR', 'NAVY PILOT', 'WINGS OF GOLD', 'PILOT WINGS'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 5,
    branch: ['Navy', 'Marines'],
    svg: `<svg viewBox="0 0 100 40"><path d="M5 22 Q25 10 50 20 Q75 30 95 22" fill="gold" stroke="#333"/><ellipse cx="50" cy="20" rx="10" ry="8" fill="gold" stroke="#333"/><path d="M50 10 L53 18 L50 15 L47 18 Z" fill="#333"/></svg>`,
  },
  {
    id: 'naval-flight-officer',
    name: 'Naval Flight Officer',
    shortName: 'NFO Wings',
    aliases: ['NFO', 'NAVAL FLIGHT OFFICER', 'NFO WINGS'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 6,
    branch: ['Navy', 'Marines'],
  },
  {
    id: 'navy-seal-trident',
    name: 'Special Warfare Insignia (SEAL Trident)',
    shortName: 'Trident',
    aliases: ['SEAL', 'TRIDENT', 'SPECIAL WARFARE', 'NAVY SEAL', 'SEAL TRIDENT'],
    group: BADGE_GROUPS.COMBAT,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 1, // Highest for SEALs
    branch: ['Navy'],
    combatIndicator: true,
    svg: `<svg viewBox="0 0 100 50"><path d="M50 5 L55 25 L75 25 L58 35 L65 50 L50 40 L35 50 L42 35 L25 25 L45 25 Z" fill="gold" stroke="#333"/><path d="M50 5 L50 25" stroke="gold" stroke-width="3"/><path d="M40 15 L50 10 L60 15" fill="none" stroke="gold" stroke-width="2"/></svg>`,
  },
  {
    id: 'fleet-marine-force',
    name: 'Fleet Marine Force Warfare',
    shortName: 'FMF',
    aliases: ['FMF', 'FLEET MARINE FORCE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 10,
    branch: ['Navy'],
  },
  {
    id: 'seabee-combat-warfare',
    name: 'Seabee Combat Warfare Specialist',
    shortName: 'SCW',
    aliases: ['SCW', 'SEABEE COMBAT WARFARE', 'SEABEE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 11,
    branch: ['Navy'],
  },
  
  // === NAVY/MC MARKSMANSHIP ===
  {
    id: 'navy-expert-pistol',
    name: 'Navy Expert Pistol Shot Medal',
    shortName: 'Expert Pistol',
    aliases: ['NAVY EXPERT PISTOL', 'EXPERT PISTOL SHOT'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 10,
    branch: ['Navy', 'Marines', 'Coast Guard'],
    qualification: 'expert',
    weapon: 'pistol',
  },
  {
    id: 'navy-expert-rifle',
    name: 'Navy Expert Rifle Shot Medal',
    shortName: 'Expert Rifle',
    aliases: ['NAVY EXPERT RIFLE', 'EXPERT RIFLE SHOT'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 11,
    branch: ['Navy', 'Marines', 'Coast Guard'],
    qualification: 'expert',
    weapon: 'rifle',
  },
  {
    id: 'marine-rifle-expert',
    name: 'Marine Corps Rifle Expert Badge',
    shortName: 'Rifle Expert',
    aliases: ['RIFLE EXPERT', 'EXPERT RIFLE BADGE'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 12,
    branch: ['Marines'],
    qualification: 'expert',
    weapon: 'rifle',
  },
  {
    id: 'marine-rifle-sharpshooter',
    name: 'Marine Corps Rifle Sharpshooter Badge',
    shortName: 'Rifle Sharpshooter',
    aliases: ['RIFLE SHARPSHOOTER'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 13,
    branch: ['Marines'],
    qualification: 'sharpshooter',
    weapon: 'rifle',
  },
  {
    id: 'marine-rifle-marksman',
    name: 'Marine Corps Rifle Marksman Badge',
    shortName: 'Rifle Marksman',
    aliases: ['RIFLE MARKSMAN'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 14,
    branch: ['Marines'],
    qualification: 'marksman',
    weapon: 'rifle',
  },
];

// ============================================================================
// AIR FORCE BADGES - Per DAFI 36-2903
// ============================================================================

export const AIR_FORCE_BADGES = [
  // === AERONAUTICAL RATINGS ===
  {
    id: 'command-pilot',
    name: 'Command Pilot',
    shortName: 'Command Pilot',
    aliases: ['COMMAND PILOT', 'COMMAND PILOT WINGS'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 1,
    branch: ['Air Force', 'Space Force'],
    description: '15 years rated + 3000 hours',
    svg: `<svg viewBox="0 0 100 40"><path d="M5 22 Q25 8 50 18 Q75 28 95 22" fill="silver" stroke="#333"/><ellipse cx="50" cy="20" rx="10" ry="7" fill="silver" stroke="#333"/><path d="M50 10 L53 17 L50 14 L47 17 Z" fill="silver"/><path d="M42 30 L50 25 L58 30" fill="none" stroke="silver" stroke-width="2"/></svg>`,
  },
  {
    id: 'senior-pilot',
    name: 'Senior Pilot',
    shortName: 'Senior Pilot',
    aliases: ['SENIOR PILOT', 'SENIOR PILOT WINGS'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 2,
    branch: ['Air Force', 'Space Force'],
    description: '7 years rated + 2000 hours',
    svg: `<svg viewBox="0 0 100 40"><path d="M5 22 Q25 8 50 18 Q75 28 95 22" fill="silver" stroke="#333"/><ellipse cx="50" cy="20" rx="10" ry="7" fill="silver" stroke="#333"/><path d="M50 10 L53 17 L50 14 L47 17 Z" fill="silver"/></svg>`,
  },
  {
    id: 'pilot-wings',
    name: 'Pilot Wings',
    shortName: 'Pilot',
    aliases: ['PILOT', 'PILOT WINGS', 'BASIC PILOT'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 3,
    branch: ['Air Force', 'Space Force'],
    svg: `<svg viewBox="0 0 100 40"><path d="M5 22 Q25 8 50 18 Q75 28 95 22" fill="silver" stroke="#333"/><ellipse cx="50" cy="20" rx="10" ry="7" fill="silver" stroke="#333"/></svg>`,
  },
  {
    id: 'command-navigator',
    name: 'Command Navigator/CSO',
    shortName: 'Command Navigator',
    aliases: ['COMMAND NAVIGATOR', 'COMMAND CSO'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 4,
    branch: ['Air Force'],
  },
  {
    id: 'master-navigator',
    name: 'Master Navigator/CSO',
    shortName: 'Master Navigator',
    aliases: ['MASTER NAVIGATOR', 'MASTER CSO'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 5,
    branch: ['Air Force'],
  },
  
  // === OPERATIONS BADGES ===
  {
    id: 'master-space-badge',
    name: 'Master Space Operations Badge',
    shortName: 'Master Space',
    aliases: ['MASTER SPACE', 'MASTER SPACE OPERATIONS'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 10,
    branch: ['Air Force', 'Space Force'],
  },
  {
    id: 'senior-space-badge',
    name: 'Senior Space Operations Badge',
    shortName: 'Senior Space',
    aliases: ['SENIOR SPACE', 'SENIOR SPACE OPERATIONS'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 11,
    branch: ['Air Force', 'Space Force'],
  },
  {
    id: 'basic-space-badge',
    name: 'Space Operations Badge',
    shortName: 'Space Ops',
    aliases: ['SPACE BADGE', 'SPACE OPERATIONS'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 12,
    branch: ['Air Force', 'Space Force'],
  },
  {
    id: 'master-cyberspace-badge',
    name: 'Master Cyberspace Operations Badge',
    shortName: 'Master Cyber',
    aliases: ['MASTER CYBER', 'MASTER CYBERSPACE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 15,
    branch: ['Air Force', 'Space Force'],
  },
  
  // === COMBAT CONTROL / SPECIAL TACTICS ===
  {
    id: 'combat-control-team',
    name: 'Combat Control Team',
    shortName: 'CCT',
    aliases: ['CCT', 'COMBAT CONTROL', 'COMBAT CONTROLLER'],
    group: BADGE_GROUPS.COMBAT,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 1,
    branch: ['Air Force'],
    combatIndicator: true,
  },
  {
    id: 'pararescue',
    name: 'Pararescue',
    shortName: 'PJ',
    aliases: ['PJ', 'PARARESCUE', 'PARA RESCUE'],
    group: BADGE_GROUPS.COMBAT,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 2,
    branch: ['Air Force'],
    combatIndicator: true,
  },
  {
    id: 'tactical-air-control',
    name: 'Tactical Air Control Party',
    shortName: 'TACP',
    aliases: ['TACP', 'TACTICAL AIR CONTROL'],
    group: BADGE_GROUPS.COMBAT,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 3,
    branch: ['Air Force'],
  },
  
  // === AF MARKSMANSHIP ===
  {
    id: 'af-small-arms-expert',
    name: 'Small Arms Expert Marksmanship Ribbon',
    shortName: 'Expert',
    aliases: ['SMALL ARMS EXPERT', 'AF EXPERT MARKSMAN'],
    group: BADGE_GROUPS.MARKSMANSHIP,
    placement: BADGE_PLACEMENT.BELOW_RIBBONS,
    precedence: 10,
    branch: ['Air Force', 'Space Force'],
    qualification: 'expert',
  },
];

// ============================================================================
// SPACE FORCE BADGES - Per DAFI 36-2903 / USSF Uniform Guide
// ============================================================================

export const SPACE_FORCE_BADGES = [
  // === GUARDIAN BADGES ===
  {
    id: 'guardian-badge',
    name: 'Guardian Badge',
    shortName: 'Guardian',
    aliases: ['GUARDIAN', 'GUARDIAN BADGE', 'USSF GUARDIAN'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 1,
    branch: ['Space Force'],
    description: 'Worn by all Space Force Guardians',
    svg: `<svg viewBox="0 0 100 50"><path d="M50 5 L70 20 L65 45 L50 35 L35 45 L30 20 Z" fill="silver" stroke="#333" stroke-width="2"/><path d="M50 12 L58 22 L55 38 L50 32 L45 38 L42 22 Z" fill="#1C1C1C"/><circle cx="50" cy="25" r="4" fill="silver"/></svg>`,
  },
  {
    id: 'master-space-operations-ussf',
    name: 'Master Space Operations Badge (USSF)',
    shortName: 'Master Space Ops',
    aliases: ['MASTER SPACE OPERATIONS', 'MASTER SPACE OPS', 'MASTER GUARDIAN'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 2,
    branch: ['Space Force'],
    description: '7+ years space operations experience with senior leadership',
    svg: `<svg viewBox="0 0 100 50"><ellipse cx="50" cy="25" rx="40" ry="18" fill="none" stroke="silver" stroke-width="2"/><path d="M50 5 L55 20 L50 15 L45 20 Z" fill="gold"/><circle cx="50" cy="25" r="8" fill="silver"/><path d="M30 35 L50 28 L70 35" fill="none" stroke="silver" stroke-width="2"/></svg>`,
  },
  {
    id: 'senior-space-operations-ussf',
    name: 'Senior Space Operations Badge (USSF)',
    shortName: 'Senior Space Ops',
    aliases: ['SENIOR SPACE OPERATIONS', 'SENIOR SPACE OPS', 'SENIOR GUARDIAN'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 3,
    branch: ['Space Force'],
    description: '4+ years space operations experience',
    svg: `<svg viewBox="0 0 100 50"><ellipse cx="50" cy="25" rx="40" ry="18" fill="none" stroke="silver" stroke-width="2"/><path d="M50 8 L54 18 L50 15 L46 18 Z" fill="silver"/><circle cx="50" cy="25" r="8" fill="silver"/></svg>`,
  },
  {
    id: 'basic-space-operations-ussf',
    name: 'Space Operations Badge (USSF)',
    shortName: 'Space Ops',
    aliases: ['SPACE OPERATIONS BADGE', 'BASIC SPACE OPS', 'SPACE OPS'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 4,
    branch: ['Space Force'],
    description: 'Awarded upon completion of initial space operations training',
    svg: `<svg viewBox="0 0 100 50"><ellipse cx="50" cy="25" rx="40" ry="18" fill="none" stroke="silver" stroke-width="2"/><circle cx="50" cy="25" r="8" fill="silver"/></svg>`,
  },
  
  // === CYBER AND INTELLIGENCE ===
  {
    id: 'master-cyber-operations-ussf',
    name: 'Master Cyberspace Operations Badge (USSF)',
    shortName: 'Master Cyber',
    aliases: ['MASTER CYBER', 'MASTER CYBERSPACE USSF'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 10,
    branch: ['Space Force'],
  },
  {
    id: 'senior-cyber-operations-ussf',
    name: 'Senior Cyberspace Operations Badge (USSF)',
    shortName: 'Senior Cyber',
    aliases: ['SENIOR CYBER', 'SENIOR CYBERSPACE USSF'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 11,
    branch: ['Space Force'],
  },
  {
    id: 'basic-cyber-operations-ussf',
    name: 'Cyberspace Operations Badge (USSF)',
    shortName: 'Cyber Ops',
    aliases: ['CYBER OPERATIONS', 'CYBERSPACE USSF'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 12,
    branch: ['Space Force'],
  },
  {
    id: 'master-intelligence-ussf',
    name: 'Master Intelligence Badge (USSF)',
    shortName: 'Master Intel',
    aliases: ['MASTER INTELLIGENCE USSF', 'MASTER INTEL USSF'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 15,
    branch: ['Space Force'],
  },
  {
    id: 'senior-intelligence-ussf',
    name: 'Senior Intelligence Badge (USSF)',
    shortName: 'Senior Intel',
    aliases: ['SENIOR INTELLIGENCE USSF', 'SENIOR INTEL USSF'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 16,
    branch: ['Space Force'],
  },
  {
    id: 'basic-intelligence-ussf',
    name: 'Intelligence Badge (USSF)',
    shortName: 'Intel',
    aliases: ['INTELLIGENCE USSF', 'INTEL BADGE USSF'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 17,
    branch: ['Space Force'],
  },
  
  // === ACQUISITION AND PROFESSIONAL ===
  {
    id: 'master-acquisition-ussf',
    name: 'Master Acquisition Badge (USSF)',
    shortName: 'Master Acq',
    aliases: ['MASTER ACQUISITION USSF'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 20,
    branch: ['Space Force'],
  },
  {
    id: 'senior-acquisition-ussf',
    name: 'Senior Acquisition Badge (USSF)',
    shortName: 'Senior Acq',
    aliases: ['SENIOR ACQUISITION USSF'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 21,
    branch: ['Space Force'],
  },
  {
    id: 'basic-acquisition-ussf',
    name: 'Acquisition Badge (USSF)',
    shortName: 'Acquisition',
    aliases: ['ACQUISITION USSF', 'ACQUISITION BADGE'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 22,
    branch: ['Space Force'],
  },
];

// ============================================================================
// COAST GUARD BADGES
// ============================================================================

export const COAST_GUARD_BADGES = [
  {
    id: 'cutterman-officer',
    name: 'Cutterman Officer',
    shortName: 'Cutterman',
    aliases: ['CUTTERMAN', 'CUTTERMAN OFFICER'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 1,
    branch: ['Coast Guard'],
  },
  {
    id: 'cutterman-enlisted',
    name: 'Cutterman Enlisted',
    shortName: 'Cutterman (E)',
    aliases: ['CUTTERMAN ENLISTED'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 2,
    branch: ['Coast Guard'],
  },
  {
    id: 'cg-aviator',
    name: 'Coast Guard Aviator',
    shortName: 'CG Aviator',
    aliases: ['COAST GUARD AVIATOR', 'CG PILOT'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 3,
    branch: ['Coast Guard'],
  },
  {
    id: 'rescue-swimmer',
    name: 'Rescue Swimmer',
    shortName: 'Rescue Swimmer',
    aliases: ['RESCUE SWIMMER', 'AST'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 5,
    branch: ['Coast Guard', 'Navy'],
    combatIndicator: false,
  },
  {
    id: 'port-security-specialist',
    name: 'Port Security Specialist',
    shortName: 'PSU',
    aliases: ['PORT SECURITY', 'PSU'],
    group: BADGE_GROUPS.SPECIAL_SKILL,
    placement: BADGE_PLACEMENT.ABOVE_RIBBONS_1,
    precedence: 10,
    branch: ['Coast Guard'],
  },
];

// ============================================================================
// OVERSEAS SERVICE BARS (Army) - Per AR 670-1
// ============================================================================

export const OVERSEAS_SERVICE_BARS = {
  // Each bar represents 6 months of overseas service
  // Worn on right sleeve (wartime) or left sleeve (peacetime credited)
  description: 'One bar for each 6 months of overseas service',
  placement: 'right-sleeve', // Wartime overseas bars
  combatBars: {
    placement: 'right-sleeve',
    description: 'Overseas service bars for wartime service',
    color: 'gold', // Gold on green background
  },
  peacetimeBars: {
    placement: 'left-sleeve',
    description: 'Overseas service bars for peacetime service',
    color: 'gold',
  },
};

// ============================================================================
// SERVICE STRIPES (Hashmarks) - Per AR 670-1
// ============================================================================

export const SERVICE_STRIPES = {
  Army: {
    description: 'One stripe per 3 years of honorable service',
    placement: 'left-sleeve-lower',
    color: 'gold',
    yearsPerStripe: 3,
  },
  Navy: {
    description: 'One stripe per 4 years of service',
    placement: 'left-sleeve-lower',
    color: { gold: 'good_conduct', red: 'standard' },
    yearsPerStripe: 4,
  },
  Marines: {
    description: 'One stripe per 4 years of service',
    placement: 'left-sleeve-lower',
    color: { gold: '12_years_good', red: 'standard' },
    yearsPerStripe: 4,
  },
  'Air Force': {
    description: 'Longevity Service Award Ribbon instead of stripes',
    placement: 'ribbon',
  },
  'Coast Guard': {
    description: 'One stripe per 4 years of service',
    placement: 'left-sleeve-lower',
    yearsPerStripe: 4,
  },
};

// ============================================================================
// COMBINED MASTER BADGE DATABASE
// ============================================================================

export const ALL_BADGES = [
  ...ARMY_BADGES,
  ...NAVY_BADGES,
  ...AIR_FORCE_BADGES,
  ...SPACE_FORCE_BADGES,
  ...COAST_GUARD_BADGES,
];

// ============================================================================
// BADGE PARSING FROM DD214 TEXT
// ============================================================================

export function parseDD214Badges(rawText, branch = 'Army') {
  if (!rawText || typeof rawText !== 'string') {
    return { badges: [], tabs: [], combatIndicators: [] };
  }
  
  // Clean the text
  let cleanedText = rawText
    .replace(/\([^)]*\)/g, ' ')  // Remove parenthetical
    .replace(/[a-z]{3,}/g, ' ')  // Remove lowercase words
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  const foundBadges = [];
  const foundTabs = [];
  const combatIndicators = [];
  const processedIds = new Set();
  
  // Search all badges
  for (const badge of ALL_BADGES) {
    // Check if badge applies to this branch
    if (!badge.branch.includes(branch)) continue;
    
    let matched = false;
    
    // Check main name
    if (cleanedText.includes(badge.name.toUpperCase())) {
      matched = true;
    }
    
    // Check aliases
    if (!matched && badge.aliases) {
      for (const alias of badge.aliases) {
        if (cleanedText.includes(alias)) {
          matched = true;
          break;
        }
      }
    }
    
    if (matched && !processedIds.has(badge.id)) {
      processedIds.add(badge.id);
      
      if (badge.group === BADGE_GROUPS.TAB) {
        foundTabs.push(badge);
      } else {
        foundBadges.push(badge);
      }
      
      if (badge.combatIndicator) {
        combatIndicators.push(badge.name);
      }
    }
  }
  
  // Sort by precedence within each group
  foundBadges.sort((a, b) => (a.precedence || 999) - (b.precedence || 999));
  foundTabs.sort((a, b) => (a.precedence || 999) - (b.precedence || 999));
  
  return {
    badges: foundBadges,
    tabs: foundTabs,
    combatIndicators,
  };
}

// ============================================================================
// CALCULATE OVERSEAS BARS
// ============================================================================

export function calculateOverseasBars(foreignServiceMonths, isWartime = false) {
  // One bar per 6 months of overseas service
  const bars = Math.floor(foreignServiceMonths / 6);
  return {
    count: bars,
    type: isWartime ? 'wartime' : 'peacetime',
    placement: isWartime ? 'right-sleeve' : 'left-sleeve',
  };
}

// ============================================================================
// CALCULATE SERVICE STRIPES
// ============================================================================

export function calculateServiceStripes(totalYearsService, branch = 'Army') {
  const config = SERVICE_STRIPES[branch];
  if (!config || !config.yearsPerStripe) {
    return { count: 0, note: 'Uses ribbon instead of stripes' };
  }
  
  const stripes = Math.floor(totalYearsService / config.yearsPerStripe);
  return {
    count: stripes,
    yearsPerStripe: config.yearsPerStripe,
    placement: config.placement,
    color: config.color,
  };
}

// ============================================================================
// EXPORT BADGE PLACEMENT RULES
// ============================================================================

export const PLACEMENT_RULES = {
  Army: {
    regulation: 'AR 670-1',
    maxBadgesAbove: 3,
    maxBadgesBelow: 2,
    order: [
      'Combat badges (CIB, CAB, CMB) - highest precedence',
      'Special skill badges (EIB, EFMB, ESB)',
      'Parachutist badges (Master, Senior, Basic)',
      'Air Assault, Pathfinder',
      'Other skill badges',
      'BELOW RIBBONS: Marksmanship badges',
    ],
    tabOrder: [
      'Special Forces Tab (top)',
      'Ranger Tab',
      'Sapper Tab',
      'Unit tabs (Airborne, Mountain)',
    ],
  },
  Navy: {
    regulation: 'NAVPERS 15665I',
    order: [
      'Warfare qualification (SWO, Submarine, Aviation)',
      'Special warfare (SEAL Trident)',
      'Other qualifications',
    ],
  },
  'Air Force': {
    regulation: 'DAFI 36-2903',
    order: [
      'Aeronautical ratings (Pilot, Navigator)',
      'Operations badges (Space, Cyber)',
      'Special tactics (CCT, PJ, TACP)',
      'Other occupational badges',
    ],
  },
  'Space Force': {
    regulation: 'DAFI 36-2903 / USSF Uniform Guide',
    order: [
      'Guardian Badge (all Guardians)',
      'Space Operations badges (Master, Senior, Basic)',
      'Cyberspace Operations badges',
      'Intelligence badges',
      'Acquisition badges',
      'Other occupational badges',
    ],
  },
};

export default {
  ALL_BADGES,
  ARMY_BADGES,
  NAVY_BADGES,
  AIR_FORCE_BADGES,
  SPACE_FORCE_BADGES,
  COAST_GUARD_BADGES,
  BADGE_GROUPS,
  BADGE_PLACEMENT,
  PLACEMENT_RULES,
  OVERSEAS_SERVICE_BARS,
  SERVICE_STRIPES,
  parseDD214Badges,
  calculateOverseasBars,
  calculateServiceStripes,
};
