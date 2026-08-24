# Combat Service Determination

When Vet-Rate.org reads your service records, it works out one thing separately from everything else: whether your record establishes that you **engaged in combat with the enemy**. That single finding changes what evidence the VA requires from you, so the app decides it from VA's own published list rather than by guessing at keywords.

<div class="crisis-banner">
🆘 <strong>Veterans Crisis Line:</strong> Call 988, Press 1 | Text 838255 | Available 24/7
</div>

---

## Why It Matters

If VA accepts that you engaged in combat, two rules open up:

| Rule                     | What it does for you                                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **38 U.S.C. § 1154(b)**  | VA must accept satisfactory lay evidence that an injury or disease was incurred in service if it's consistent with the circumstances of combat - **even when there is no entry in your service treatment records**. Your own account can carry the in-service event. |
| **38 CFR § 3.304(f)(2)** | For PTSD, a stressor related to combat is **conceded**. You don't have to separately corroborate that the stressor happened.                                                                                                                                         |

Both of those are the difference between "we can't find a record of it" and a granted claim. That's why the app treats this as a finding worth getting exactly right, in both directions - it should never miss a decoration you earned, and it should never tell you that you have combat status you can't actually claim.

---

## What Establishes Combat

The app uses the list VA's own adjudicators use: **M21-1, Part VIII, Subpart iv, 1.A.3.h — "Individual Decorations as Evidence of Combat Participation."** Receipt of any decoration on that list creates a presumption you engaged in combat with the enemy, unless there is clear and convincing evidence to the contrary.

=== "Badges & Insignia"

    - Combat Action Badge (CAB)
    - Combat Infantry/Infantryman Badge (CIB)
    - Combat Medical Badge
    - Combat Action Ribbon (CAR)
    - Combat Aircrew Insignia
    - Fleet Marine Force (FMF) Combat Operations Insignia
    - Parachutist Badge **with Combat Jump Device**

=== "Valor Decorations"

    - Medal of Honor
    - Distinguished Service Cross
    - Navy Cross
    - Air Force Cross
    - Silver Star
    - Distinguished Flying Cross
    - Purple Heart
    - Air Force Combat Action Medal

=== "Awards With a Device"

    These count **only** when the valor device is present:

    - Bronze Star Medal with "V" Device
    - Air Medal with "V" Device
    - Army Commendation Medal with "V" Device
    - Navy Commendation Medal with "V" Device
    - Air Force Commendation Medal with "V" Device
    - Air Force Achievement Medal with "V" Device
    - Joint Service Commendation Medal with "V" Device
    - The **"C" device**, denoting combat conditions, on any award for meritorious service or achievement

!!! note "A Bronze Star on its own is not a combat decoration"
The Bronze Star Medal is awarded for meritorious service as well as for valor. VA's list names it only in its **"V" device** form, and the app follows that. If your award carries the "V", make sure the device is recorded - either on the ribbon in your Service tab, or written into the award's name as your DD214 spells it (for example `ARCOM W/ V DEVICE`).

---

## What Does _Not_ Establish Combat

Campaign, expeditionary, and service medals are **deliberately absent** from VA's list, and the app will not present them as proof of combat:

- Afghanistan Campaign Medal, Iraq Campaign Medal, and other campaign medals
- Global War on Terrorism Expeditionary Medal
- Global War on Terrorism Service Medal
- Overseas Service Ribbon
- National Defense Service Medal
- Korea Defense Service Medal

A Global War on Terrorism Service Medal is awarded for serving during the period - it went to nearly everyone who served post-9/11. Treating it as combat proof would overstate your record.

These awards still matter, so the app reports them separately as **supporting evidence of service in a combat theater**, labelled as corroborating your _presence_, not your _participation_. That distinction matters when a VSO or a rater reads your packet.

!!! info "Imminent danger and hostile fire pay"
Hostile-fire or imminent-danger pay recorded in your DD214 remarks is reported too, but it evidences service in an area of hostile military or terrorist activity (M21-1, Part VIII, Subpart iv, 1.A.3.i) - a different and weaker showing than engaging in combat. It won't, by itself, mark you as a combat veteran.

!!! warning "The list is not the only way"
M21-1 says plainly that receipt of one of these decorations "is not the only acceptable evidence of engagement in combat." If you engaged in combat but hold none of the decorations above, you can still establish it another way - unit records, buddy statements, after-action reports. The app can't detect that automatically. Talk to a VSO.

---

## Where You'll See It

### While Reviewing a Document

When Muster Call or the DD214 Analyzer reads a service record whose Block 13 names a qualifying decoration, the review screen shows a **Combat Service Indicators** panel naming what established it and citing the rule, with any theater evidence listed separately underneath.

Documents that establish nothing don't get an empty panel - if a page of your DD214 set has no Block 13, it simply says nothing on the subject, rather than asking you to verify a blank finding.

### In My Packet

Your Service tab carries the finding as a standing part of your record:

![My Packet Service tab showing the Combat Service Verified card with a Combat Action Badge](../assets/images/screenshots/my-packet/combat-service-card.png)
_The Combat Service card sits with the rest of your DD214 summary, naming the decoration that established the finding and the rule it invokes. Sample record shown._

### In the AI Tools

Once established, your combat status is part of the context every AI tool receives, along with the rule that applies. Tools that draft statements or assess your claim know that lay evidence is sufficient for an in-service combat event, and that a combat PTSD stressor is conceded, without you having to explain it each time.

---

## How It Survives a Multi-Page DD214

Veterans routinely have several discharge documents, and often only one of them carries Block 13. The finding is **sticky**: once a document establishes combat, a later page that simply doesn't mention decorations cannot retract it. Findings from different documents are combined, so a Purple Heart on one and a CAB on another both end up on your record.

---

## If It's Wrong

Extraction from a scanned document is imperfect - see [Muster Call](muster-call.md) for how the app reads scans and where it struggles.

- **Missing a decoration you earned?** Add the award manually in the **Service** tab of My Packet and tick "Combat-Related Award". The card picks it up from your award list.
- **Showing something you didn't earn?** Delete the award from the Service tab. Nothing about the finding is fixed - it's derived from your award list every time it's displayed.

---

## Important Disclaimer

!!! warning "No Guarantee of Outcome"
This app reads your documents and applies VA's published decoration list, but **the combat determination shown here is not a VA decision**. Only VA decides whether you engaged in combat with the enemy, and it decides on your whole record. Always have a Veterans Service Officer (VSO) or VA-accredited attorney [review your evidence before filing](https://www.va.gov/ogc/apps/accreditation/). Verify every extracted award against your original DD214.
