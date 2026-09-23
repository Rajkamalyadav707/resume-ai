import type { Education, Experience, Project, Resume } from "../types";

const stringValue = (value: unknown) => typeof value === "string" ? value
  .replace(/```(?:json)?/gi, "")
  .replace(/[\u0000-\u001F\u007F-\u009F\uFFFD]/g, " ")
  .replace(/[•●▪◦]/g, "")
  .replace(/^\s*(?:[-*]+|\d+[.)])\s*/g, "")
  .replace(/\s+/g, " ").trim() : "";

export const normalizeUrl = (value: unknown) => {
  const text = stringValue(value);
  if (!text || /\s/.test(text)) return "";
  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".") ? url.href : "";
  } catch { return ""; }
};

const strings = (value: unknown) => Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
const contact = (value: unknown) => {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { email: stringValue(source.email), phone: stringValue(source.phone), location: stringValue(source.location), linkedin: normalizeUrl(source.linkedin), github: normalizeUrl(source.github) };
};
const experience = (value: unknown): Experience[] => Array.isArray(value) ? value.map(item => {
  const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
  return { company: stringValue(source.company), role: stringValue(source.role), location: stringValue(source.location), startDate: stringValue(source.startDate), endDate: stringValue(source.endDate), bullets: strings(source.bullets) };
}).filter(item => item.company || item.role || item.bullets.length) : [];
const education = (value: unknown): Education[] => Array.isArray(value) ? value.map(item => {
  const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
  return { institution: stringValue(source.institution), degree: stringValue(source.degree), location: stringValue(source.location), graduationDate: stringValue(source.graduationDate), details: strings(source.details) };
}).filter(item => item.institution || item.degree || item.details?.length) : [];
const projects = (value: unknown): Project[] => Array.isArray(value) ? value.map(item => {
  const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
  return { name: stringValue(source.name), link: normalizeUrl(source.link), bullets: strings(source.bullets) };
}).filter(item => item.name || item.bullets.length) : [];

export function sanitizeResume(value: unknown): Resume | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const result: Resume = { name: stringValue(source.name), contact: contact(source.contact), summary: stringValue(source.summary), skills: strings(source.skills), experience: experience(source.experience), education: education(source.education), projects: projects(source.projects), certifications: strings(source.certifications) };
  return result.name || result.summary || result.experience.length || result.education.length ? result : null;
}