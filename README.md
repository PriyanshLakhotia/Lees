# Lees

A private, local Dutch reading tool. It generates level-appropriate news adaptations, explainers, history/culture texts, and fiction through the authenticated Codex CLI.

## Run locally

Requirements:

- Node.js 22.13 or newer
- Codex CLI signed in with ChatGPT (`codex login status`)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). One command starts both the interface and the localhost-only generation service.

For a production-style local run:

```bash
npm run build
npm start
```

## How generation works

- Dutch texts and factual research: `gpt-5.6-terra`, high reasoning
- Word meanings and reading chat: `gpt-5.6-luna`, low reasoning
- Current and factual content uses Codex web search and stores the source links.
- Each generation is an independent background job. Up to three texts can generate concurrently.
- Codex runs are ephemeral and read-only. No OpenAI API key is needed when the CLI is signed in with ChatGPT.

The prompt is assembled from additive modules in [`prompts/`](prompts/README.md). JSON schemas in `schemas/` keep generated data stable.

## Local data

Everything permanent is plain text in the repository:

```text
data/
  library.json
  stories/
    <story-id>/
      request.json
      story.json
      story.md
```

`story.json` contains the complete article, metadata, sources, word annotations, read/favourite state, and notes. `story.md` is a readable copy. Clarification chats and active job state are session-only.

## Useful commands

```bash
npm test
npm run lint
npm run build
```
