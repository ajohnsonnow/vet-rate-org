# ADR-011: how the calculator reads 38 CFR 4.26 (bilateral factor)

**Status:** Accepted as implemented. Sections 3 and 4 are interpretations, not settled law: each needs confirmation by the owner or an accredited Veterans Service Officer.
**Date:** 2026-10-06.
**Decided under:** owner approval to bring `calculateVARating` into line with 38 CFR 4.26, and the coordinator's instruction to keep the six readings below as implemented and record them for confirmation.

## 1. Context

`calculateVARating` in `src/utils/vaCalculator.js` is the one place the app works out a combined rating. Its result is shown to veterans as fact in the Tactical Calculator, My Packet, the Million Dollar Dashboard, the What-If Sandbox, Secondary Scout, State Benefit Hunter, Time Machine and Retro Pay Hunter, and it replaces an AI answer that contradicts it (`src/utils/raterGrounding.js`, `enforceCalculatorOnResult`).

Most of 38 CFR 4.26 is explicit and is implemented as written. In six places the regulation text does not settle the answer and the calculator has to pick one. This ADR records each pick, the text it rests on, and what would change if the reading is wrong.

## 2. The text relied on

Source: the app's eCFR legal index, `public/legal-index/v0.1.0/chunks/ecfr.jsonl`, ids `ecfr_38_CFR_§_4.26_0` and `ecfr_38_CFR_§_4.26_1`, fetched 2026-07-10. The M21-1 passage is from `public/dkb-index/m21_1/chunks.part0.jsonl`, section V.iv.1.C.4.b (change date April 18, 2023).

**38 CFR 4.26, introduction.** "Except as provided in paragraph (d) of this section, when a partial disability results from disease or injury of both arms, or of both legs, or of paired skeletal muscles, the ratings for the disabilities of the right and left sides will be combined as usual, and 10 percent of this value will be added ( i.e., not combined) before proceeding with further combinations, or converting to degree of disability. The bilateral factor will be applied to such bilateral disabilities before other combinations are carried out and the rating for such disabilities including the bilateral factor in this section will be treated as one disability for the purpose of arranging in order of severity and for all further combinations. For example, with disabilities evaluated at 60 percent, 20 percent, 10 percent and 10 percent (with the two 10 percent evaluations being bilateral disabilities), the order of severity would be 60, 21 and 20. The 60 and 21 combine to 68 percent and the 68 and 20 combine to 74 percent, converted to 70 percent as the final degree of disability."

**4.26(a).** "The use of the terms "arms" and "legs" is not intended to distinguish between the arm, forearm and hand, or the thigh, leg, and foot, but relates to the upper extremities and lower extremities as a whole. Thus with a compensable disability of the right thigh, for example, amputation, and one of the left foot, for example, pes planus, the bilateral factor applies, and similarly whenever there are compensable disabilities affecting use of paired extremities regardless of location or specified type of impairment."

**4.26(b).** "The correct procedure when applying the bilateral factor to disabilities affecting both upper extremities and both lower extremities is to combine the ratings of the disabilities affecting the 4 extremities in the order of their individual severity and apply the bilateral factor by adding, not combining, 10 percent of the combined value thus attained."

**4.26(c).** "The bilateral factor is not applicable unless there is partial disability of compensable degree in each of 2 paired extremities, or paired skeletal muscles."

**4.26(d).** "In cases where the combined evaluation is lower than what could be achieved by not including one or more bilateral disabilities in the bilateral factor calculation, those bilateral disabilities will be removed from the bilateral factor calculation and combined separately, to achieve the combined evaluation most favorable to the veteran."

**M21-1 V.iv.1.C.4.b.** "The bilateral factor only applies when there are qualifying disabilities of the left and right sides. When a specific DC provides one evaluation for a bilateral condition, only apply the bilateral factor if there is/are an independently ratable condition in one of the involved extremities, such as in the case of a 20-percent evaluation for left leg muscle damage under 38 CFR 4.73, DC 5311, in addition to a 30-percent evaluation for bilateral pes planus under 38 CFR 4.71a, DC 5276, or independently ratable conditions of both uninvolved extremities, such as in the case of two separate 20-percent evaluations for right and left shoulder osteoarthritis under 38 CFR 4.71a, DCs 5201, in addition to a 30-percent evaluation for bilateral pes planus under 38 CFR 4.71a, DC 5276." On paragraph (d): "The bilateral factor will still be applied to the bilateral disability or disabilities that are not excluded from the calculation."

## 3. Readings of 38 CFR 4.26 that need confirmation

Each row is an interpretation. "If wrong" says which way the calculator's figure would move.

