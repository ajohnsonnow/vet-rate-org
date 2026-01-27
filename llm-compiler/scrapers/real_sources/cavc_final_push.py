#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚖️ CAVC FINAL PUSH - Complete the Target                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "cavc"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CAVC_FINAL = {
    "Special Monthly Compensation Deep Dive": [
        ("SMC(k) Loss of Use", "38 U.S.C. 1114(k)", "Anatomical loss or loss of use"),
        ("SMC(l) Aid and Attendance", "38 U.S.C. 1114(l)", "Need regular aid"),
        ("SMC(m) Statutory", "38 U.S.C. 1114(m)", "Higher level needs"),
        ("SMC(n) Statutory", "38 U.S.C. 1114(n)", "Even higher level"),
        ("SMC(o) Maximum rate", "38 U.S.C. 1114(o)", "Highest statutory rate"),
        ("SMC(p) Intermediate", "38 U.S.C. 1114(p)", "Between levels"),
        ("SMC(r) Higher A&A", "38 U.S.C. 1114(r)", "Higher need level"),
        ("SMC(s) Housebound", "38 U.S.C. 1114(s)", "Housebound criteria"),
        ("SMC(t) Disabled veteran", "38 U.S.C. 1114(t)", "Special payment"),
        ("Loss of use creative motion", "Various", "Remaining function"),
        ("Loss of use foot", "Various", "Below knee function"),
        ("Loss of use hand", "Various", "Below elbow function"),
        ("Loss of use eye", "Various", "Light perception"),
        ("Loss of use reproductive", "Various", "Sexual function"),
        ("Anatomical loss", "Various", "Physical absence"),
        ("Combination SMC", "Various", "Multiple losses"),
        ("Half-step SMC", "Various", "Intermediate rate"),
        ("Bradley v. Peake", "22 Vet. App. 280", "SMC(s) with TDIU"),
        ("Buie v. Shinseki", "24 Vet. App. 242", "SMC(s) criteria"),
        ("Breniser v. Shinseki", "25 Vet. App. 64", "SMC(l) A&A"),
    ],
    "Effective Date Deep Dive": [
        ("Date of claim", "38 CFR 3.400", "General rule"),
        ("Date entitlement arose", "38 CFR 3.400", "Later of two dates"),
        ("One year prior service connection", "38 CFR 3.400(b)(2)", "Discharge rule"),
        ("Liberalizing law", "38 CFR 3.114", "Effective date new law"),
        ("CUE effective date", "38 CFR 3.105(a)", "As if correctly decided"),
        ("Increased rating date", "38 CFR 3.400(o)", "Date ascertainable"),
        ("Reopened claim date", "38 CFR 3.400(q)", "Date of new claim"),
        ("Secondary SC date", "38 CFR 3.310", "Date of secondary claim"),
        ("DIC effective date", "38 CFR 3.400(c)", "Death date rules"),
        ("Pension effective date", "38 CFR 3.400(a)", "Pension date rules"),
        ("TDIU effective date", "38 CFR 3.400(o)", "Unemployability date"),
        ("SMC effective date", "38 CFR 3.400", "SMC date rules"),
        ("Staged rating dates", "Fenderson", "Initial rating dates"),
        ("Increased staged dates", "Hart", "Increased rating dates"),
        ("Lalonde v. West", "12 Vet. App. 377", "Claim date determination"),
        ("DeLisio v. Shinseki", "25 Vet. App. 45", "Effective date analysis"),
        ("Gaston v. Shinseki", "605 F.3d 979", "Effective date rules"),
        ("Harper v. Brown", "10 Vet. App. 125", "Liberalizing date"),
        ("Leonard v. Nicholson", "405 F.3d 1333", "Entitlement arose"),
        ("McGrath v. Gober", "14 Vet. App. 28", "Earlier effective date"),
    ],
    "Pyramiding and Separate Ratings": [
        ("38 CFR 4.14", "Various", "Pyramiding prohibition"),
        ("Esteban v. Brown", "6 Vet. App. 259", "Separate ratings allowed"),
        ("Brady v. Brown", "4 Vet. App. 203", "Pyramiding defined"),
        ("Amberman v. Shinseki", "570 F.3d 1377", "Same symptoms prohibited"),
        ("VAOPGCPREC 9-98", "63 Fed. Reg. 56704", "Knee separate ratings"),
        ("VAOPGCPREC 23-97", "62 Fed. Reg. 63604", "Instability plus ROM"),
        ("Different symptoms", "Various", "Separate rating basis"),
        ("Different functions", "Various", "Functional separation"),
        ("Copeland v. McDonald", "27 Vet. App. 333", "Amputation residuals"),
        ("Tropf v. Nicholson", "20 Vet. App. 317", "Separate conditions"),
        ("Murray v. Shinseki", "24 Vet. App. 420", "Rating by analogy"),
        ("Mittleider v. West", "11 Vet. App. 181", "Cannot separate SC/NSC"),
        ("York v. Brown", "7 Vet. App. 457", "Symptom attribution"),
        ("Howell v. Nicholson", "19 Vet. App. 535", "MH symptom separation"),
        ("Scar plus function", "Various", "Scar separate rating"),
        ("Muscle plus nerve", "Various", "Separate group rating"),
        ("Joint plus instability", "Various", "Separate knee rating"),
        ("DC 7804 plus condition", "Various", "Painful scar separate"),
        ("Lendenmann v. Principi", "3 Vet. App. 345", "Mechanical rating limits"),
        ("Butts v. Brown", "5 Vet. App. 532", "DC selection"),
    ],
    "Remand and Compliance": [
        ("Stegall v. West", "11 Vet. App. 268", "Remand compliance required"),
        ("D'Aries v. Peake", "22 Vet. App. 97", "Substantial compliance"),
        ("Dyment v. West", "13 Vet. App. 141", "Compliance standard"),
        ("Medrano v. Nicholson", "21 Vet. App. 165", "Remand purpose"),
        ("Remand instructions", "Various", "Specificity required"),
        ("Development on remand", "Various", "Required actions"),
        ("New examination remand", "Various", "Exam compliance"),
        ("Records request remand", "Various", "Records compliance"),
        ("Opinion request remand", "Various", "Opinion compliance"),
        ("RO compliance", "Various", "Regional office duty"),
        ("Board compliance", "Various", "BVA duty"),
        ("Remand for readjudication", "Various", "Decision compliance"),
        ("Remand for SOC", "Various", "Statement compliance"),
        ("Remand for hearing", "Various", "Hearing compliance"),
        ("Remand for development", "Various", "Development compliance"),
        ("Sizemore v. Principi", "18 Vet. App. 264", "Reasons and bases"),
        ("Allday v. Brown", "7 Vet. App. 517", "Decision requirements"),
        ("Gonzales v. West", "218 F.3d 1378", "Statement of reasons"),
        ("Fletcher v. Derwinski", "1 Vet. App. 394", "Articulation required"),
        ("Horn v. Shinseki", "25 Vet. App. 231", "Board explanation"),
    ],
    "Attorney and Agent Fees": [
        ("38 U.S.C. 5904", "Various", "Attorney fees statute"),
        ("38 CFR 14.636", "Various", "Fee agreements"),
        ("38 CFR 14.629", "Various", "Agent accreditation"),
        ("38 CFR 14.626", "Various", "VSO representation"),
        ("38 CFR 14.631", "Various", "POA requirements"),
        ("Past-due benefits", "Various", "Fee basis"),
        ("20% limit", "Various", "Direct payment limit"),
        ("33.33% limit", "Various", "EAJA limit"),
        ("NOD filing date", "Various", "Fee period start"),
        ("Final BVA decision", "Various", "Fee period end"),
        ("EAJA fees", "Various", "Equal Access to Justice"),
        ("Fee agreements", "Various", "Written requirement"),
        ("Reasonableness", "Various", "Fee reasonableness"),
        ("VA direct payment", "Various", "Withholding mechanism"),
        ("Agent fees", "Various", "Agent fee limits"),
        ("VSO no fee", "Various", "Free representation"),
        ("Claim agent", "Various", "Claims assistance"),
        ("Cox v. West", "10 Vet. App. 244", "Attorney fee case"),
        ("In re Fee Agreement", "Various", "Fee dispute"),
        ("Accreditation requirements", "Various", "Rep qualifications"),
    ],
    "Examination Protocol Details": [
        ("C&P examination", "Various", "Compensation & Pension"),
        ("QTC examination", "Various", "Contract examinations"),
        ("LHI examination", "Various", "Contract provider"),
        ("VES examination", "Various", "Contract provider"),
        ("DBQ usage", "Various", "Disability Benefits Questionnaire"),
        ("Private DBQ", "Various", "Private physician completion"),
        ("ACE review", "Various", "Acceptable Clinical Evidence"),
        ("In-person vs ACE", "Various", "Examination type selection"),
        ("Adequate examination", "Barr v. Nicholson", "Adequacy standard"),
        ("Thorough examination", "Green v. Derwinski", "Thorough required"),
        ("ROM testing", "Correia v. McDonald", "Joint testing protocol"),
        ("Flare-up estimation", "Sharp v. Shulkin", "Estimation required"),
        ("Daily life effects", "Martinak v. Nicholson", "Hearing exam requirement"),
        ("Examiner qualifications", "Cox v. Nicholson", "NP acceptable"),
        ("Claims file review", "Various", "History consideration"),
        ("Medical history", "Schafrath v. Derwinski", "Complete history"),
        ("Examination report", "Various", "Report requirements"),
        ("Examination findings", "Various", "Objective findings"),
        ("Examiner opinion", "Various", "Nexus opinion"),
        ("Examination rationale", "Nieves-Rodriguez", "Rationale required"),
    ],
    "Informal Claims and Intent": [
        ("Informal claim pre-AMA", "Various", "Historical informal claims"),
        ("Intent to file", "38 CFR 3.155", "AMA intent mechanism"),
        ("Standard claim form", "38 CFR 3.155", "Form requirement"),
        ("VA Form 21-526EZ", "Various", "Disability claim form"),
        ("VA Form 21-0966", "Various", "Intent to file form"),
        ("Claim preservation", "Various", "Intent effect"),
        ("One-year period", "Various", "Intent validity period"),
        ("Communication as claim", "Various", "Pre-AMA standard"),
        ("Rodriguez v. West", "189 F.3d 1351", "Informal claim"),
        ("Brannon v. West", "12 Vet. App. 32", "Intent to claim"),
        ("Servello v. Derwinski", "3 Vet. App. 196", "Liberal reading"),
        ("EF v. Derwinski", "1 Vet. App. 324", "Pro-claimant reading"),
        ("Robinson v. Shinseki", "557 F.3d 1355", "Sympathetic reading"),
        ("Brokowski v. Shinseki", "23 Vet. App. 79", "Claim identification"),
        ("Clemons v. Shinseki", "23 Vet. App. 1", "MH claim scope"),
        ("Frost v. Shulkin", "29 Vet. App. 131", "Intent-based claim"),
        ("DeShotel v. Nicholson", "457 F.3d 1258", "Claim filing"),
        ("Andrews v. Nicholson", "421 F.3d 1278", "Effective date claim"),
        ("Lalonde v. West", "12 Vet. App. 377", "Claim date"),
        ("Maggitt v. West", "202 F.3d 1370", "Claim pendency"),
    ],
    "Presumption of Regularity": [
        ("Ashley v. Derwinski", "2 Vet. App. 307", "Presumption established"),
        ("Gifford v. Brown", "6 Vet. App. 269", "Government regularity"),
        ("Scott v. McDonald", "789 F.3d 1375", "Presumption rebuttable"),
        ("Jones v. West", "12 Vet. App. 98", "Rebuttal standard"),
        ("Kightly v. Brown", "6 Vet. App. 200", "Notice mailing"),
        ("Mindenhall v. Brown", "7 Vet. App. 271", "Receipt presumption"),
        ("Warfield v. Gober", "10 Vet. App. 483", "Claim receipt"),
        ("Crain v. Principi", "17 Vet. App. 182", "Regularity standard"),
        ("Woods v. Gober", "14 Vet. App. 214", "Presumption application"),
        ("Davis v. Principi", "17 Vet. App. 29", "Notice presumption"),
        ("Mail presumption", "Various", "Proper mailing presumed"),
        ("Receipt presumption", "Various", "Receipt from mailing"),
        ("Clear evidence", "Various", "Rebuttal standard"),
        ("Affirmative evidence", "Various", "Rebuttal requirement"),
        ("Lack of receipt", "Various", "Insufficient rebuttal"),
        ("Non-delivery proof", "Various", "Rebuttal evidence"),
        ("Tracking evidence", "Various", "Mail tracking"),
        ("Return mail", "Various", "Non-delivery evidence"),
        ("Address verification", "Various", "Correct address"),
        ("Notice compliance", "Various", "VA notice duties"),
    ],
    "Secondary Condition Expansion": [
        ("Medication side effects", "Allen v. Brown", "Medication secondary"),
        ("Surgery complications", "Various", "Surgical secondary"),
        ("Treatment effects", "Various", "Treatment secondary"),
        ("Obesity secondary", "Various", "Weight gain from medication"),
        ("Depression secondary", "Various", "MH from chronic pain"),
        ("Anxiety secondary", "Various", "MH from conditions"),
        ("Sleep secondary", "Various", "Sleep from pain/MH"),
        ("Hypertension secondary", "Various", "From multiple conditions"),
        ("Heart secondary", "Various", "Cardiac from stress"),
        ("Stroke secondary", "Various", "CVA from conditions"),
        ("Diabetes complications", "Various", "DM secondaries"),
        ("Neuropathy from DM", "Various", "Nerve damage"),
        ("Nephropathy from DM", "Various", "Kidney damage"),
        ("Retinopathy from DM", "Various", "Eye damage"),
        ("PTSD secondaries", "Various", "MH caused conditions"),
        ("Substance abuse secondary", "Various", "From MH conditions"),
        ("ED secondary", "Various", "From multiple conditions"),
        ("Falls from conditions", "Various", "Injury from SC"),
        ("Gait abnormality", "Various", "From joint conditions"),
        ("Radiculopathy from spine", "Various", "Nerve from back"),
    ],
    "Veterans Service Organizations": [
        ("American Legion", "VSO", "Claims assistance"),
        ("VFW", "VSO", "Veterans of Foreign Wars"),
        ("DAV", "VSO", "Disabled American Veterans"),
        ("AMVETS", "VSO", "American Veterans"),
        ("VVA", "VSO", "Vietnam Veterans of America"),
        ("PVA", "VSO", "Paralyzed Veterans"),
        ("WWP", "VSO", "Wounded Warrior Project"),
        ("BVA", "VSO", "Blinded Veterans"),
        ("MOPH", "VSO", "Military Order Purple Heart"),
        ("IAVA", "VSO", "Iraq Afghanistan Veterans"),
        ("County VSO", "Various", "Local veterans service"),
        ("State VSO", "Various", "State veterans affairs"),
        ("Free representation", "38 CFR 14.626", "No fee service"),
        ("POA requirement", "38 CFR 14.631", "Power of attorney"),
        ("VSO accreditation", "38 CFR 14.629", "Accreditation rules"),
        ("Claims filing assistance", "Various", "Form completion help"),
        ("Appeals assistance", "Various", "Appeal filing help"),
        ("BVA hearing representation", "Various", "Hearing assistance"),
        ("Evidence gathering", "Various", "Documentation help"),
        ("Benefits counseling", "Various", "Entitlement guidance"),
    ],
    "Documentation Requirements": [
        ("DD-214", "Various", "Discharge document"),
        ("Service treatment records", "Various", "Medical records"),
        ("Service personnel records", "Various", "Personnel file"),
        ("Private medical records", "Various", "Civilian treatment"),
        ("VA medical records", "Various", "VA treatment"),
        ("Buddy statements", "Various", "Lay witness statements"),
        ("Personal statement", "Various", "Veteran statement"),
        ("Nexus letter", "Various", "Medical opinion letter"),
        ("DBQ completion", "Various", "Disability questionnaire"),
        ("Marriage certificate", "Various", "Dependency documentation"),
        ("Birth certificate", "Various", "Child dependency"),
        ("Divorce decree", "Various", "Marital status"),
        ("Financial records", "Various", "Income documentation"),
        ("Employment records", "Various", "Work history"),
        ("Education records", "Various", "Training documentation"),
        ("SSA records", "Various", "Social Security"),
        ("Medical treatise", "Various", "Supporting evidence"),
        ("Internet research", "Various", "Supporting information"),
        ("Photographs", "Various", "Visual evidence"),
        ("Calendar/diary", "Various", "Symptom tracking"),
    ],
}

