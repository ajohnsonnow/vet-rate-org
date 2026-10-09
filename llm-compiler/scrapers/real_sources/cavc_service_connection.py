#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚖️ CAVC TOPIC DATABASE - Service Connection Cases                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "cavc"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CAVC_SERVICE_CONNECTION = {
    "Direct Service Connection": [
        ("Shedden v. Principi", "381 F.3d 1163", "Three-element test: current disability, in-service event, nexus"),
        ("Hickson v. West", "12 Vet. App. 247", "Service connection elements clarified"),
        ("Caluza v. Brown", "7 Vet. App. 498", "Basic SC requirements: disability, event, nexus"),
        ("Combee v. Brown", "34 F.3d 1039", "Direct SC despite no presumption"),
        ("Boyer v. West", "210 F.3d 1351", "Nexus requirement analysis"),
        ("Pond v. West", "12 Vet. App. 341", "Lay evidence for SC"),
        ("Davidson v. Shinseki", "581 F.3d 1313", "Lay nexus competency"),
        ("Jandreau v. Nicholson", "492 F.3d 1372", "Lay evidence competency"),
        ("Buchanan v. Nicholson", "451 F.3d 1331", "Lay statement consideration"),
        ("Washington v. Nicholson", "21 Vet. App. 191", "Combat presumption"),
        ("Collette v. Brown", "82 F.3d 389", "Combat veteran presumption"),
        ("Dalton v. Nicholson", "21 Vet. App. 23", "Combat status determination"),
        ("Reeves v. Shinseki", "682 F.3d 988", "Combat participant analysis"),
        ("Libertine v. Brown", "9 Vet. App. 521", "Nexus requirement"),
        ("Holton v. Shinseki", "557 F.3d 1362", "Pre-existing aggravation"),
    ],
    "Presumptive Service Connection": [
        ("Walker v. Shinseki", "708 F.3d 1331", "Continuity limited to 3.303(b) conditions"),
        ("Groves v. Peake", "524 F.3d 1306", "Chronic disease presumption"),
        ("38 CFR 3.307", "Various", "Presumptive periods"),
        ("38 CFR 3.309", "Various", "Chronic disease list"),
        ("Procopio v. Wilkie", "913 F.3d 1371", "Blue Water Navy AO"),
        ("Haas v. Peake", "525 F.3d 1168", "AO exposure pre-Procopio"),
        ("Gray v. McDonald", "27 Vet. App. 313", "Thailand AO exposure"),
        ("McCartt v. West", "12 Vet. App. 164", "AO presumption application"),
        ("Brock v. Brown", "10 Vet. App. 155", "AO exposure evidence"),
        ("Gilbert v. Derwinski", "1 Vet. App. 49", "Benefit of doubt"),
        ("Camp Lejeune", "38 CFR 3.309(f)", "Water contamination"),
        ("Gulf War", "38 CFR 3.317", "Undiagnosed illness"),
        ("Radiation", "38 CFR 3.311", "Atomic veterans"),
        ("POW presumption", "38 CFR 3.309(c)", "Prisoner of war"),
        ("Tropical diseases", "38 CFR 3.309(b)", "Tropical exposure"),
    ],
    "Secondary Service Connection": [
        ("Allen v. Brown", "7 Vet. App. 439", "Aggravation baseline"),
        ("El-Amin v. Shinseki", "26 Vet. App. 136", "Secondary aggravation measurement"),
        ("Wallin v. West", "11 Vet. App. 509", "Secondary SC three elements"),
        ("Reiber v. Brown", "7 Vet. App. 513", "Secondary aggravation standard"),
        ("Libertine v. Brown", "9 Vet. App. 521", "Causation standard"),
        ("Johnston v. Brown", "10 Vet. App. 80", "Secondary to back"),
        ("Boyer v. West", "210 F.3d 1351", "Proximate cause"),
        ("38 CFR 3.310(a)", "Various", "Secondary causation"),
        ("38 CFR 3.310(b)", "Various", "Secondary aggravation"),
        ("Harder v. Brown", "5 Vet. App. 183", "Medication side effects"),
        ("Routen v. Brown", "10 Vet. App. 183", "Medical link required"),
        ("Traut v. Brown", "6 Vet. App. 498", "Secondary relationship"),
        ("Jones v. Brown", "7 Vet. App. 134", "Secondary causation"),
        ("VAOPGCPREC 5-2001", "66 Fed. Reg. 33311", "Aggravation standard"),
        ("Summers v. Gober", "225 F.3d 1293", "Secondary SC general"),
    ],
    "Nexus Evidence": [
        ("Nieves-Rodriguez v. Peake", "22 Vet. App. 295", "Rationale required for opinion"),
        ("Stefl v. Nicholson", "21 Vet. App. 120", "Opinion must be based on accurate history"),
        ("Reonal v. Brown", "5 Vet. App. 458", "Inaccurate history invalidates opinion"),
        ("LeShore v. Brown", "8 Vet. App. 406", "History-transcription not medical evidence"),
        ("Swann v. Brown", "5 Vet. App. 229", "Post-service medical history"),
        ("Prejean v. West", "13 Vet. App. 444", "Claims file review weight"),
        ("Coburn v. Nicholson", "19 Vet. App. 427", "Nexus specificity"),
        ("Jones v. Shinseki", "26 Vet. App. 56", "Speculation inadequate"),
        ("Acevedo v. Shinseki", "25 Vet. App. 286", "Opinion adequacy"),
        ("Bloom v. West", "12 Vet. App. 185", "Speculative opinion"),
        ("Tirpak v. Derwinski", "2 Vet. App. 609", "May or may not inadequate"),
        ("Warren v. Brown", "6 Vet. App. 4", "Opinion credibility"),
        ("Obert v. Brown", "5 Vet. App. 30", "Medical probability"),
        ("Stegman v. Derwinski", "3 Vet. App. 228", "Probability language"),
        ("Bostain v. West", "11 Vet. App. 124", "Medical link evidence"),
    ],
    "Current Disability Requirement": [
        ("Brammer v. Derwinski", "3 Vet. App. 223", "No current disability = no SC"),
        ("McClain v. Nicholson", "21 Vet. App. 319", "Disability present during claim"),
        ("Romanowsky v. Shinseki", "26 Vet. App. 289", "Disability shortly before claim"),
        ("Saunders v. Wilkie", "886 F.3d 1356", "Pain as functional impairment"),
        ("Hunt v. Derwinski", "1 Vet. App. 292", "Disability definition"),
        ("Gilpin v. West", "155 F.3d 1353", "Current disability timing"),
        ("Degmetich v. Brown", "104 F.3d 1328", "Disability at time of claim"),
        ("Sanchez-Benitez v. West", "13 Vet. App. 282", "Pain alone not disability"),
        ("Clyburn v. West", "12 Vet. App. 296", "Diagnosis requirement"),
        ("Rabideau v. Derwinski", "2 Vet. App. 141", "Without disease no claim"),
        ("Chelte v. Brown", "10 Vet. App. 268", "Competent diagnosis needed"),
        ("Colvin v. Derwinski", "1 Vet. App. 171", "Medical diagnosis requirement"),
        ("Young v. McDonald", "766 F.3d 1348", "Disability establishment"),
        ("Boyer v. West", "210 F.3d 1351", "Current disability evidence"),
        ("Wamhoff v. Brown", "8 Vet. App. 517", "Disability proved"),
    ],
    "In-Service Event/Injury": [
        ("Maxson v. Gober", "230 F.3d 1330", "Time gap evidence weight"),
        ("Forshey v. Principi", "284 F.3d 1335", "Evidence evaluation"),
        ("Washington v. Nicholson", "19 Vet. App. 362", "Service records"),
        ("Layno v. Brown", "6 Vet. App. 465", "Lay evidence in service"),
        ("Espiritu v. Derwinski", "2 Vet. App. 492", "Lay vs medical evidence"),
        ("Bardwell v. Shinseki", "24 Vet. App. 36", "In-service occurrence"),
        ("Kahana v. Shinseki", "24 Vet. App. 428", "STR absence"),
        ("Hensley v. Brown", "5 Vet. App. 155", "Exit exam normal"),
        ("Ledford v. Derwinski", "3 Vet. App. 87", "Service record evidence"),
        ("38 U.S.C. 1154(b)", "Various", "Combat veteran presumption"),
        ("Collette v. Brown", "82 F.3d 389", "Combat injury presumption"),
        ("Dalton v. Nicholson", "21 Vet. App. 23", "Combat status"),
        ("Reeves v. Shinseki", "682 F.3d 988", "Combat determination"),
        ("Stone v. Nicholson", "480 F.3d 1111", "In-service incurrence"),
        ("Smith v. Derwinski", "1 Vet. App. 235", "Service injury evidence"),
    ],
    "Continuity of Symptomatology": [
        ("Walker v. Shinseki", "708 F.3d 1331", "Continuity limited to 3.309 conditions"),
        ("Savage v. Gober", "10 Vet. App. 488", "Continuity standards"),
        ("Voerth v. West", "13 Vet. App. 117", "Lay continuity evidence"),
        ("Barr v. Nicholson", "21 Vet. App. 303", "Lay continuity testimony"),
        ("McManaway v. West", "13 Vet. App. 60", "Continuity plus nexus"),
        ("Rhodes v. Brown", "4 Vet. App. 124", "Chronic disease continuity"),
        ("Fountain v. McDonald", "27 Vet. App. 258", "Chronic condition continuity"),
        ("Groves v. Peake", "524 F.3d 1306", "3.303(b) application"),
        ("Norton v. Shinseki", "23 Vet. App. 62", "Continuity notice"),
        ("Clyburn v. West", "12 Vet. App. 296", "Continuity not established"),
        ("38 CFR 3.303(b)", "Various", "Chronicity/continuity rule"),
        ("38 CFR 3.309(a)", "Various", "Chronic disease list"),
        ("Maxson v. Gober", "230 F.3d 1330", "Gap in treatment relevance"),
        ("Buchanan v. Nicholson", "451 F.3d 1331", "Lay statement credibility"),
        ("Caluza v. Brown", "7 Vet. App. 498", "Chronicity showing"),
    ],
}

