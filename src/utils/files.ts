import mammoth from "mammoth";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

const maxFileSize = 8 * 1024 * 1024;
const isPdf = (file: File) => file.name.toLowerCase().endsWith(".pdf");
const isDocx = (file: File) => file.name.toLowerCase().endsWith(".docx");

const resumeSectionSignals = [
  /\b(summary|objective|profile)\b/i,
  /\b(experience|employment|work history|professional history)\b/i,
  /\b(education|academic|degree|university|college)\b/i,
  /\b(skills|technical skills|core competencies|technologies)\b/i,
  /\b(projects?|portfolio)\b/i,
  /\b(certifications?|licenses?)\b/i,
];
const resumeDetailSignals = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+?\d[\d\s().-]{7,}\d)/,
  /\b(19|20)\d{2}\b/,
  /\b(developed|managed|created|built|led|designed|improved|supported|achieved|worked|responsible)\b/i,
];

export function validateResumeText(value: string): string | null {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 120)
    return "This file does not contain enough information to be a resume. Upload a real resume with your name, skills, education, or work experience.";

  const sectionCount = resumeSectionSignals.filter((signal) =>
    signal.test(normalized),
  ).length;
  const detailCount = resumeDetailSignals.filter((signal) =>
    signal.test(normalized),
  ).length;
  if (sectionCount < 2 || detailCount < 2)
    return "This does not look like a complete resume. Upload a resume with proper details such as your name, contact information, skills, education, work experience, or projects.";

  return null;
}

type PromiseWithResolvers = <T>() => {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function supportOlderMobileBrowsers() {
  const promiseWithResolvers = Promise as PromiseConstructor & {
    withResolvers?: PromiseWithResolvers;
  };
  if (promiseWithResolvers.withResolvers) return;

  promiseWithResolvers.withResolvers = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };
}

export async function extractResumeText(file: File): Promise<string> {
  if (file.size > maxFileSize)
    throw new Error("Choose a PDF or DOCX file no larger than 8 MB.");
  if (!isPdf(file) && !isDocx(file))
    throw new Error("Choose a PDF or DOCX resume file.");

  if (isDocx(file)) {
    try {
      const result = await mammoth.extractRawText({
        arrayBuffer: await file.arrayBuffer(),
      });
      if (!result.value.trim()) throw new Error("empty");
      return result.value;
    } catch {
      throw new Error(
        "We couldn't read that DOCX. Try re-saving it as a standard .docx file and upload it again.",
      );
    }
  }

  try {
    // PDF.js 6 uses Promise.withResolvers, which is absent in older iOS Safari.
    supportOlderMobileBrowsers();
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // Vite fingerprints bundled assets, so PDF.js cannot reliably discover its worker
    // from its default relative path in a production browser build.
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const pdf = await loadingTask.promise;
    let value = "";
    for (let page = 1; page <= pdf.numPages; page += 1) {
      const content = await (await pdf.getPage(page)).getTextContent();
      value += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    await loadingTask.destroy();
    if (!value.trim())
      throw new Error(
        "This PDF contains no selectable text. Upload a readable PDF or DOCX instead of a photo or scanned image.",
      );
    return value;
  } catch {
    throw new Error(
      "We couldn't read that PDF. Upload a text-based PDF, not a scanned image, or try a DOCX version.",
    );
  }
}