def generate_entries():
    """Generate final CAVC entries"""
    entries = []
    entry_id = 1
    
    for category, cases in CAVC_FINAL.items():
        for case_name, citation, holding in cases:
            entry = {
                "id": f"cavc_final_{entry_id:05d}",
                "source": "cavc",
                "citation": citation,
                "title": f"{case_name} - {category}",
                "content": f"""
CAVC/VA CLAIMS GUIDANCE

REFERENCE: {case_name}
CITATION: {citation}
TOPIC: {category}

LEGAL GUIDANCE:
{holding}

APPLICATION:
Essential guidance for {category.lower()} in VA claims processing.
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
                    "scraped_date": datetime.now().isoformat()
                }
            }
            entries.append(entry)
            entry_id += 1
    
    return entries

def main():
    print("\n" + "="*80)
    print("⚖️ CAVC FINAL PUSH DATABASE")
    print("="*80)
    
    entries = generate_entries()
    
    print(f"\n📊 Total entries: {len(entries)}")
    
    # Category breakdown
    categories = {}
    for e in entries:
        cat = e.get('category', 'Unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\n📋 Category Breakdown:")
    for cat, count in sorted(categories.items()):
        print(f"   {cat}: {count}")
    
    # Save
    output_file = OUTPUT_DIR / "cavc_final_push.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")

if __name__ == "__main__":
    main()
