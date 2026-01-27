#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚖️ CAVC EVIDENCE DATABASE - Credibility, Lay Evidence, Medical Opinions     ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "cavc"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CAVC_EVIDENCE = {
    "Lay Evidence Competency": [
        ("Jandreau v. Nicholson", "492 F.3d 1372", "Lay evidence competent for observable symptoms"),
        ("Buchanan v. Nicholson", "451 F.3d 1331", "Lay statements must be considered"),
        ("Davidson v. Shinseki", "581 F.3d 1313", "Lay nexus competency"),
        ("Layno v. Brown", "6 Vet. App. 465", "Lay testimony scope"),
        ("Espiritu v. Derwinski", "2 Vet. App. 492", "Lay vs medical evidence"),
        ("Pond v. West", "12 Vet. App. 341", "Observable symptoms"),
        ("Barr v. Nicholson", "21 Vet. App. 303", "Lay continuity testimony"),
        ("Charles v. Principi", "16 Vet. App. 370", "Lay competence symptoms"),
        ("Falzone v. Brown", "8 Vet. App. 398", "Lay evidence flat feet"),
        ("Savage v. Gober", "10 Vet. App. 488", "Lay continuity evidence"),
        ("Voerth v. West", "13 Vet. App. 117", "Continuity lay evidence"),
        ("Washington v. Nicholson", "21 Vet. App. 191", "Lay combat evidence"),
        ("McCartt v. West", "12 Vet. App. 164", "Lay AO evidence"),
        ("Grottveit v. Brown", "5 Vet. App. 91", "Lay evidence limits"),
        ("Moray v. Brown", "5 Vet. App. 211", "Lay medical conclusions"),
        ("Routen v. Brown", "10 Vet. App. 183", "Lay nexus limitations"),
        ("Young v. McDonald", "766 F.3d 1348", "Lay competency scope"),
        ("Colantonio v. Shinseki", "606 F.3d 1378", "Lay evidence analysis"),
        ("Robinson v. Shinseki", "557 F.3d 1355", "Lay evidence consideration"),
        ("Kahana v. Shinseki", "24 Vet. App. 428", "Lay testimony evaluation"),
    ],
    "Credibility Assessment": [
        ("Caluza v. Brown", "7 Vet. App. 498", "Credibility factors listed"),
        ("Washington v. Nicholson", "19 Vet. App. 362", "Credibility determination"),
        ("Madden v. Gober", "125 F.3d 1477", "Board credibility authority"),
        ("White v. Principi", "243 F.3d 1378", "Credibility assessment review"),
        ("Smith v. Derwinski", "1 Vet. App. 235", "Self-interest factor"),
        ("Cartright v. Derwinski", "2 Vet. App. 24", "Witness interest"),
        ("Pond v. West", "12 Vet. App. 341", "Lay credibility"),
        ("Dalton v. Nicholson", "21 Vet. App. 23", "Combat credibility"),
        ("Buchanan v. Nicholson", "451 F.3d 1331", "Corroboration not required"),
        ("Maxson v. Gober", "230 F.3d 1330", "Gap credibility impact"),
        ("Forshey v. Principi", "284 F.3d 1335", "Negative evidence"),
        ("Horn v. Shinseki", "25 Vet. App. 231", "Credibility reasons"),
        ("Guerrieri v. Brown", "4 Vet. App. 467", "Evidence weighing"),
        ("Owens v. Brown", "7 Vet. App. 429", "Opinion credibility"),
        ("Gilbert v. Derwinski", "1 Vet. App. 49", "Evidence evaluation"),
        ("Sizemore v. Principi", "18 Vet. App. 264", "Credibility findings"),
        ("Evans v. West", "12 Vet. App. 22", "Consistency factor"),
        ("Swann v. Brown", "5 Vet. App. 229", "History accuracy"),
        ("Prejean v. West", "13 Vet. App. 444", "Medical credibility"),
        ("Reonal v. Brown", "5 Vet. App. 458", "Inaccurate history"),
    ],
    "Medical Opinion Standards": [
        ("Nieves-Rodriguez v. Peake", "22 Vet. App. 295", "Rationale required"),
        ("Stefl v. Nicholson", "21 Vet. App. 120", "Accurate history basis"),
        ("Jones v. Shinseki", "26 Vet. App. 56", "Speculation inadequate"),
        ("Acevedo v. Shinseki", "25 Vet. App. 286", "Opinion adequacy"),
        ("Barr v. Nicholson", "21 Vet. App. 303", "Exam adequacy"),
        ("Reonal v. Brown", "5 Vet. App. 458", "Inaccurate history"),
        ("LeShore v. Brown", "8 Vet. App. 406", "History transcription"),
        ("Swann v. Brown", "5 Vet. App. 229", "Post-service history"),
        ("Prejean v. West", "13 Vet. App. 444", "Claims file access"),
        ("Coburn v. Nicholson", "19 Vet. App. 427", "Nexus specificity"),
        ("Bloom v. West", "12 Vet. App. 185", "Speculative opinions"),
        ("Tirpak v. Derwinski", "2 Vet. App. 609", "May or may not"),
        ("Warren v. Brown", "6 Vet. App. 4", "Opinion probative value"),
        ("Obert v. Brown", "5 Vet. App. 30", "Medical probability"),
        ("Stegman v. Derwinski", "3 Vet. App. 228", "Probability language"),
        ("Bostain v. West", "11 Vet. App. 124", "Medical link"),
        ("Owens v. Brown", "7 Vet. App. 429", "Opinion weighing"),
        ("Guerrieri v. Brown", "4 Vet. App. 467", "Medical evidence weight"),
        ("Colvin v. Derwinski", "1 Vet. App. 171", "Board medical judgment"),
        ("Kowalski v. Nicholson", "19 Vet. App. 171", "Examiner qualifications"),
    ],
    "VA Examination Adequacy": [
        ("McLendon v. Nicholson", "20 Vet. App. 79", "Four-part exam trigger"),
        ("Barr v. Nicholson", "21 Vet. App. 303", "Once provided must be adequate"),
        ("Green v. Derwinski", "1 Vet. App. 121", "Thorough examination"),
        ("Ardison v. Brown", "6 Vet. App. 405", "Active condition exam"),
        ("Snuffer v. Gober", "10 Vet. App. 400", "Current examination need"),
        ("Caffrey v. Brown", "6 Vet. App. 377", "Stale examination"),
        ("Palczewski v. Nicholson", "21 Vet. App. 174", "Exam timing"),
        ("VAOPGCPREC 11-95", "60 Fed. Reg. 43186", "Reexamination"),
        ("Glover v. West", "185 F.3d 1328", "Exam scheduling"),
        ("Cox v. Nicholson", "20 Vet. App. 563", "NP examinations"),
        ("Moore v. Nicholson", "21 Vet. App. 211", "Examiner qualifications"),
        ("Martinak v. Nicholson", "21 Vet. App. 447", "Hearing exam adequacy"),
        ("Correia v. McDonald", "28 Vet. App. 158", "ROM testing"),
        ("Sharp v. Shulkin", "29 Vet. App. 26", "Flare-up estimation"),
        ("DeLuca v. Brown", "8 Vet. App. 202", "Functional loss exam"),
        ("Mitchell v. Shinseki", "25 Vet. App. 32", "Pain evaluation"),
        ("Burton v. Shinseki", "25 Vet. App. 1", "Painful motion"),
        ("Snyder v. Wilkie", "31 Vet. App. 345", "MH examination"),
        ("Malachinski v. Shinseki", "25 Vet. App. 116", "MH exam adequacy"),
        ("Teague v. Shulkin", "26 Vet. App. 461", "Exam adequacy review"),
    ],
    "Benefit of the Doubt": [
        ("Gilbert v. Derwinski", "1 Vet. App. 49", "Benefit of doubt standard"),
        ("Wise v. Shinseki", "26 Vet. App. 517", "Equipoise application"),
        ("Alemany v. Brown", "9 Vet. App. 518", "Reasonable doubt"),
        ("Ortiz v. Principi", "274 F.3d 1361", "Preponderance standard"),
        ("Lynch v. Gober", "11 Vet. App. 22", "Evidence preponderance"),
        ("Dela Cruz v. Principi", "15 Vet. App. 143", "Benefit doubt timing"),
        ("Marcelino v. Shulkin", "29 Vet. App. 155", "Equipoise standard"),
        ("38 U.S.C. 5107(b)", "Various", "Benefit of doubt statute"),
        ("38 CFR 3.102", "Various", "Reasonable doubt regulation"),
        ("Fagan v. Shinseki", "573 F.3d 1282", "Evidence evaluation"),
        ("Counts v. Brown", "6 Vet. App. 473", "Doubt application"),
        ("Prater v. Derwinski", "3 Vet. App. 129", "Reasonable doubt scope"),
        ("Smith v. Derwinski", "1 Vet. App. 235", "Doubt standard"),
        ("Brown v. Gardner", "513 U.S. 115", "Pro-veteran interpretation"),
        ("Sears v. Principi", "349 F.3d 1326", "Statutory construction"),
        ("Delisio v. Shinseki", "25 Vet. App. 45", "Doubt application"),
        ("Gabrielson v. Brown", "7 Vet. App. 36", "Evidence weighing"),
        ("Wray v. Brown", "7 Vet. App. 488", "Doubt resolution"),
        ("Schroeder v. West", "212 F.3d 1265", "Benefit analysis"),
        ("Morton v. West", "12 Vet. App. 477", "Doubt standard review"),
    ],
    "Records and Documentation": [
        ("Bell v. Derwinski", "2 Vet. App. 611", "Constructive possession VA records"),
        ("Golz v. Shinseki", "590 F.3d 1317", "SSA records relevance"),
        ("Murincsak v. Derwinski", "2 Vet. App. 363", "SSA records request"),
        ("Sullivan v. McDonald", "815 F.3d 786", "VA records access"),
        ("Dunn v. West", "11 Vet. App. 462", "VA records custody"),
        ("McGee v. Peake", "511 F.3d 1352", "Federal records duty"),
        ("Baker v. West", "11 Vet. App. 163", "Records development"),
        ("Tetro v. Gober", "14 Vet. App. 100", "Missing records search"),
        ("Cuevas v. Principi", "3 Vet. App. 542", "Record reconstruction"),
        ("O'Hare v. Derwinski", "1 Vet. App. 365", "Lost records heightened"),
        ("Cromer v. Nicholson", "19 Vet. App. 215", "Fire records loss"),
        ("Washington v. Nicholson", "19 Vet. App. 362", "Record reconstruction"),
        ("Moore v. Derwinski", "1 Vet. App. 401", "Development duty"),
        ("Robinette v. Brown", "8 Vet. App. 69", "Evidence submission"),
        ("38 CFR 3.159(c)(2)", "Various", "Federal records duty"),
        ("38 CFR 3.159(c)(3)", "Various", "Private records"),
        ("VAOPGCPREC 16-92", "57 Fed. Reg. 49744", "SSA records"),
        ("Dixon v. Derwinski", "3 Vet. App. 261", "Records duty"),
        ("Counts v. Brown", "6 Vet. App. 473", "Records analysis"),
        ("Nolen v. Gober", "14 Vet. App. 183", "Records failure"),
    ],
    "Combat and Stressors": [
        ("38 U.S.C. 1154(b)", "Various", "Combat veteran presumption"),
        ("Collette v. Brown", "82 F.3d 389", "Combat presumption scope"),
        ("Dalton v. Nicholson", "21 Vet. App. 23", "Combat status determination"),
        ("Reeves v. Shinseki", "682 F.3d 988", "Combat participant analysis"),
        ("Washington v. Nicholson", "21 Vet. App. 191", "Combat evidence"),
        ("Stone v. Nicholson", "480 F.3d 1111", "Combat presumption"),
        ("Cohen v. Brown", "10 Vet. App. 128", "PTSD stressor"),
        ("Moreau v. Brown", "9 Vet. App. 389", "Stressor verification"),
        ("Doran v. Brown", "6 Vet. App. 283", "Stressor evidence"),
        ("Suozzi v. Brown", "10 Vet. App. 307", "Stressor corroboration"),
        ("Pentecost v. Principi", "16 Vet. App. 124", "Unit stressor"),
        ("Moran v. Principi", "17 Vet. App. 149", "Combat medal presumption"),
        ("VAOPGCPREC 12-99", "65 Fed. Reg. 6257", "Combat stressor"),
        ("Sizemore v. Principi", "18 Vet. App. 264", "Stressor sufficiency"),
        ("38 CFR 3.304(f)", "Various", "PTSD SC requirements"),
        ("Dizoglio v. Brown", "9 Vet. App. 163", "Stressor evidence"),
        ("West v. Brown", "7 Vet. App. 70", "Combat zone evidence"),
        ("Zarycki v. Brown", "6 Vet. App. 91", "Stressor verification"),
        ("Wilson v. Derwinski", "2 Vet. App. 614", "Stressor types"),
        ("Hayes v. Brown", "5 Vet. App. 60", "Combat evidence weight"),
    ],
}

def generate_entries():
    """Generate CAVC evidence entries"""
    entries = []
    entry_id = 1
    
    for category, cases in CAVC_EVIDENCE.items():
        for case_name, citation, holding in cases:
            entry = {
                "id": f"cavc_evid_{entry_id:05d}",
                "source": "cavc",
                "citation": citation,
                "title": f"{case_name} - {category}",
                "content": f"""
CAVC EVIDENCE PRECEDENT

CASE: {case_name}
CITATION: {citation}
TOPIC: {category}

HOLDING:
{holding}

EVIDENCE FRAMEWORK:
VA must consider all evidence of record and apply benefit of doubt.

APPLICATION:
This case governs how evidence is evaluated in VA claims.
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
    print("⚖️ CAVC EVIDENCE DATABASE")
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
    output_file = OUTPUT_DIR / "cavc_evidence.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")

if __name__ == "__main__":
    main()
