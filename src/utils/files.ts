import mammoth from "mammoth";

const maxFileSize = 8 * 1024 * 1024;
const isPdf = (file: File) => file.name.toLowerCase().endsWith(".pdf");
const isDocx = (file: File) => file.name.toLowerCase().endsWith(".docx");

export async function extractResumeText(file: File): Promise<string> {
  if (file.size > maxFileSize) throw new Error("Choose a PDF or DOCX file no larger than 8 MB.");
  if (!isPdf(file) && !isDocx(file)) throw new Error("Choose a PDF or DOCX resume file.");

  if (isDocx(file)) {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      if (!result.value.trim()) throw new Error("empty");
      return result.value;
    } catch {
      throw new Error("We couldn't read that DOCX. Try re-saving it as a standard .docx file and upload it again.");
    }
  }

  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let value = "";
    for (let page = 1; page <= pdf.numPages; page += 1) {
      const content = await (await pdf.getPage(page)).getTextContent();
      value += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    if (!value.trim()) throw new Error("empty");
    return value;
  } catch {
    throw new Error("We couldn't read that PDF. Upload a text-based PDF, not a scanned image, or try a DOCX version.");
  }
}