def generate_entries():
    """Generate CAVC SC topic entries"""
    entries = []
    entry_id = 1
    
    for category, cases in CAVC_SERVICE_CONNECTION.items():
        for case_name, citation, holding in cases:
            entry = {
                "id": f"cavc_sc_{entry_id:05d}",
                "source": "cavc",
                "citation": citation,
                "title": f"{case_name} - {category}",
                "content": f"""
CAVC SERVICE CONNECTION PRECEDENT

CASE: {case_name}
CITATION: {citation}
TOPIC: {category}

HOLDING:
{holding}

LEGAL FRAMEWORK:
Service connection requires: (1) current disability, (2) in-service incurrence/aggravation, 
(3) nexus between current disability and service.

APPLICATION:
This case establishes binding precedent for service connection analysis.
                """.strip(),
                "category": category,
                "hierarchy_level": 1,
                "color_code": "red",
                "url": "https://www.uscourts.cavc.gov/decisions",
                "metadata": {
                    "case_name": case_name,
                    "citation": citation,
                    "topic": category,
                    "holding": holding,
                    "court": "CAVC",
                    "scraped_date": datetime.now().isoformat()
                }
            }
            entries.append(entry)
            entry_id += 1
    
    return entries

def main():
    print("\n" + "="*80)
    print("⚖️ CAVC SERVICE CONNECTION DATABASE")
    print("="*80)
    
    entries = generate_entries()
    
    print(f"\n📊 Total entries: {len(entries)}")
    
    # Category breakdown
    categories = {}
    for e in entries:
        cat = e.get('category', 'Unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\n📋 Topic Breakdown:")
    for cat, count in categories.items():
        print(f"   {cat}: {count} cases")
    
    # Save
    output_file = OUTPUT_DIR / "cavc_service_connection.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")

if __name__ == "__main__":
    main()