| #   | Question the text leaves open                                                                                        | What the calculator does                                                                                                                                                                   | Rests on                                                                                                                                                                                                                               | If wrong                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Under (d), after a bilateral disability is removed, may the factor stay on what is left if that is only one side?    | No. What stays in the factor calculation must still be a group under (a) to (c): a compensable disability on each side.                                                                    | The worked example in the introduction: 60, 20, 10, 10 gives 70. Keeping the factor on one 10 alone (11) gives 60, 20, 11, 10: 68, 72, 75, which rounds to 80, so that reading contradicts the regulation's own example.               | The M21-1 words "disability or disabilities that are not excluded" could be read the other way. If VA does that, some results would be 10 points higher. |
| R2  | Under (d), is "combined evaluation" the figure before or after the final rounding to the nearest 10?                 | After. The whole group stays unless another arrangement gives a higher evaluation once rounded. A higher unrounded value with the same rounded rating changes nothing.                     | (d) speaks of the "combined evaluation ... most favorable to the veteran"; 4.25 uses "combined value" for the unrounded figure and "degree of disability" for the rounded one. The evaluation a veteran is paid on is the rounded one. | No change to any final rating; only the unrounded "raw score" shown beside it could differ.                                                              |
| R3  | Two evaluations that each cover both sides, one for the arms and one for the legs, and nothing else: does (b) apply? | No factor. Both entries are reported to the veteran (`single-bilateral-evaluation`).                                                                                                       | M21-1 requires, for a one-evaluation bilateral condition, an "independently ratable condition" in an involved extremity or in "both uninvolved extremities". Neither evaluation here is a separately rated condition of one extremity. | (b) read literally ("disabilities affecting both upper extremities and both lower extremities") would give the factor; results would be higher.          |
| R4  | Two evaluations that each cover both sides, both for the same limbs (for example both legs): does the factor apply?  | Yes. Each is treated as an independently ratable condition of the extremities the other involves. The explanation text says this is Vet-Rate's reading and that M21-1 does not address it. | The same M21-1 sentence: "an independently ratable condition in one of the involved extremities". A second evaluation of the same limbs is such a condition.                                                                           | Results for this combination would be lower.                                                                                                             |

## 4. One evaluation that covers both sides

These two follow M21-1 V.iv.1.C.4.b directly, so they are less open than section 3, but M21-1 is VA's internal manual, not the regulation, and they change what a veteran sees. They are recorded here for the same confirmation.

**The lone both-sides entry decision.** An entry with side "bilateral" (the form's "Both (Bilateral)" option, or a decision-letter name that says "bilateral") is one evaluation that already covers both sides. By itself, or beside only unrelated conditions, it takes no bilateral factor. Before this work it took the factor alone: a single 50 percent entry became 55 and rounded to 60. It is now 50, and the veteran is told why and told to enter each side separately if each side has its own rating.

**The single both-sides evaluation rule.** Such an entry takes the factor in two cases, both from the M21-1 examples:

- alongside any other compensable, separately rated disability of the same limbs (left leg muscle damage 20 with bilateral pes planus 30: 44, plus 4.4, is 48);
- when the other two limbs form a pair of their own, in which case all are combined under one factor as 4.26(b) directs (right and left shoulder 20 and 20 with bilateral pes planus 30: 55, plus 5.5, is 61).

A both-sides entry for a part that is not a limb (hearing, eyes, kidneys) never takes the factor.

## 5. Related choices that are not readings of the regulation

Recorded so they are not mistaken for law:

- **Compensable means 10 percent or more.** (c) says "compensable degree"; the calculator tests `rating >= 10`.
- **The group with its factor is capped at 100.** Left knee 90 and right knee 50 combine to 95; adding 10 percent would give 105. The stored and printed group value is 100.
- **Which limb an entry is in.** The regulation assumes the rater knows. The calculator takes an explicit `limb`, then the form's body part, then the entry's name. The name is read against an allowlist of limb parts and musculoskeletal or peripheral-nerve terms; any other word means the limb is not established, the entry takes no factor, and it is reported so the veteran can set the body part. This errs toward understating with a notice, never toward granting a factor on a guess.
- **Paired skeletal muscles outside the limbs** (torso or neck muscle groups) are named in 4.26 but not modelled. Such entries take no factor and are reported.
- **Skin conditions.** M21-1 V.iii.10.1.h limits the factor for skin conditions to diagnostic codes 7801 and 7802. The calculator has no diagnostic codes; a name with a skin or scar word is outside the allowlist and takes no factor.

## 6. Consequences

- Every screen that shows a combined rating uses this one implementation; the What-If Sandbox and Retro Pay Hunter no longer pair conditions by their own rules.
- Where the calculator cannot tell, it applies no factor and lists the entry in `bilateralIssues` with a reason; the screens show that list.
- Pinned by `src/__tests__/utils/vaCalculatorBilateral.test.js` (R1 to R4 and section 4 each have a named test with the arithmetic in its title), `vaCalculatorTableI.test.js`, `vaCalculatorLimits.test.js` and `bilateralCompliance.test.js`.

## 7. What confirmation would change

If the owner or a VSO finds a reading wrong, the change is confined to `_formBilateralGroup` (R3, R4, section 4) or `_mostFavourableGroup` (R1, R2) in `src/utils/vaCalculator.js`, the matching sentence in `src/utils/raterGrounding.js`, and the named tests. Until then the app states its result with the instruction it already gives: check the figures with a Veterans Service Officer before relying on them.
