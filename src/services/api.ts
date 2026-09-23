import type { Analysis, ChatMessage, Job, Resume } from "../types";
async function call<T>(url: string, body: unknown): Promise<T> { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again."); return data; }
export const analyzeResume = (resumeText: string, job: Job) => call<{ analysis: Analysis }>("/api/analyze-resume", { resumeText, job });
export const optimizeResume = (resumeText: string, job: Job, analysis: Analysis) => call<{ resume: Resume }>("/api/optimize-resume", { resumeText, job, analysis });
export const fetchJob = (url: string) => call<{ job: Job }>("/api/job-details", { url });
export const resumeChat = (message: string, resume: Resume | null, history: ChatMessage[]) => call<{ reply: string }>("/api/resume-chat", { message, resume, history });