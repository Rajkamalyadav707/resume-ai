import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Resume } from "../types";
import { normalizeUrl } from "./resume";

export type ResumeTemplate = "classic" | "modern" | "compact";
export const resumeTemplates: { id: ResumeTemplate; name: string; description: string }[] = [
  { id: "classic", name: "Classic", description: "Conservative, ATS-first single column" },
  { id: "modern", name: "Modern", description: "Refined teal hierarchy for contemporary roles" },
  { id: "compact", name: "Compact", description: "Dense layout for experienced candidates" }
];

const clean = (value: string) => value.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
const bullet = String.fromCharCode(8226);

export async function buildResumePdf(resume: Resume, template: ResumeTemplate = "classic") {
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
  const addUrlLink = (url: string, x: number, baseline: number, textWidth: number, size: number) => {
    if (!/^https?:\/\//i.test(url)) return;
    const annotation = pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, baseline - 2, x + textWidth, baseline + size], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) } }));
    page.node.addAnnot(annotation);
  };
  const writeContact = () => {
    const items = [
      { text: clean(resume.contact.email), url: "" },
      { text: clean(resume.contact.phone), url: "" },
      { text: clean(resume.contact.location), url: "" },
      { text: "LinkedIn", url: normalizeUrl(resume.contact.linkedin) },
      { text: "GitHub", url: normalizeUrl(resume.contact.github) }
    ].filter(item => item.text && (!item.url || /^https?:\/\//i.test(item.url)));
    let x = settings.margin;
    for (const [index, item] of items.entries()) {
      const prefix = index ? " | " : "", prefixWidth = regular.widthOfTextAtSize(prefix, 8), itemWidth = regular.widthOfTextAtSize(item.text, 8);
      if (x + prefixWidth + itemWidth > width - settings.margin && x > settings.margin) { y -= 12; x = settings.margin; }
      if (prefix) { page.drawText(prefix, { x, y, size: 8, font: regular, color: muted }); x += prefixWidth; }
      page.drawText(item.text, { x, y, size: 8, font: regular, color: item.url ? rgb(0, .32, .76) : muted });
      if (item.url) addUrlLink(item.url, x, y, itemWidth, 8);
      x += itemWidth;
    }
    y -= 12;
  };
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
  if ([resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.linkedin, resume.contact.github].some(Boolean)) writeContact();
  y -= 5;
  if (resume.summary) { heading("Professional Summary"); writeLines(resume.summary); }
  if (resume.skills.length) { heading("Core Skills"); writeLines(resume.skills.map(clean).filter(Boolean).join(" | "), settings.body, regular, ink, 3); }
  if (resume.experience.length) { heading("Professional Experience"); resume.experience.forEach(item => entry([item.role, item.company].map(clean).filter(Boolean).join(" | "), [item.location, [item.startDate, item.endDate].map(clean).filter(Boolean).join(" - ")].map(clean).filter(Boolean).join(" | "), item.bullets)); }
  if (resume.projects.length) { heading("Projects"); resume.projects.forEach(item => { const link = normalizeUrl(item.link); const title = [item.name, link ? "Project link" : ""].map(clean).filter(Boolean).join(" | "); const baseline = y; entry(title, "", item.bullets); if (link) { const prefix = `${clean(item.name)} | `, linkWidth = regular.widthOfTextAtSize("Project link", settings.entry); page.drawText("Project link", { x: settings.margin + regular.widthOfTextAtSize(prefix, settings.entry), y: baseline, size: settings.entry, font: bold, color: rgb(0, .32, .76) }); addUrlLink(link, settings.margin + regular.widthOfTextAtSize(prefix, settings.entry), baseline, linkWidth, settings.entry); } }); }
  if (resume.education.length) { heading("Education"); resume.education.forEach(item => entry([item.degree, item.institution].map(clean).filter(Boolean).join(" | "), [item.location || "", item.graduationDate || ""].map(clean).filter(Boolean).join(" | "), item.details || [])); }
  if (resume.certifications.length) { heading("Certifications"); writeLines(resume.certifications.map(clean).filter(Boolean).join(" | ")); }
  return pdf;
}

export async function getResumePdfPageCount(resume: Resume, template: ResumeTemplate = "classic") {
  return (await buildResumePdf(resume, template)).getPageCount();
}

export async function downloadResumePdf(resume: Resume, template: ResumeTemplate = "classic") {
  const pdf = await buildResumePdf(resume, template);
  const bytes = await pdf.save(); const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; const blob = new Blob([buffer], { type: "application/pdf" }); const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = `${clean(resume.name || "Candidate").replace(/\s+/g, "_")}_Resume_${template}.pdf`; link.style.display = "none"; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}