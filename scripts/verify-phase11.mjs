// Phase 11 Rabbit Hole — cascading cause-and-effect chains, depth-gated by stage.
// Requires dev server :5173 (serves the groq proxy). Run: node scripts/verify-phase11.mjs
// No Supabase change this phase — Rabbit Hole is generated on demand, never stored.
import { readFileSync } from 'node:fs'
import { RABBIT_HOLE_SYSTEM, buildRabbitPrompt, parseChain } from '../src/lib/rabbitHole.js'

const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].trim()
}
const FN = 'http://localhost:5173/.netlify/functions'

let pass = 0, fail = 0
const ok = (m) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`) }
const bad = (m, e) => { fail++; console.log(`  \x1b[31m✗ ${m}\x1b[0m${e ? ' — ' + (e.message || JSON.stringify(e)) : ''}`) }
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`)

const callGroq = async (body) => fetch(`${FN}/groq`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json())

const noAdvice = (chain) => !/you should (buy|sell)|i recommend|buy it now|sell it now|should you buy/i.test(JSON.stringify(chain).toLowerCase())
const printChain = (chain) => chain.forEach((l, i) => {
  console.log(`   ${'  '.repeat(i)}\x1b[1m${i + 1}. ${l.headline}\x1b[0m`)
  console.log(`   ${'  '.repeat(i)}   \x1b[2m${l.detail}\x1b[0m`)
})

const EVENT = 'NVDA jumped 4% today after blowout data-center demand'

try {
  step('1. Rabbit Hole — 4-level chain (Watcher / Trader stage)')
  {
    const res = await callGroq({ system: RABBIT_HOLE_SYSTEM, prompt: buildRabbitPrompt(EVENT, 4), json: true, temperature: 0.7, max_tokens: 700 })
    const chain = parseChain(res.parsed, 4)
    if (!chain) bad('no usable chain', res)
    else {
      chain.length === 4 ? ok('exactly 4 levels') : bad(`expected 4 levels, got ${chain.length}`)
      chain.every((l) => l.headline.length > 1 && l.detail.length > 5) ? ok('every level has a headline + explanatory sentence') : bad('a level is missing headline/detail')
      noAdvice(chain) ? ok('no buy/sell advice') : bad('leaked buy/sell advice')
      console.log('\n   \x1b[2m── CASCADE (4) ──\x1b[0m')
      printChain(chain)
      console.log('')
    }
  }

  step('2. Rabbit Hole — 7-level chain (after Day 30)')
  {
    const res = await callGroq({ system: RABBIT_HOLE_SYSTEM, prompt: buildRabbitPrompt(EVENT, 7), json: true, temperature: 0.7, max_tokens: 900 })
    const chain = parseChain(res.parsed, 7)
    if (!chain) bad('no usable chain', res)
    else {
      chain.length === 7 ? ok('exactly 7 levels (deeper after Day 30)') : bad(`expected 7 levels, got ${chain.length}`)
      chain.every((l) => l.headline.length > 1 && l.detail.length > 5) ? ok('every level has a headline + explanatory sentence') : bad('a level is missing headline/detail')
      noAdvice(chain) ? ok('no buy/sell advice') : bad('leaked buy/sell advice')
      console.log('\n   \x1b[2m── CASCADE (7) ──\x1b[0m')
      printChain(chain)
      console.log('')
    }
  }

  step('3. parseChain truncates an over-long model response to the requested depth')
  {
    const fake = { chain: Array.from({ length: 10 }, (_, i) => ({ headline: `cause ${i}`, detail: `because of reason ${i}` })) }
    const chain = parseChain(fake, 4)
    chain.length === 4 ? ok('10 returned → truncated to 4') : bad(`expected 4, got ${chain.length}`)
    const dropped = parseChain({ chain: [{ headline: '', detail: 'x' }, { headline: 'ok', detail: 'fine reason' }] }, 4)
    dropped.length === 1 ? ok('malformed level dropped') : bad(`expected 1 clean level, got ${dropped.length}`)
  }
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
// Set the code and let the event loop drain (avoids a Windows libuv teardown
// assertion that fires when process.exit() races open fetch/undici sockets).
process.exitCode = fail ? 1 : 0
