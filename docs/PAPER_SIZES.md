# Paper sizes and print specs: desk research

Done on 2026-11-01 because Amal said everything can be variable and asked for research on top and local Hindi papers (D-062). English papers come later.

None of these numbers came from a printer. No Indian newspaper or press published a mechanical data sheet that the searches could find. Most Indian numbers below come from advertising sellers. They are starting points for presets, and the paper's own printer overrides them.

## Page sizes

| Paper or format | Language | Size | Columns | What the size is | Source | Trust |
|---|---|---|---|---|---|---|
| Dainik Jagran (Moradabad) | Hindi | 329 x 520 mm | not given | full-page ad area | The Media Ant listing | low: seller |
| Dainik Jagran (Delhi) | Hindi | 318.8 x 500.9 mm | not given | one measured ad page | clipping record in GAIL news PDF, as summarised by search | low: measured print, may have shrunk or been a partial page |
| Dainik Bhaskar (Madhya Pradesh) | Hindi | about 330 x 250 mm half page | not given | half-page ad area | The Media Ant listing | low: seller |
| Hindustan Times (All India) | English | 332 x 520 mm | not given | full-page ad area; PDF/X-1a, 300 resolution | The Media Ant listing | low: seller |
| Times of India (Times Ascent, Hyderabad) | English | 329 x 520 mm | not given | full-page ad area; PDF/X-1a, 300 resolution | The Media Ant listing | low: seller |
| Employment News | English, Hindi and Urdu editions not checked | 250 x 380 mm | 5 at 50 mm each | ad billing area | Government of India, employmentnews.gov.in | medium: the publisher's own page, old |
| Indian broadsheet, generic | any | 381 x 578 mm; 7-8 columns; about 40 mm a column | 7-8 | format, said to be most common | The Media Ant blog (search summary; the page timed out when fetched) | low: one seller's blog |
| Tabloid, generic | any | 279 x 432 mm or 280 x 430 mm | not given | format | format guides, which disagree slightly | low |
| Indian mini-tabloid | any | 215 x 280 mm | not given | format | format guide | low |
| Berliner, generic (Mint used it from 2007) | any | 315 x 470 mm | not given | format | Wikipedia and format guides | medium |
| ABP broadsheet samples (India) | not given | 346 x 533.4 mm | not given | press cut-off sample, per PrintWeek | PrintWeek awards 2023 | medium: trade press |
| Gujarat Samachar and Asian Voice (UK weeklies, not India) | Gujarati, English | 253 x 360 mm | 6 at 38 mm, about 5 mm gutter worked out from the published widths | print area; 26% dot gain, 100 lpi | ABPL rate card | medium: the publisher's own page |

## Reading these numbers

- **Ad area is not page size.** The 329-332 x 520 mm numbers fit inside the 381 x 578 mm generic broadsheet, leaving about 25-29 mm a side. That fit is my inference; no source says it.
- **Our current preset is 297 x 420 mm (A3), still assumed.** It sits between the mini-tabloid and the tabloid, and is smaller than Berliner. No source shows that a Hindi weekly uses A3.
- **Janshakti's real size is still unknown.** A ruler on a printed copy answers this better than any source above.
- **Reference PDFs tell us nothing about physical size.** Dainik Bhaskar's e-paper PDF from 2026-11-01 has an A4 MediaBox (595.28 x 841.89 pt). Its height-to-width ratio is 1.41, against 1.58 for the listed 329 x 520 mm area, so it is not a true-size file and may not even be the same proportions.
- **Hindi local weeklies:** no source gave a size for one. The list needs real samples, or the papers' own printers.

## Press settings

| Setting | Number | Source | Trust |
|---|---|---|---|
| Total ink limit | 240% | Morton Sprint (UK) and Post Newspapers (Australia) coldset sheets, a Dublin publisher, Dutch printers on the Adobe forum | medium: all outside India |
| Total ink limit, other reading | 220% for ISOnewspaper26v4 | second-hand forum comment citing proofing.de | low: not verified |
| Black limit | 90% or 95% | Post Newspapers; Morton Sprint | medium: outside India |
| Dot gain | 26% | Morton Sprint, Post Newspapers, ABPL | medium |
| ICC profile | ISOnewspaper26v4; a newer ICONSnewspaper26v5 exists | Dublin publisher; Post Newspapers | medium: outside India |
| PDF standard | PDF/X-1a, 300 resolution | The Media Ant listings for HT and TOI ads | low: seller, about ads and not whole pages |
| Bleed | none on a newspaper | one Illustrator user on the Adobe forum | low: one person's practice |
| Newsprint | 40-45 gsm | PrintWeek (40 gsm, ABP); Indian supplier listings (42 and 45 gsm) | medium |
| Web press cut-off | 533 and 546 mm in use, 580 mm on older machines | PrintWeek; IndiaMART listing | medium |

