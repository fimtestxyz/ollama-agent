export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".mdx"] as const;
export type SupportedExt = (typeof SUPPORTED_EXTENSIONS)[number];

export class ExtractError extends Error {}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export async function extractText(
  name: string,
  buffer: Buffer
): Promise<string> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new ExtractError("File exceeds the 20 MB limit.");
  }
  const ext = extOf(name);

  switch (ext) {
    case ".pdf": {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      return data.text ?? "";
    }
    case ".docx": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value ?? "";
    }
    case ".txt":
    case ".md":
    case ".mdx":
      return buffer.toString("utf-8");
    case ".doc":
      throw new ExtractError(
        "Legacy .doc files aren't supported — save as .docx and re-upload."
      );
    default:
      throw new ExtractError(
        "Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file."
      );
  }
}

export function isSupported(name: string): boolean {
  const ext = extOf(name);
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}
