// ============================================================================
// USC AI Trust Lab — Embeddings adapter (for reliability probing)
// Ports the semantic-similarity core of Harsh Rudrawar's llm-reliability-evaluation
// framework (score_results.py): instead of exact-string matching, reliability is
// measured as the mean pairwise cosine similarity of OpenAI embeddings across a
// set of model outputs. High similarity => stable/consistent behavior.
//
// Like the rest of the engine, this calls the provider API DIRECTLY from the
// browser using the in-page key (keys.openai). No response text is stored in
// source; embeddings are computed on demand.
// ============================================================================

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

// Embed a batch of strings in a single call. Returns vectors in input order.
// Requires an OpenAI key regardless of which provider generated the text —
// the embedding model is the shared "ruler" all outputs are measured against
// (this mirrors the framework, which uses OpenAI embeddings for scoring).
export async function embedTexts(texts, keys, { signal, model = DEFAULT_EMBED_MODEL } = {}) {
  if (!keys.openai || !keys.openai.trim()) {
    throw new Error("Reliability scoring needs an OpenAI key (used for embeddings) — add it in the API keys panel.");
  }
  const input = texts.map((t) => (t && t.trim() ? t : " ")); // API rejects empty strings
  const res = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${keys.openai}` },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    const txt = (await res.text()).slice(0, 200);
    if (res.status === 401) throw new Error("OpenAI 401: the embeddings key is missing, invalid, or revoked.");
    if (res.status === 429) throw new Error("OpenAI 429: rate limit or no quota/credits for embeddings.");
    throw new Error(`OpenAI embeddings ${res.status}: ${txt}`);
  }
  const data = await res.json();
  // data.data is ordered to match input (per OpenAI spec), but sort by index defensively.
  return (data.data || []).slice().sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// Cosine similarity of two equal-length vectors.
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Mean cosine similarity across every unique pair of vectors (framework's
// pairwise-similarity metric). With fewer than 2 vectors there is nothing to
// compare, so a single deterministic output is treated as perfectly stable (1).
export function meanPairwiseCosine(vectors) {
  if (!vectors || vectors.length < 2) return 1;
  let sum = 0, n = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) { sum += cosine(vectors[i], vectors[j]); n++; }
  }
  return n ? sum / n : 1;
}