An ICC profile only limits ink when colours are converted, and anything added afterwards can go over the limit (Adobe forum expert). So export has to check total ink on the finished plates, as GG-013 proposes, and cannot rely on the profile.

## What this means for the build

1. Every value above stays data in a preset. The preset already holds page, margins, grid, page-count rule and export profile (D-039, D-042).
2. Templates are not yet variable: a template for another column count is refused (D-049), and all 12 are drawn on 6 columns. A paper with 8 columns, such as a broadsheet, cannot use them today (GG-071).
3. Press export reads bleed, profile, ink limit and PDF standard from the preset. A null stops a press export, with the field named. The numbers above can be offered as suggestions, never filled in silently (GG-046, GG-053).
4. English is planned for later and nothing is built for it now. Known work when it comes: English hyphenation for justified narrow columns, headline ink measured on Latin text (scripts/measure-font-ink.mjs measures Devanagari), English fonts through the same font rules, and an English parity sample. It should not need a change to the document model.

## Sources

- [The Media Ant: Dainik Jagran, Moradabad](https://www.themediaant.com/newspaper/dainik-jagran-moradabad-hindi-advertising)
- [The Media Ant: Dainik Bhaskar, Madhya Pradesh](https://www.themediaant.com/newspaper/dainik-bhaskar-madhya-pradesh-hindi-advertising)
- [The Media Ant: Hindustan Times, All India, full page](https://www.themediaant.com/newspaper/hindustan-times-all-india-english-advertising/full-page)
- [The Media Ant: Times of India, Times Ascent, full page](https://www.themediaant.com/newspaper/times-of-india-times-ascent-english-advertising/full-page)
- [The Media Ant: newspaper size formats](https://www.themediaant.com/blog/newspaper-size-formats-in-inches-mm-dimensions-cms/)
- [GAIL news clippings, 16 May 2026](https://gailonline.com/pdf/news/2026/GAIL_News_16_May_2026.pdf)
- [Employment News: technical data](https://employmentnews.gov.in/technicaldata.asp)
- [Wikipedia: Berliner format](https://en.wikipedia.org/wiki/Berliner_(format))
- [papersizes.org: newspaper sizes](https://www.papersizes.org/newspaper-sizes.htm)
- [PrintWeek: ABP, Newspaper Printer of the Year 2023](https://www.printweek.in/news/printweek-awards-2023-abp-wins-newspaper-printer-of-the-year-58141?amp=1)
- [PrintWeek: Number three and eyeing the top spot](https://www.printweek.in/features/eyeing-spot-17996?amp=1)
- [IndiaMART: web offset machine listing](https://m.indiamart.com/proddetail/web-offset-printing-machine-7305087173.html?pos=6)
- [ABPL: rate card and technical specs](https://www.abplgroup.com/Advertise/Rate-Card-and-Technical-Specs)
- [Dublin People: advertising specs](https://dublinpeople.com/advertise-with-dublin-people/)
- [Post Newspapers: technical information](https://postnewspapers.com.au/wp-content/uploads/2024/03/Technical-Information-Newspaper.pdf)
- [Morton Sprint: tabloid coldset sheet](https://mortonsprint.com/wp-content/uploads/sites/18/2024/12/TABLOID-NEWSPAPER-700-WEB-COLDSET.pdf)
- [Adobe forum: ISOnewspaper26v4 ink limit](https://community.adobe.com/t5/indesign-discussions/isonewspaper26v4-profile-ink-limit-issue-once-exported-from-indesign/m-p/9515244)
- [paperindex: newsprint listing](https://www.paperindex.com/product-details/newsprint-paper/78306)
