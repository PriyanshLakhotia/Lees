# Dutch word annotation task

Create a compact English reading aid for every requested Dutch word. Use the supplied article as context.

- Return exactly one entry for every normalized word in the requested list; do not add or omit words.
- `word` must exactly match the supplied normalized lowercase spelling.
- Give the dictionary lemma in Dutch.
- Give the contextual English meaning in one to six words. Prefer the meaning used in this text, not a broad dictionary inventory.
- Use a concise part-of-speech label such as article, noun, verb, adjective, adverb, pronoun, preposition, conjunction, numeral, name, or particle.
- Set difficulty to `common`, `useful`, or `advanced` relative to the article's CEFR level.
- Examples are sparse: fill `exampleNl` and `exampleEn` only for a genuinely difficult or structurally useful word, and for no more than eight percent of entries. Otherwise use empty strings.
- Example sentences must be short, natural, and different from the article sentence.
- Return only data matching the supplied JSON schema.
