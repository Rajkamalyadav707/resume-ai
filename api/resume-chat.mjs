import { complete, json, requirePost, text } from "./_lib/ica.mjs";

const MAX_HISTORY = 8;
const unrelated = /\b(weather|recipe|politics|stock|crypto|medical|legal|homework|movie|song|joke|travel)\b/i;

export function isUnrelated(message) {
  return unrelated.test(message);
}

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
  if (isUnrelated(message)) return json(res, 200, { reply: "I can help with resumes, ATS readability, job tailoring, wording, skills, achievements, and interview preparation." });
  const resume = req.body?.resume && typeof req.body.resume === "object" ? req.body.resume : null;
  const context = resume ? JSON.stringify(resume).slice(0, 30000) : "No resume has been created yet.";
  try {
    const reply = await complete([
      { role: "system", content: "You are ResumeAI, a practical, resume-only assistant. Answer only resume, job-application, career-document wording, ATS-readability, or supplied-resume questions. Politely decline unrelated requests. Treat the supplied resume as the only source of candidate-specific facts: never invent, infer, or embellish credentials, employers, dates, education, skills, metrics, or achievements. You may give general resume guidance, suggest a placeholder, or ask a focused question when evidence is missing. Do not make hiring predictions. Give the direct answer first; do not repeat the user's question, write a long tutorial, or add a generic call to upload a resume unless reviewing their specific resume requires it. Keep replies under 110 words. Use plain text with at most one short title and three '-' bullets when bullets improve clarity. For ATS questions, explain the point in one sentence and give the 2-3 most useful actions." },
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