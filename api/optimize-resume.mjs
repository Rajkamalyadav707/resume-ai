import { complete, json, parseJson, requirePost, text } from "./_lib/ica.mjs";
const shape = `{"name":"","contact":{"email":"","phone":"","location":"","linkedin":"","github":""},"summary":"","skills":[],"experience":[{"company":"","role":"","location":"","startDate":"","endDate":"","bullets":[]}],"education":[{"institution":"","degree":"","location":"","graduationDate":"","details":[]}],"projects":[{"name":"","link":"","bullets":[]}],"certifications":[]}`;
export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const resumeText = text(req.body?.resumeText, 120000); const jobDescription = text(req.body?.job?.description, 80000);
  if (!resumeText || !jobDescription) return json(res, 400, { error: "A readable resume and job description are required." });
  try {
    const content = await complete([{ role: "system", content: `You optimize resumes truthfully. Return ONLY valid JSON matching: ${shape}. Use ONLY facts, roles, companies, dates, education, projects, skills, certifications and metrics supported by the original resume. Never fabricate or infer qualifications. Improve clarity, ATS structure and truthful job-relevant wording. Preserve the candidate's actual chronology. Write concise, impact-first bullets only where the source supports them. Omit unsupported fields as empty strings/arrays.` }, { role: "user", content: `ORIGINAL RESUME:\n${resumeText}\n\nTARGET JOB:\n${jobDescription}\n\nPRIOR ANALYSIS (advisory):\n${JSON.stringify(req.body?.analysis || {})}` }], 6000, "optimization");
    return json(res, 200, { resume: parseJson(content) });
  } catch (error) { console.error("Resume optimization failed", error.message); return json(res, error.statusCode || 500, { error: "AI optimization is temporarily unavailable. Please try again." }); }
}