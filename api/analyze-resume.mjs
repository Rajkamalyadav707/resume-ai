import { complete, json, parseJson, requirePost, text } from "./_lib/ica.mjs";
const shape = `{"matchScore":0,"atsScore":0,"summary":"","matchingSkills":[],"missingSkills":[],"matchedKeywords":[],"missingKeywords":[],"experienceAlignment":"","educationAlignment":"","strengths":[],"weaknesses":[],"recommendations":[],"sectionAnalysis":{"summary":"","experience":"","skills":"","education":"","projects":""}}`;
export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const resumeText = text(req.body?.resumeText, 120000); const jobDescription = text(req.body?.job?.description, 80000);
  if (!resumeText || !jobDescription) return json(res, 400, { error: "A readable resume and job description are required." });
  try {
    const content = await complete([{ role: "system", content: `You are a precise resume analyst. Return ONLY valid JSON matching this exact shape: ${shape}. Compare the supplied resume to the job description. Scores are guidance, not hiring predictions. Do not invent facts. Missing skills/keywords must be job requirements not evidenced in the resume. Keep arrays concise.` }, { role: "user", content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}` }], 4000, "analysis");
    return json(res, 200, { analysis: parseJson(content) });
  } catch (error) { console.error("Resume analysis failed", error.message); return json(res, error.statusCode || 500, { error: "AI analysis is temporarily unavailable. Please try again." }); }
}