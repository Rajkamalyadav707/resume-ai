import { complete, json, parseJson, requirePost, text } from "./_lib/ica.mjs";
import { enforceRateLimit } from "./_lib/rate-limit.mjs";
const shape = `{"matchScore":0,"atsScore":0,"summary":"","matchingSkills":[],"missingSkills":[],"matchedKeywords":[],"missingKeywords":[],"experienceAlignment":"","educationAlignment":"","strengths":[],"weaknesses":[],"recommendations":[],"sectionAnalysis":{"summary":"","experience":"","skills":"","education":"","projects":""}}`;

const JOB_DESCRIPTION_ERROR =
  "Please paste a target job, career goal, or role requirements. Include the work, skills, qualifications, or responsibilities you want the resume tailored for.";
const employmentSignals = [
  /\b(job\s*(description|title|summary)|position|role|opening|vacancy|career|employment|we(?:'| a)re hiring|join (?:our|the) team|apply)\b/i,
  /\b(responsibilit(?:y|ies)|duties|what you(?:'| wi)ll do|day[- ]to[- ]day|deliverables|manage|develop|support|provide|conduct|advise|teach|research|sell|market|serve)\b/i,
  /\b(requirements?|qualifications?|must[- ]have|preferred|eligibility|candidate|applicant|skills?|experience|proficien(?:t|cy)|knowledge|degree|certification|licen[cs](?:e|ed)|years? of)\b/i,
  /\b(engineer|developer|analyst|manager|designer|consultant|specialist|architect|administrator|coordinator|director|intern|recruiter|accountant|scientist|technician|marketer|marketing|bank(?:er|ing)|financial|sales|teacher|educator|nurse|doctor|physician|surgeon|therapist|pharmacist|lawyer|attorney|paralegal|researcher|professor|journalist|writer|social worker|human resources|hr|operations|mba|bca)\b/i,
];

const nonEmploymentSignals =
  /\b(party|selfie|meme|horoscope|astrology|lottery|giveaway|dating|celebrity gossip|generate (?:an )?(?:image|photo|picture)|create (?:an )?(?:image|photo|picture))\b/i;

export function isJobDescription(value) {
  if (typeof value !== "string" || value.trim().length < 40) return false;
  if (nonEmploymentSignals.test(value)) return false;
  return (
    employmentSignals.reduce(
      (matches, signal) => matches + Number(signal.test(value)),
      0,
    ) >= 2
  );
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  if (
    !(await enforceRateLimit(req, res, {
      name: "analysis",
      limit: 5,
      windowSeconds: 600,
    }))
  )
    return;
  const resumeText = text(req.body?.resumeText, 120000);
  const jobDescription = text(req.body?.job?.description, 80000);
  if (!resumeText || !jobDescription)
    return json(res, 400, {
      error: "A readable resume and job description are required.",
    });
  if (!isJobDescription(jobDescription))
    return json(res, 422, { error: JOB_DESCRIPTION_ERROR });
  try {
    const content = await complete(
      [
        {
          role: "system",
          content: `You are a precise resume analyst. Return ONLY valid JSON matching this exact shape: ${shape}. Compare the supplied resume to the job description. Scores are guidance, not hiring predictions. Do not invent facts. Missing skills/keywords must be job requirements not evidenced in the resume. Keep arrays concise.`,
        },
        {
          role: "user",
          content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`,
        },
      ],
      4000,
      "analysis",
    );
    return json(res, 200, { analysis: parseJson(content) });
  } catch (error) {
    console.error("Resume analysis failed", error.message);
    return json(res, error.statusCode || 500, {
      error: "AI analysis is temporarily unavailable. Please try again.",
    });
  }
}
