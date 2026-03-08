# Matching Flow and Details

## Signals
- amount - hard gate, must match exactly
- vendor - fuzzy (RapidFuzz max(WRatio, partial_ratio), domain-suffix stripped, alias normalized), contributes to confidence
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
- propose match if >= 80

## Steps
- **Pass 1: 1-to-1**
    - Pass 1a: exact amount + exact date
        1. for every (line, receipt) pair, check amount and date match exactly
        2. if match found, assign immediately -> perfect_matched
    - Pass 1b: exact amount + fuzzy vendor + date proximity
        1. for remaining unmatched pairs, compute confidence score
        2. sort all pairs by score descending
        3. greedy assign if score >= 80 -> perfect_matched
- **Pass 2: many lines -> 1 receipt**
    1. take remaining unmatched lines and receipts
    2. for each unmatched receipt:
        + find combinations of 2-4 lines where charge sum equals receipt amount exactly
        + all lines in combination must have max(WRatio, partial_ratio) >= 60 against receipt vendor
        + if found, create matches -> bundle_matched, mark all as used
- **Pass 3: many receipts -> 1 line**
    1. take remaining unmatched lines and receipts
    2. for each unmatched line:
        + find combinations of 2-4 receipts where charge sum equals line charge exactly
        + all receipts in combination must have max(WRatio, partial_ratio) >= 60 against line vendor
        + if found, create matches -> bundle_matched, mark all as used