import { json, requirePost, text } from "./_lib/ica.mjs";
function stripHtml(html) { return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

export function infosysDescription(posting) {
  const sections = [
    posting.postingDesc,
    posting.rolesResponsibilities,
    posting.techRequirement,
    posting.addResponsibility,
    posting.preferredSkills && `Preferred skills: ${posting.preferredSkills}`,
    posting.genericSkills && `Additional skills: ${posting.genericSkills}`,
    posting.educationalRequirement && `Education: ${posting.educationalRequirement}`,
    posting.minExperienceLevel != null && `Experience: ${posting.minExperienceLevel}${posting.maxExperienceLevel != null ? `-${posting.maxExperienceLevel}` : "+"} years`
  ].filter(value => typeof value === "string" && value.trim());
  return sections.join("\n\n").trim();
}

export async function fetchInfosysJob(target, originalUrl) {
  if (!/(^|\.)career\.infosys\.com$/i.test(target.hostname) || !/^\/jobdesc\/?$/i.test(target.pathname)) return null;
  const referenceCode = target.searchParams.get("jobReferenceCode");
  if (!referenceCode || !/^[A-Za-z0-9_-]{1,200}$/.test(referenceCode)) return null;
  const endpoint = `https://intapgateway.infosysapps.com/careersci/search/intapjbsrch/getJobDesc?referenceCode=${encodeURIComponent(referenceCode)}`;
  const response = await fetch(endpoint, { headers: { Accept: "application/json", "User-Agent": "ResumeAI Job Extractor/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Infosys job fetch failed");
  const posting = await response.json();
  const description = infosysDescription(posting);
  if (description.length < 100) throw new Error("Infosys job has insufficient content");
  return {
    title: text(posting.postingTitle, 500) || "Infosys job posting",
    company: text(posting.organizationName, 500) || "Infosys",
    location: [text(posting.city, 200), text(posting.country, 200)].filter(Boolean).join(", ") || undefined,
    description: description.slice(0, 50000),
    url: originalUrl
  };
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const url = text(req.body?.url, 2048); if (!url) return json(res, 400, { error: "Enter a valid job posting URL." });
  let target; try { target = new URL(url); if (!/^https?:$/.test(target.protocol)) throw new Error(); } catch { return json(res, 400, { error: "Enter a valid public http(s) job URL." }); }
  try {
    const infosysJob = await fetchInfosysJob(target, url);
    if (infosysJob) return json(res, 200, { job: infosysJob });
    const response = await fetch(target, { headers: { "User-Agent": "ResumeAI Job Extractor/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Fetch failed");
    const html = await response.text(); const description = stripHtml(html).slice(0, 50000);
    if (description.length < 250) throw new Error("Insufficient content");
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Job posting").replace(/<[^>]+>/g, "").trim();
    return json(res, 200, { job: { title, description, url } });
  } catch { return json(res, 422, { error: "We couldn't read this job posting. Please paste the job description instead." }); }
}