import { complete, json, parseJson, requirePost } from "./_lib/ica.mjs";

const shape = `{"name":"","contact":{"email":"","phone":"","location":"","linkedin":"","github":""},"summary":"","skills":[],"experience":[{"company":"","role":"","location":"","startDate":"","endDate":"","bullets":[]}],"education":[{"institution":"","degree":"","location":"","graduationDate":"","details":[]}],"projects":[{"name":"","link":"","bullets":[]}],"certifications":[]}`;

function validResume(value) {
  return value && typeof value === "object" && typeof value.name === "string" && typeof value.summary === "string" && Array.isArray(value.skills) && Array.isArray(value.experience) && Array.isArray(value.education) && Array.isArray(value.projects) && Array.isArray(value.certifications) && value.contact && typeof value.contact === "object";
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const resume = req.body?.resume;
  if (!validResume(resume)) return json(res, 400, { error: "A complete editable resume is required to create a one-page version." });
  try {
    const content = await complete([
      { role: "system", content: `Return ONLY valid JSON matching: ${shape}. You are creating a truthful, ATS-friendly one-page resume from the supplied edited resume. Preserve the candidate's name and supported contact details. Use ONLY facts, roles, companies, dates, education, projects, skills, certifications, and metrics in the source. Never invent, infer, merge, or alter facts. Aggressively prioritize relevance and impact: summary maximum 3 lines, 8-12 focused skills, the most relevant 2-4 experience entries with 2-3 concise bullets each, at most 2 projects, and only essential education/certifications. Omit lower-value content rather than shrinking text or exceeding one A4 page. Return empty arrays for omitted sections.` },
      { role: "user", content: `EDITED RESUME TO CONDENSE:\n${JSON.stringify(resume)}` }
    ], 3500, "optimization");
    return json(res, 200, { resume: parseJson(content) });
  } catch (error) {
    console.error("One-page resume creation failed", error.message);
    return json(res, error.statusCode || 500, { error: "A concise resume could not be created. Please try again." });
  }
}