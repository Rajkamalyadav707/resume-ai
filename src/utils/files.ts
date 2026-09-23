import mammoth from "mammoth";
export async function extractResumeText(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Please upload a resume smaller than 8 MB.");
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx")) {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }); if (!result.value.trim()) throw new Error("Couldn't read this file. Please upload a valid PDF or DOCX resume."); return result.value;
  }
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise; let value = "";
    for (let page = 1; page <= pdf.numPages; page += 1) { const content = await (await pdf.getPage(page)).getTextContent(); value += content.items.map((item: any) => item.str).join(" ") + "\n"; }
    if (!value.trim()) throw new Error("Couldn't read this file. Please upload a text-based PDF or DOCX resume."); return value;
  }
  throw new Error("Please upload a valid PDF or DOCX file.");
}