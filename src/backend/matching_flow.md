# Matching Flow and Details

## Signals
- amount - hard gate, must match exactly
- vendor - fuzzy (RapidFuzz max(WRatio, partial_ratio), domain-suffix stripped, alias normalized), contributes to confidence. For each **statement line**, similarity is the **best** score against the receipt vendor using **both** the line’s normalized `vendor` field and full `description` (same rule for Pass 1 and bundle passes).
- date - proximity window, contributes to confidence

## Confidence
- amount:
    + exact amount match -> +40
    + otherwise -> 0 total
- vendor (max(WRatio, partial_ratio) on domain-suffix stripped, alias-normalized strings):
    + score scaled linearly: round((similarity / 100) * 30), max +30
- date:
    + 0 days -> +30
    + 1–3 days -> +20
    + 4–9 days -> +10
    + 10–14 days -> +5
    + >14 days -> +0
- propose match if >= configured `confidence_threshold` (default 80), and optionally `min_vendor_similarity_pass1b` (default 0 = off)

## Steps
- **Pass 1: 1-to-1**
    - Pass 1a: exact amount + exact date
        1. build the bipartite graph of eligible (line, receipt) pairs
        2. assign a **maximum-cardinality** matching (scipy `linear_sum_assignment`) -> `perfect_matched`
    - Pass 1b: exact amount + fuzzy vendor + date proximity
        1. for remaining unmatched pairs, compute confidence score
        2. on pairs with score >= threshold (and vendor floor if set), assign a **maximum total confidence** one-to-one matching via the same assignment solver -> `perfect_matched`
- **Pass 2: many lines -> 1 receipt**
    1. take remaining unmatched lines and receipts
    2. for each unmatched receipt:
        + among combinations of 2–`max_bundle_size` lines whose charges sum to the receipt amount exactly, require each line’s unified vendor similarity to the receipt to be >= `bundle_vendor_threshold`
        + if several subsets qualify, pick the one with **highest average** fuzzy similarity, then **highest minimum** similarity, then lexicographically smallest sorted line ids (deterministic)
        + create matches -> `bundle_matched`, mark all as used
- **Pass 3: many receipts -> 1 line**
    1. take remaining unmatched lines and receipts
    2. for each unmatched line:
        + same as Pass 2, but receipts are combined to match the line amount; similarity is unified line-vs-each-receipt vendor; tie-break uses receipt ids
        + if found, create matches -> `bundle_matched`, mark all as used