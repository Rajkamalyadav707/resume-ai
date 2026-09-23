import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Resume } from "../types";

export type ResumeTemplate = "classic" | "modern" | "compact";
export const resumeTemplates: { id: ResumeTemplate; name: string; description: string }[] = [
  { id: "classic", name: "Classic", description: "Conservative, ATS-first single column" },
  { id: "modern", name: "Modern", description: "Refined teal hierarchy for contemporary roles" },
  { id: "compact", name: "Compact", description: "Dense layout for experienced candidates" }
];

const clean = (value: string) => value.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
const bullet = String.fromCharCode(8226);

export async function downloadResumePdf(resume: Resume, template: ResumeTemplate = "classic") {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${resume.name || "Candidate"} - Resume`);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const width = 595.28, height = 841.89;
  const settings = template === "compact" ? { margin: 38, body: 8.5, leading: 11.4, section: 9.5, entry: 9.2 } : { margin: 46, body: 9.2, leading: 13, section: 10, entry: 10 };
  const accent = template === "classic" ? rgb(.08, .12, .15) : rgb(.02, .39, .36);
  const muted = rgb(.31, .38, .38), ink = rgb(.08, .11, .13);
  let page = pdf.addPage([width, height]), y = height - settings.margin;
  const usableWidth = width - settings.margin * 2;
  const nextPage = () => { page = pdf.addPage([width, height]); y = height - settings.margin; };
  const wrapped = (value: string, font: PDFFont, size: number, indent = 0) => {
    const words = clean(value).split(" ").filter(Boolean); const lines: string[] = []; let line = "";
    for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (font.widthOfTextAtSize(candidate, size) > usableWidth - indent && line) { lines.push(line); line = word; } else line = candidate; }
    if (line) lines.push(line); return lines;
  };
  const ensure = (space: number) => { if (y - space < settings.margin) nextPage(); };
  const writeLines = (value: string, size = settings.body, font = regular, color = ink, gap = settings.leading - settings.body, indent = 0) => {
    for (const line of wrapped(value, font, size, indent)) { ensure(size + gap); page.drawText(line, { x: settings.margin + indent, y, size, font, color }); y -= size + gap; }
  };
  const writeBullet = (value: string) => {
    const lines = wrapped(value, regular, settings.body, 12); ensure(lines.length * settings.leading + 2); page.drawText(bullet, { x: settings.margin + 1, y, size: settings.body, font: regular, color: accent });
    lines.forEach((line, index) => { page.drawText(line, { x: settings.margin + 12, y, size: settings.body, font: regular, color: ink }); y -= settings.leading; if (index === lines.length - 1) y -= 1; });
  };
  const heading = (title: string) => {
    ensure(26); y -= 7; page.drawText(title.toUpperCase(), { x: settings.margin, y, size: settings.section, font: bold, color: accent }); y -= 5;
    page.drawLine({ start: { x: settings.margin, y }, end: { x: width - settings.margin, y }, thickness: template === "modern" ? 1.1 : .55, color: template === "modern" ? accent : rgb(.6, .64, .65) }); y -= 9;
  };
  const entry = (title: string, meta: string, bullets: string[]) => {
    const titleLines = wrapped(title, bold, settings.entry), metaLines = meta ? wrapped(meta, italic, settings.body - .7) : [];
    ensure(titleLines.length * settings.leading + metaLines.length * settings.leading + Math.min(bullets.length, 2) * settings.leading + 6);
    titleLines.forEach(line => { page.drawText(line, { x: settings.margin, y, size: settings.entry, font: bold, color: ink }); y -= settings.leading; });
    metaLines.forEach(line => { page.drawText(line, { x: settings.margin, y, size: settings.body - .7, font: italic, color: muted }); y -= settings.leading; });
    bullets.filter(Boolean).forEach(writeBullet); y -= 3;
  };
  if (template === "modern") page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: accent });
  page.drawText(clean(resume.name || "Optimized Resume"), { x: settings.margin, y, size: template === "compact" ? 19 : 22, font: bold, color: ink }); y -= template === "compact" ? 23 : 27;
  const contact = [resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.linkedin, resume.contact.github].map(clean).filter(Boolean).join(" | ");
  if (contact) writeLines(contact, 8, regular, muted, 4); y -= 5;
  if (resume.summary) { heading("Professional Summary"); writeLines(resume.summary); }
  if (resume.skills.length) { heading("Core Skills"); writeLines(resume.skills.map(clean).filter(Boolean).join(" | "), settings.body, regular, ink, 3); }
  if (resume.experience.length) { heading("Professional Experience"); resume.experience.forEach(item => entry([item.role, item.company].map(clean).filter(Boolean).join(" | "), [item.location, [item.startDate, item.endDate].map(clean).filter(Boolean).join(" - ")].map(clean).filter(Boolean).join(" | "), item.bullets)); }
  if (resume.projects.length) { heading("Projects"); resume.projects.forEach(item => entry([item.name, item.link || ""].map(clean).filter(Boolean).join(" | "), "", item.bullets)); }
  if (resume.education.length) { heading("Education"); resume.education.forEach(item => entry([item.degree, item.institution].map(clean).filter(Boolean).join(" | "), [item.location || "", item.graduationDate || ""].map(clean).filter(Boolean).join(" | "), item.details || [])); }
  if (resume.certifications.length) { heading("Certifications"); writeLines(resume.certifications.map(clean).filter(Boolean).join(" | ")); }
  const bytes = await pdf.save(); const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; const blob = new Blob([buffer], { type: "application/pdf" }); const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = `${clean(resume.name || "Candidate").replace(/\s+/g, "_")}_Resume_${template}.pdf`; link.click(); URL.revokeObjectURL(link.href);
}