import test from "node:test";
import assert from "node:assert/strict";
import { parseJson, text } from "../api/_lib/ica.mjs";
import { isUnrelated } from "../api/resume-chat.mjs";
import analyzeResume, { isJobDescription } from "../api/analyze-resume.mjs";

test("text validates non-empty bounded strings", () => {
  assert.equal(text("  resume  ", 20), "resume");
  assert.equal(text("", 20), null);
  assert.equal(text("toolong", 3), null);
});
test("parseJson accepts plain and fenced JSON", () => {
  assert.deepEqual(parseJson('{"score": 80}'), { score: 80 });
  assert.deepEqual(parseJson('```json\n{"score": 80}\n```'), { score: 80 });
});
test("parseJson rejects invalid responses", () => {
  assert.throws(() => parseJson("not json"));
});
test("resume chat rejects clearly unrelated topics without blocking ATS questions", () => {
  assert.equal(isUnrelated("Can you give me a weather forecast?"), true);
  assert.equal(isUnrelated("How can I make my resume more ATS friendly?"), false);
});
test("job description guardrail supports diverse career paths and rejects non-job content", () => {
  assert.equal(isJobDescription("Software Engineer role. Responsibilities include building React applications and collaborating with product teams. Required skills include JavaScript, REST APIs, and three years of experience."), true);
  assert.equal(isJobDescription("Banking Relationship Manager: manage client portfolios, advise customers on financial products, and meet sales goals. MBA or finance degree, customer service skills, and two years of banking experience are preferred."), true);
  assert.equal(isJobDescription("General Physician position. Provide patient consultations, diagnose common illnesses, maintain clinical records, and coordinate follow-up care. An MBBS degree, active medical licence, and strong communication skills are required."), true);
  assert.equal(isJobDescription("Marketing Executive role for a BCA or MBA graduate. Develop campaigns, conduct market research, manage social media performance, and report results. Digital marketing knowledge and communication skills are required."), true);
  assert.equal(isJobDescription("Create a party image with balloons and confetti for my social media profile."), false);
  assert.equal(isJobDescription("Hello, I'm a rock star and this is a little about me."), false);
});
test("analysis rejects non-job text before calling the AI service", async () => {
  const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, setHeader() { return this; }, send(body) { this.body = body; return this; } };
  await analyzeResume({ method: "POST", body: { resumeText: "Candidate resume text", job: { description: "Hello, I'm a rock star and this is a little about me." } } }, res);
  assert.equal(res.statusCode, 422);
  assert.match(res.body.error, /paste a target job, career goal, or role requirements/i);
});