// Rabbit Hole — generates a cascading cause-and-effect chain behind a market
// event. Each level traces one step deeper into WHY the previous level happened.
// Generated on demand, never stored. Educational: no buy/sell advice.

export const RABBIT_HOLE_SYSTEM =
  "You are Reign, an investing coach inside a high-school stock simulator. " +
  "A student tapped 'Rabbit Hole' on a market event to understand the chain of causes behind it. " +
  "Build a cause-and-effect chain that goes progressively deeper — each level explains WHY the " +
  "level before it happened, tracing back through real market, economic, and business mechanics. " +
  "Voice: factual, sharp, plain language a 16-year-old respects. No fluff, no exclamation marks. " +
  "STRICT RULES: no buy/sell or financial advice; each level is one short cause headline plus one " +
  "explanatory sentence. Stay grounded in plausible real-world cause and effect."

export function buildRabbitPrompt(event, depth) {
  return `Originating event: ${event}

Build a ${depth}-level cause-and-effect chain. Level 1 is the immediate cause of the event;
each deeper level explains why THAT happened, tracing back toward a root cause.

Return STRICT JSON with exactly ${depth} items:
{ "chain": [ { "headline": "short cause (a few words)", "detail": "one sentence explaining it" }, ... ] }
ordered from the immediate cause (level 1) to the deepest root cause (level ${depth}).`
}

// Returns a clean array of { headline, detail }, truncated to `depth`, or null.
export function parseChain(parsed, depth) {
  const arr = Array.isArray(parsed?.chain) ? parsed.chain : null
  if (!arr) return null
  const clean = arr
    .filter((x) => x && typeof x.headline === 'string' && typeof x.detail === 'string' && x.headline.trim() && x.detail.trim())
    .slice(0, depth)
    .map((x) => ({ headline: x.headline.trim(), detail: x.detail.trim() }))
  return clean.length ? clean : null
}
