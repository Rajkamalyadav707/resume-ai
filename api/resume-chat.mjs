import { complete, json, requirePost, text } from "./_lib/ica.mjs";

const MAX_HISTORY = 8;
const unrelated = /\b(weather|recipe|politics|stock|crypto|medical|legal|homework|movie|song|joke|travel)\b/i;

function safeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_HISTORY).flatMap(item => {
    if (!item || (item.role !== "user" && item.role !== "assistant")) return [];
    const content = text(item.content, 3000);
    return content ? [{ role: item.role, content }] : [];
  });
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const message = text(req.body?.message, 3000);
  if (!message) return json(res, 400, { error: "Enter a resume-related question." });
  if (unrelated.test(message)) return json(res, 200, { reply: "I can help only with your resume: wording, structure, job tailoring, skills, achievements, or interview-ready resume preparation." });
  const resume = req.body?.resume && typeof req.body.resume === "object" ? req.body.resume : null;
  const context = resume ? JSON.stringify(resume).slice(0, 30000) : "No resume has been created yet.";
  try {
    const reply = await complete([
      { role: "system", content: "You are ResumeAI, a concise resume-only assistant. Answer only questions about resumes, job applications, career-document wording, ATS readability, or the supplied resume. Politely decline unrelated requests. Treat the supplied resume as the only source of candidate facts. Never invent, infer, embellish, or recommend adding credentials, employers, dates, education, skills, metrics, or achievements not evidenced there. You may suggest placeholders or questions to ask the candidate. Do not make hiring predictions. Keep answers under 180 words and use plain text." },
      { role: "system", content: `CURRENT RESUME CONTEXT:\n${context}` },
      ...safeHistory(req.body?.history),
      { role: "user", content: message }
    ], 700, "chat");
    return json(res, 200, { reply: reply.trim() });
  } catch (error) {
    console.error("Resume chat failed", error.message);
    return json(res, error.statusCode || 500, { error: "ResumeAI chat is temporarily unavailable. Please try again." });
  }
}