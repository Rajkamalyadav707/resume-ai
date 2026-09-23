import mammoth from "mammoth";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

const maxFileSize = 8 * 1024 * 1024;
const isPdf = (file: File) => file.name.toLowerCase().endsWith(".pdf");
const isDocx = (file: File) => file.name.toLowerCase().endsWith(".docx");

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
    if (!value.trim()) throw new Error("empty");
    return value;
  } catch {
    throw new Error(
      "We couldn't read that PDF. Upload a text-based PDF, not a scanned image, or try a DOCX version.",
    );
  }
}
