# ResumeAI

A React and TypeScript web application that analyzes a PDF/DOCX resume against a target job, uses IBM Consulting Advantage (ICA) to create grounded optimization suggestions, and exports a selectable-text, A4 PDF.

## Features

- Premium responsive landing page and guided five-step workspace.
- In-browser PDF/DOCX text extraction; the uploaded binary is not persisted by this app.
- Job description input plus best-effort public job-page extraction with a safe paste fallback.
- ICA-powered structured analysis: match/ATS guidance, skill and keyword coverage, strengths, weaknesses, and recommendations.
- ICA-powered structured, editable resume optimization with strict factual-grounding prompt rules.
- ATS-friendly one-column live preview and selectable-text multi-page PDF download.
- Built-in Classic, Modern, and Compact PDF templates. The resume data is injected into the selected, application-owned layout so generated content cannot alter the template structure.
- Persistent footer disclosure: AI output can be incorrect, so users must review all facts, dates, metrics, and claims before use.
- Vercel serverless routes keep ICA credentials out of the browser.

## Architecture

- `src/`: Vite React client, accessible UI, local file parsing, editor, and PDF output.
- `api/`: Vercel serverless endpoints and a reusable ICA client.
- `api/analyze-resume.mjs`: calls ICA with an analysis JSON contract.
- `api/optimize-resume.mjs`: calls ICA with a structured resume JSON contract.
- `api/job-details.mjs`: best-effort public HTML extraction; it does not invent data.

## Local setup

```bash
cd "C:\Users\RajYadav\OneDrive - IBM\Desktop\Python\resume-ai"
copy .env.example .env
npm install
npm run dev
```

`npm run dev` starts the local Vite client together with the same API handler modules used by Vercel, so analysis and optimization work locally. It reads server-only variables from `.env` and does not expose them to the browser. `npm run vercel-dev` remains available when you specifically need to emulate Vercel CLI behavior.

## Environment variables

Set these only in `.env` locally or Vercel's Environment Variables settings. Never use `VITE_` prefixes and never commit real keys.

```env
ICA_API_KEY=your_ICA_developer_key
ICA_API_URL=https://api.servicesessentials.ibm.com/v1
ICA_MODEL=claude-haiku-4-5
```

ICA is called server-side using `Authorization: Bearer <ICA_API_KEY>` and `POST /chat-models/chat/completions`, consistent with the project OpenAPI contract.

### Optional task-specific model routing

Use a lower-cost default model and select stronger models for the two quality-sensitive tasks:

```env
ICA_MODEL=claude-haiku-4-5
ICA_ANALYSIS_MODEL=claude-sonnet-4-6
ICA_OPTIMIZE_MODEL=claude-sonnet-4-6
```

When the optional variables are omitted, both tasks fall back to `ICA_MODEL`. All model IDs and keys stay server-side.

## Templates and external template services

ResumeAI ships its own three templates in `src/utils/pdf.ts`. This is deliberate: template code is versioned with the application, works offline after the app is loaded, does not send resume data to another provider, and prevents a model from changing the PDF structure.

[JSON Resume](https://jsonresume.org/) is a useful free, open-source resume-data standard and theme ecosystem. It is not a drop-in, vendor-SLA template-rendering API that this application should depend on in production. Its community themes have individual package licenses and varying maintenance, and converting ResumeAI's richer internal format to the JSON Resume schema would require an explicit mapping layer and visual/security review for every theme.

For an industry deployment, prefer one of these approaches:

1. Keep the vetted built-in PDF templates (recommended for reliable ATS output).
2. Curate and vendor approved open-source JSON Resume themes into this repository after reviewing their licenses, accessibility, print behavior, and security. Render from structured resume data only.
3. Use a commercial document-rendering provider only after confirming its pricing, data-processing agreement, uptime SLA, and whether resume content may be retained. Keep its API key on the server.

Do **not** let an AI model generate arbitrary HTML, CSS, LaTeX, or template code and run it as part of PDF generation. The model should only provide validated structured resume fields; the renderer must own layout and escaping.

## Commands

```bash
npm run dev        # full local UI + API development server
npm run vercel-dev # optional Vercel CLI environment
npm test          # API utility tests
npm run build     # TypeScript validation + production build
npm run preview   # preview production UI build
```

## Deploy to Vercel

1. Push the `resume-ai` directory to a Git repository or import it as Vercel's project root.
2. Add `ICA_API_KEY`, `ICA_API_URL`, and `ICA_MODEL` in Vercel Environment Variables for Production (and Preview if wanted).
3. Deploy. Vercel detects Vite and serves `api/*.mjs` as serverless functions.
4. Verify an upload, pasted job-description analysis, optimization, edit, and PDF download using a non-sensitive test resume.

## Troubleshooting

- **AI analysis unavailable:** confirm the ICA environment variables, model ID, API base URL, and ICA key entitlement in Vercel. The UI intentionally suppresses raw provider errors.
- **Resume cannot be read:** use a text-based PDF or DOCX smaller than 8 MB; image-only scans have no extractable text.
- **Job URL fails:** many job boards block automated fetches. Paste the full job description instead.
- **Local `/api` errors:** start the app with `npm run dev`; do not run `vite` directly because Vite alone does not execute the API handlers.
- **UI changes are not visible:** Vite normally hot-reloads CSS. If a prior hot-reload error occurred, restart `npm run dev` and hard-refresh the browser with `Ctrl+Shift+R`.

## Security and data handling

The app does not log resume or job content. The browser sends extracted resume text only when analysis/optimization is requested. ICA API keys remain in server-side environment variables. Job-page text is rendered as text only; untrusted HTML is never injected into the page.