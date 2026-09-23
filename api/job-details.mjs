import { json, requirePost, text } from "./_lib/ica.mjs";
import { enforceRateLimit } from "./_lib/rate-limit.mjs";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [first, second] = address.split(".").map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fe80:") ||
      /^[fd][0-9a-f]{0,3}:/.test(normalized) ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") ||
      /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
      normalized.startsWith("::ffff:169.254.")
    );
  }
  return true;
}

export async function assertPublicHttpUrl(value) {
  const target = value instanceof URL ? value : new URL(value);
  if (
    !/^https?:$/.test(target.protocol) ||
    target.username ||
    target.password ||
    !target.hostname
  )
    throw new Error("Invalid public URL");
  const hostname = target.hostname.replace(/^\[|\]$/g, "");
  if (hostname.toLowerCase() === "localhost")
    throw new Error("Private destination");
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("Private destination");
    return target;
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateAddress(address))
  )
    throw new Error("Private destination");
  return target;
}

async function fetchPublicUrl(target) {
  let current = await assertPublicHttpUrl(target);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(current, {
      headers: {
        "User-Agent": "ResumeAI Job Extractor/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirectCount === 3) throw new Error("Unsafe redirect");
    current = await assertPublicHttpUrl(new URL(location, current));
  }
  throw new Error("Too many redirects");
}

export function infosysDescription(posting) {
  const sections = [
    posting.postingDesc,
    posting.rolesResponsibilities,
    posting.techRequirement,
    posting.addResponsibility,
    posting.preferredSkills && `Preferred skills: ${posting.preferredSkills}`,
    posting.genericSkills && `Additional skills: ${posting.genericSkills}`,
    posting.educationalRequirement &&
      `Education: ${posting.educationalRequirement}`,
    posting.minExperienceLevel != null &&
      `Experience: ${posting.minExperienceLevel}${posting.maxExperienceLevel != null ? `-${posting.maxExperienceLevel}` : "+"} years`,
  ].filter((value) => typeof value === "string" && value.trim());
  return sections.join("\n\n").trim();
}

export async function fetchInfosysJob(target, originalUrl) {
  if (
    !/(^|\.)career\.infosys\.com$/i.test(target.hostname) ||
    !/^\/jobdesc\/?$/i.test(target.pathname)
  )
    return null;
  const referenceCode = target.searchParams.get("jobReferenceCode");
  if (!referenceCode || !/^[A-Za-z0-9_-]{1,200}$/.test(referenceCode))
    return null;
  const endpoint = `https://intapgateway.infosysapps.com/careersci/search/intapjbsrch/getJobDesc?referenceCode=${encodeURIComponent(referenceCode)}`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ResumeAI Job Extractor/1.0",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Infosys job fetch failed");
  const posting = await response.json();
  const description = infosysDescription(posting);
  if (description.length < 100)
    throw new Error("Infosys job has insufficient content");
  return {
    title: text(posting.postingTitle, 500) || "Infosys job posting",
    company: text(posting.organizationName, 500) || "Infosys",
    location:
      [text(posting.city, 200), text(posting.country, 200)]
        .filter(Boolean)
        .join(", ") || undefined,
    description: description.slice(0, 50000),
    url: originalUrl,
  };
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  if (
    !(await enforceRateLimit(req, res, {
      name: "job-details",
      limit: 10,
      windowSeconds: 600,
    }))
  )
    return;
  const url = text(req.body?.url, 2048);
  if (!url) return json(res, 400, { error: "Enter a valid job posting URL." });
  let target;
  try {
    target = await assertPublicHttpUrl(url);
  } catch {
    return json(res, 400, { error: "Enter a valid public http(s) job URL." });
  }
  try {
    const infosysJob = await fetchInfosysJob(target, url);
    if (infosysJob) return json(res, 200, { job: infosysJob });
    const response = await fetchPublicUrl(target);
    if (!response.ok) throw new Error("Fetch failed");
    const html = await response.text();
    const description = stripHtml(html).slice(0, 50000);
    if (description.length < 250) throw new Error("Insufficient content");
    const title = (
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Job posting"
    )
      .replace(/<[^>]+>/g, "")
      .trim();
    return json(res, 200, { job: { title, description, url } });
  } catch {
    return json(res, 422, {
      error:
        "We couldn't read this job posting. Please paste the job description instead.",
    });
  }
}
