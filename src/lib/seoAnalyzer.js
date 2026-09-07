// Client-side mirror of the edge function's SEO engine
// (supabase/functions/process-product-image/seo.ts) so the admin
// review screen can recompute the score live while editing.

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "may",
  "me",
  "more",
  "my",
  "not",
  "of",
  "on",
  "one",
  "or",
  "our",
  "out",
  "over",
  "said",
  "she",
  "so",
  "some",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "too",
  "under",
  "up",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
  "very",
  "just",
  "also",
  "own",
  "its",
  "every",
  "each",
  "both",
  "other",
  "such",
  "only",
  "same",
  "even",
  "how",
]);

const NON_WORD = /[^\p{L}\p{N}'-]+/gu;
const HTML_TAGS = /<[^>]*>/g;

function stripHtml(text) {
  return String(text || "")
    .replace(HTML_TAGS, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

export function tokenize(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(HTML_TAGS, " ")
    .split(NON_WORD)
    .map((w) => w.replace(/['-]+$/g, ""))
    .filter((w) => w.length > 1);
}

export function splitSentences(text) {
  return stripHtml(text)
    .replace(/([.!?]+["')\]]*)\s+/g, "$1|")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function extractKeywords(text, topN = 10) {
  const freq = {};
  for (const w of tokenize(text)) {
    if (STOP_WORDS.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([w]) => w);
}

function countSyllables(word) {
  const groups = word.match(/[aeiouy]+/g);
  if (!groups) return 1;
  let n = groups.length;
  if (word.endsWith("e") && n > 1) n -= 1;
  return Math.max(1, n);
}

export function analyzeSEO(title, description) {
  const text = `${title || ""} ${description || ""}`;
  const words = tokenize(text);
  const sentences = splitSentences(`${title || ""}. ${description || ""}`);
  const totalWords = words.length;
  const totalSentences = sentences.length;

  const keywords = extractKeywords(text, 10);
  const keywordOccurrences = {};
  let keywordHits = 0;
  for (const k of keywords) {
    let count = 0;
    for (const w of words) if (w === k) count += 1;
    keywordOccurrences[k] = count;
    keywordHits += count;
  }

  const avgWps = totalSentences > 0 ? totalWords / totalSentences : 0;
  const keywordDensity = totalWords > 0 ? (keywordHits / totalWords) * 100 : 0;

  let syllableTotal = 0;
  for (const w of words) syllableTotal += countSyllables(w);
  const syllablesPer100 =
    totalWords > 0 ? (syllableTotal / totalWords) * 100 : 0;
  const flesch = 206.835 - 1.015 * avgWps - 84.6 * (syllablesPer100 / 100);
  const readabilityScore = Math.max(0, Math.min(100, Math.round(flesch)));

  const descriptionWords = tokenize(description || "").length;
  const lengthScore = Math.min(100, Math.round((descriptionWords / 200) * 100));
  const densityScore = Math.max(0, 100 - Math.abs(keywordDensity - 2.5) * 18);
  const coverageScore = Math.min(100, keywords.length * 12);

  const seoScore = Math.round(
    0.4 * densityScore +
      0.3 * readabilityScore +
      0.2 * lengthScore +
      0.1 * coverageScore,
  );

  return {
    suggestedKeywords: keywords,
    keywordDensity: Math.round(keywordDensity * 100) / 100,
    readabilityScore,
    seoScore: Math.max(0, Math.min(100, seoScore)),
    stats: {
      wordCount: totalWords,
      sentenceCount: totalSentences,
      avgWordsPerSentence: Math.round(avgWps * 100) / 100,
      keywordOccurrences,
    },
  };
}
