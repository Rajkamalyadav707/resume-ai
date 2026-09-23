import { complete, json, parseJson, requirePost, text } from "./_lib/ica.mjs";
const shape = `{"matchScore":0,"atsScore":0,"summary":"","matchingSkills":[],"missingSkills":[],"matchedKeywords":[],"missingKeywords":[],"experienceAlignment":"","educationAlignment":"","strengths":[],"weaknesses":[],"recommendations":[],"sectionAnalysis":{"summary":"","experience":"","skills":"","education":"","projects":""}}`;

const JOB_DESCRIPTION_ERROR = "That doesn't look like a job description. Please paste the role's responsibilities, requirements, skills, or qualifications and try again.";
const jobSignals = [
  /\b(job\s*(description|title|summary)|position|role|opening|vacancy|we(?:'| a)re hiring|join (?:our|the) team|apply)\b/i,
  /\b(responsibilit(?:y|ies)|duties|what you(?:'| wi)ll do|day[- ]to[- ]day|deliverables)\b/i,
  /\b(requirements?|qualifications?|must[- ]have|preferred|eligibility|candidate|applicant)\b/i,
  /\b(skills?|experience|proficien(?:t|cy)|knowledge|degree|certification|years? of)\b/i,
  /\b(engineer|developer|analyst|manager|designer|consultant|specialist|architect|administrator|coordinator|director|intern|recruiter|accountant|scientist|technician)\b/i
];

export function isJobDescription(value) {
  if (typeof value !== "string" || value.trim().length < 40) return false;
  return jobSignals.reduce((matches, signal) => matches + Number(signal.test(value)), 0) >= 2;
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const resumeText = text(req.body?.resumeText, 120000); const jobDescription = text(req.body?.job?.description, 80000);
  if (!resumeText || !jobDescription) return json(res, 400, { error: "A readable resume and job description are required." });
  if (!isJobDescription(jobDescription)) return json(res, 422, { error: JOB_DESCRIPTION_ERROR });
  try {
    const content = await complete([{ role: "system", content: `You are a precise resume analyst. Return ONLY valid JSON matching this exact shape: ${shape}. Compare the supplied resume to the job description. Scores are guidance, not hiring predictions. Do not invent facts. Missing skills/keywords must be job requirements not evidenced in the resume. Keep arrays concise.` }, { role: "user", content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}` }], 4000, "analysis");
    return json(res, 200, { analysis: parseJson(content) });
  } catch (error) { console.error("Resume analysis failed", error.message); return json(res, error.statusCode || 500, { error: "AI analysis is temporarily unavailable. Please try again." }); }
}