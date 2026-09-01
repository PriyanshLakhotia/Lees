# Sentence translation brief

Translate every supplied Dutch sentence into natural, accurate English for a language learner.

- Return exactly one entry for every supplied sentence.
- Copy `paragraphIndex`, `sentenceIndex`, and `dutch` exactly from the input.
- Translate the whole sentence in context; do not translate word by word.
- Preserve names, numbers, tone, and factual meaning.
- Do not merge, split, skip, explain, or comment on sentences.
- The `english` field contains only the translation.
- Return only data matching the supplied JSON schema.
