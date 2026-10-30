# Phase 0 spike report (GATE run)

- Paragraphs tested: 127 (127 real, 0 invented)
- Fonts tested: 2 at 12/14 px, weight 400, widths 90/110/140/180/240 px
- Line-break match vs real browser DOM, launch fonts: **3547/3556 (99.7%)**  <- gate metric
- Lines where Pretext fits MORE than the browser (would overflow in print), launch fonts: **0**  <- must be 0; lines where it breaks earlier (harmless): 9
- Same, all tested fonts: 3547/3556 (99.7%), 0 over
- Drag simulation (2000 obstacle re-layouts, 850 lines each): 0.261 ms/frame

## Verdict rule (per font)
- real copy >= 99.5%, halant checks clean and 0 overflows: PASS, Pretext as live engine for that font
- 95-99.5%, or any overflow: CAVEAT, Pretext for live preview only, server layout for final output
- < 95%: FAIL, do not use live; server layout only

## Per-font summary (overflows first, then by parity)

| font | role | launch | real copy match | overflows | early breaks | halant break match | halant widths agree | verdict |
|---|---|---|---|---|---|---|---|---|
| Noto Serif Devanagari | text-serif | yes | 99.8% | 0 | 3 | 100% | 66/66 | PASS |
| Noto Sans Devanagari | text | yes | 99.7% | 0 | 6 | 100% | 66/66 | PASS |

## Results

| test | font | weight | px | col width | obstacle | match | over | early | height mismatches |
|---|---|---|---|---|---|---|---|---|---|
| column | Noto Sans Devanagari | 400 | 12 | 90 | - | 125/127 | 0 | 2 | 0 |
| column | Noto Sans Devanagari | 400 | 12 | 110 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Sans Devanagari | 400 | 12 | 140 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Sans Devanagari | 400 | 12 | 180 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Sans Devanagari | 400 | 12 | 240 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Sans Devanagari | 400 | 14 | 90 | - | 125/127 | 0 | 2 | 1 |
| column | Noto Sans Devanagari | 400 | 14 | 110 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Sans Devanagari | 400 | 14 | 140 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Sans Devanagari | 400 | 14 | 180 | - | 126/127 | 0 | 1 | 0 |
| column | Noto Sans Devanagari | 400 | 14 | 240 | - | 127/127 | 0 | 0 | 0 |
| obstacle | Noto Sans Devanagari | 400 | 14 | 240 | 70x60 | 126/127 | 0 | 1 | - |
| obstacle | Noto Sans Devanagari | 400 | 14 | 320 | 70x60 | 127/127 | 0 | 0 | - |
| obstacle | Noto Sans Devanagari | 400 | 14 | 240 | 100x90 | 127/127 | 0 | 0 | - |
| obstacle | Noto Sans Devanagari | 400 | 14 | 320 | 100x90 | 127/127 | 0 | 0 | - |
| column | Noto Serif Devanagari | 400 | 12 | 90 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Serif Devanagari | 400 | 12 | 110 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Serif Devanagari | 400 | 12 | 140 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Serif Devanagari | 400 | 12 | 180 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Serif Devanagari | 400 | 12 | 240 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Serif Devanagari | 400 | 14 | 90 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Serif Devanagari | 400 | 14 | 110 | - | 127/127 | 0 | 0 | 0 |
| column | Noto Serif Devanagari | 400 | 14 | 140 | - | 125/127 | 0 | 2 | 0 |
| column | Noto Serif Devanagari | 400 | 14 | 180 | - | 126/127 | 0 | 1 | 1 |
| column | Noto Serif Devanagari | 400 | 14 | 240 | - | 127/127 | 0 | 0 | 0 |
| obstacle | Noto Serif Devanagari | 400 | 14 | 240 | 70x60 | 127/127 | 0 | 0 | - |
| obstacle | Noto Serif Devanagari | 400 | 14 | 320 | 70x60 | 127/127 | 0 | 0 | - |
| obstacle | Noto Serif Devanagari | 400 | 14 | 240 | 100x90 | 127/127 | 0 | 0 | - |
| obstacle | Noto Serif Devanagari | 400 | 14 | 320 | 100x90 | 127/127 | 0 | 0 | - |

## Sample failures

- column / Noto Sans Devanagari 400 / 12px / w=90 / para 57: line 1 (early break)
  - DOM: `इंदौर में मंगलवार, 27`
  - Pretext: `इंदौर में मंगलवार,`

- column / Noto Sans Devanagari 400 / 12px / w=90 / para 72: line 2 (early break)
  - DOM: `एवं स्वास्थ्य अधिकारी`
  - Pretext: `एवं स्वास्थ्य`

- column / Noto Sans Devanagari 400 / 14px / w=90 / para 35: line 17 (early break)
  - DOM: `संगठन के एजेंडे से`
  - Pretext: `संगठन के एजेंडे`

- column / Noto Sans Devanagari 400 / 14px / w=90 / para 42: line 8 (early break)
  - DOM: `लेकर कार्रवाई तेज`
  - Pretext: `लेकर कार्रवाई`

- column / Noto Sans Devanagari 400 / 14px / w=180 / para 79: line 7 (early break)
  - DOM: `के चुनावी दावे के रूप में सामने आया`
  - Pretext: `के चुनावी दावे के रूप में सामने`

- obstacle / Noto Sans Devanagari 400 / 14px / w=240 / 70x60 / para 59: line 0 (early break)
  - DOM: `जनसुनवाई में एक अन्य महिला ने`
  - Pretext: `जनसुनवाई में एक अन्य महिला`

- column / Noto Serif Devanagari 400 / 14px / w=140 / para 83: line 0 (early break)
  - DOM: `घटना के बाद पुलिस और राहत`
  - Pretext: `घटना के बाद पुलिस और`

- column / Noto Serif Devanagari 400 / 14px / w=140 / para 85: line 2 (early break)
  - DOM: `पुलिस मामले की जांच कर रही`
  - Pretext: `पुलिस मामले की जांच कर`

- column / Noto Serif Devanagari 400 / 14px / w=180 / para 122: line 2 (early break)
  - DOM: `करने वाली आराधना तरोले से मुख्यमंत्री`
  - Pretext: `करने वाली आराधना तरोले से`
