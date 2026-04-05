# Knowledge Base — AI Assistant Instructions

This file defines how the AI CLI (Claude Code / Gemini CLI / Codex) should behave
when working with this knowledge base vault.

---

## Vault Structure

```
{vault}/
├── CLAUDE.md          ← You are reading this file
├── GEMINI.md          ← Synced from CLAUDE.md (for Gemini CLI)
├── AGENTS.md          ← Synced from CLAUDE.md (for Codex)
│
└── {Domain}/          ← One folder per knowledge domain
    ├── raw/           ← Raw input: unprocessed notes, web clips, PDFs
    └── wiki/
        ├── _WORKFLOW.md   ← Domain-specific compile/lint rules
        ├── _index.md      ← Auto-maintained index (do not edit manually)
        ├── *.md           ← Compiled wiki articles
        └── qa/            ← Q&A session archives
```

---

## Commands

### compile {domain}

Read all files in `{domain}/raw/` and `{domain}/wiki/_WORKFLOW.md`, then:

1. For each piece of raw content:
   - If it matches an existing wiki article → merge and update
   - If it's a new concept → create a new wiki article
   - If it's low-value or a duplicate → skip with a brief reason
2. Update `{domain}/wiki/_index.md` (article registry, glossary, compile history)
3. Do NOT delete anything from `raw/` — that's the user's job

**Article format:**
```markdown
---
type: wiki-article
date: YYYY-MM-DD
tags: [domain-name, topic]
status: seedling | growing | evergreen
source: "title or URL"
---

> [!summary]
> One to two sentences summarising the core idea.

## Content

...

## Related
- [[other-article]]
```

---

### lint {domain}

Review all files in `{domain}/wiki/` and report:

| Issue | Action |
|-------|--------|
| Missing frontmatter | Flag for completion |
| Missing summary callout | Flag for completion |
| `seedling` status older than 30 days | Flag for review |
| Broken internal links `[[...]]` | Flag for fix |
| Articles with no backlinks | Flag as orphan |

Print a summary report. Do NOT auto-fix — only report.

---

### qa {domain}: {question}

1. Search `{domain}/wiki/` for relevant articles
2. Answer the question based on the knowledge base content
3. Cite which articles you used: `(source: [[article-name]])`
4. Save the Q&A to `{domain}/wiki/qa/YYYY-MM-DD-{topic-slug}.md`

---

## General Rules

- **Never modify `_WORKFLOW.md` or `_index.md` unless explicitly asked**
- **Never read or write outside the vault folder**
- **Preserve existing article structure** — only append or update sections
- **Write in the same language as the existing articles** in that domain
- **Keep articles focused** — one concept per article
- When in doubt, ask before making structural changes
