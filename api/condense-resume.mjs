import { complete, json, parseJson, requirePost } from "./_lib/ica.mjs";

const shape = `{"name":"","contact":{"email":"","phone":"","location":"","linkedin":"","github":""},"summary":"","skills":[],"experience":[{"company":"","role":"","location":"","startDate":"","endDate":"","bullets":[]}],"education":[{"institution":"","degree":"","location":"","graduationDate":"","details":[]}],"projects":[{"name":"","link":"","bullets":[]}],"certifications":[]}`;

function validResume(value) {
  return value && typeof value === "object" && typeof value.name === "string" && typeof value.summary === "string" && Array.isArray(value.skills) && Array.isArray(value.experience) && Array.isArray(value.education) && Array.isArray(value.projects) && Array.isArray(value.certifications) && value.contact && typeof value.contact === "object";
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/```(?:json)?/gi, "").replace(/[\u0000-\u001F\u007F-\u009F\uFFFD]/g, " ").replace(/[•●▪◦]/g, "").replace(/^\s*(?:[-*]+|\d+[.)])\s*/g, "").replace(/\s+/g, " ").trim() : "";
}
function normalizeUrl(value) {
  const text = cleanText(value);
  if (!text || /\s/.test(text)) return "";
  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try { const url = new URL(candidate); return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".") ? url.href : ""; } catch { return ""; }
}
function cleanStrings(value) { return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : []; }
function sanitizeResume(value) {
  if (!validResume(value)) return null;
  const contact = value.contact || {};
  const resume = {
    name: cleanText(value.name), contact: { email: cleanText(contact.email), phone: cleanText(contact.phone), location: cleanText(contact.location), linkedin: normalizeUrl(contact.linkedin), github: normalizeUrl(contact.github) }, summary: cleanText(value.summary), skills: cleanStrings(value.skills),
    experience: value.experience.filter(item => item && typeof item === "object").map(item => ({ company: cleanText(item.company), role: cleanText(item.role), location: cleanText(item.location), startDate: cleanText(item.startDate), endDate: cleanText(item.endDate), bullets: cleanStrings(item.bullets) })).filter(item => item.company || item.role || item.bullets.length),
    education: value.education.filter(item => item && typeof item === "object").map(item => ({ institution: cleanText(item.institution), degree: cleanText(item.degree), location: cleanText(item.location), graduationDate: cleanText(item.graduationDate), details: cleanStrings(item.details) })).filter(item => item.institution || item.degree || item.details.length),
    projects: value.projects.filter(item => item && typeof item === "object").map(item => ({ name: cleanText(item.name), link: normalizeUrl(item.link), bullets: cleanStrings(item.bullets) })).filter(item => item.name || item.bullets.length), certifications: cleanStrings(value.certifications)
  };
  return resume.name || resume.summary || resume.experience.length || resume.education.length ? resume : null;
}

function preserveContactLinks(source, condensed) {
  const sourceProjects = source.projects.map(item => ({ ...item, link: normalizeUrl(item.link) })).filter(item => item.link);
  const projects = condensed.projects.map((project, index) => ({ ...project, link: sourceProjects.find(sourceProject => sourceProject.name.toLowerCase() === project.name.toLowerCase())?.link || project.link }));
  for (const project of sourceProjects) if (!projects.some(item => item.name.toLowerCase() === project.name.toLowerCase())) projects.push(project);
  return {
    ...condensed,
    contact: {
      ...condensed.contact,
      linkedin: normalizeUrl(source.contact?.linkedin) || condensed.contact.linkedin,
      github: normalizeUrl(source.contact?.github) || condensed.contact.github
    },
    projects
  };
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
    const condensed = sanitizeResume(parseJson(content));
    if (!condensed) throw Object.assign(new Error("AI returned an incomplete structured response."), { statusCode: 502 });
    return json(res, 200, { resume: preserveContactLinks(resume, condensed) });
  } catch (error) {
    console.error("One-page resume creation failed", error.message);
    return json(res, error.statusCode || 500, { error: "A concise resume could not be created. Please try again." });
  }
}