// Frame and obstacle layouts of the existing flow() cases, used to check that flow() placement never changes
// (fixtures/flow-placement.json was written from flow.js on main at 7aa41ad, before deadGaps existed).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const samplesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../spike/samples')

// The same story flow.cases.test.js uses: the first three real paragraphs.
export function realStory() {
  const real = fs.existsSync(samplesDir) ? fs.readdirSync(samplesDir).filter(f => f.endsWith('.txt'))
    .flatMap(f => fs.readFileSync(path.join(samplesDir, f), 'utf8').split(/\n\s*\n/)).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40) : []
  return (real.length ? real : ['मध्य प्रदेश में सरकारी नौकरी की तैयारी कर रहे युवाओं के लिए बड़ी खबर है। मुख्यमंत्री डॉ. मोहन यादव के नेतृत्व वाली सरकार ने 1.24 लाख नए पदों को मंजूरी दी है।']).slice(0, 3).join(' ')
}

export const OPTS = { font: '14px "Fake"', lineHeight: 21 }
export const placementCases = story => [
  ['one tall frame', story, [{ id: 'a', x: 0, y: 0, w: 200, h: 4000 }], []],
  ['two columns', story, [{ id: 'a', x: 0, y: 0, w: 140, h: 210 }, { id: 'b', x: 160, y: 0, w: 140, h: 4000 }], []],
  ['photo spanning two columns', story, [{ id: 'a', x: 0, y: 0, w: 140, h: 600 }, { id: 'b', x: 160, y: 0, w: 140, h: 600 }], [{ x: 0, y: 84, w: 300, h: 105, margin: 6 }]],
  ['photo in the middle of a column', story, [{ id: 'a', x: 0, y: 0, w: 220, h: 4000 }], [{ x: 40, y: 63, w: 80, h: 84, margin: 6 }]],
  ['contract photo in the middle', story, [{ id: 'a', x: 0, y: 0, w: 220, h: 4000 }], [{ x: 60, y: 63, w: 80, h: 84, margin: 6 }]],
  ['overflow into a third frame', story, [{ id: 'a', x: 0, y: 0, w: 140, h: 105 }, { id: 'b', x: 160, y: 0, w: 140, h: 105 }, { id: 'c', x: 320, y: 0, w: 140, h: 4000 }], []],
  ['empty frames', story, [{ id: 'a', x: 0, y: 0, w: 140, h: 42 }, { id: 'short', x: 160, y: 0, w: 140, h: 15 }, { id: 'b', x: 320, y: 0, w: 140, h: 4000 }, { id: 'after', x: 480, y: 0, w: 140, h: 400 }], []],
  ['gap 1px below the minimum', story, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }], [{ x: 0, y: 0, w: 220 - 83 - 4, h: 105, margin: 4 }]],
  ['gap 1px above the minimum', story, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }], [{ x: 0, y: 0, w: 220 - 85 - 4, h: 105, margin: 4 }]],
  ['obstacle taller than the column', story, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }], [{ x: 0, y: 0, w: 120, h: 5000, margin: 4 }]],
  ['story overflows one frame', story, [{ id: 'a', x: 0, y: 0, w: 140, h: 105 }], []],
  ['tall wall, long word', `अब ${'क'.repeat(40)} बस`, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }, { id: 'b', x: 240, y: 0, w: 300, h: 400 }], [{ x: 0, y: 0, w: 150, h: 5000, margin: 4 }]],
  ['compound word beside a wall', `अब प्रधानमन्त्रीक्षेत्रविकासयोजनाश्रद्धाज्ञानपट्टीद्वारास्त्रीशिक्षा बस`, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }], [{ x: 0, y: 0, w: 110, h: 5000, margin: 4 }]],
]
