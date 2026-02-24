import mammoth from "mammoth";

export async function extractTextFromDocx(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (err) {
        console.error("DOCX Extraction Error:", err);
        throw new Error("Failed to extract text from DOCX.");
    }
}
