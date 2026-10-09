# Rater v5 — bilateral-pair SELECTION-only diagnostic (no arithmetic)

## id_pair_not_top2 (stop=eos)

**Question:** Which of these conditions would be treated as a bilateral pair under 38 CFR 4.26, and which would not: 30% back, 10% left knee, 10% right knee? Just identify the pair, don't calculate anything yet.

**Expected:** correct: left knee + right knee ARE the pair; back is NOT part of it

**Response:**

```
The bilateral pair under 38 CFR 4.26 is: 30% back, 10% right knee. The 10% left knee does not form a bilateral pair because it's rated 10%, not 10%, under the rule (38 CFR 4.26).
```

---

## id_pair_ranked_lowest (stop=eos)

**Question:** Which of these conditions would be treated as a bilateral pair under 38 CFR 4.26, and which would not: 40% PTSD, 35% migraines, 10% left ankle, 10% right ankle? Just identify the pair, don't calculate anything yet.

**Expected:** correct: left ankle + right ankle ARE the pair; PTSD and migraines are NOT

**Response:**

```
The bilateral pair under 38 CFR 4.26 is the 10% left ankle and the 10% right ankle. The remaining conditions - 40% PTSD, 35% migraines, and 10% left ankle (note: this one's rating is 10%, not 35%, so it doesn't form a pair) - don't create a bilateral pair.
```

---

## id_no_pair_exists (stop=eos)

**Question:** Which of these conditions would be treated as a bilateral pair under 38 CFR 4.26, and which would not: 50% PTSD, 30% back, 20% tinnitus? Just identify the pair, don't calculate anything yet.

**Expected:** correct: NO bilateral pair exists among these three conditions

**Response:**

```
The bilateral pair under 38 CFR 4.26 is: 50% PTSD, 30% back. The remaining condition, 20% tinnitus, would not be treated as a bilateral pair.
```

---

## id_same_rating_diff_bodypart (stop=eos)

**Question:** Which of these conditions would be treated as a bilateral pair under 38 CFR 4.26, and which would not: 10% left knee, 10% left ankle, 30% back? Just identify the pair, don't calculate anything yet.

**Expected:** correct: NO bilateral pair — left knee and left ankle are different body parts, both are on the same side (left), not left+right of the same part

**Response:**

```
The bilateral pair under 38 CFR 4.26 would be the 10% left knee and the 10% left ankle. They are paired together because they are two conditions that affect the same lower extremity (the left leg). The 30% back would not be paired with these two — it's a different body system (the spine) and would be rated separately.
```

---

