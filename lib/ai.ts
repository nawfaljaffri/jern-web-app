import { pipeline } from "@xenova/transformers";

let translator: any = null;

export async function getTranslator() {
    if (!translator) {
        // Using a small, efficient model for browser use
        // 'Xenova/t5-small' or 'Xenova/m2m100_418M' (lighter versions available)
        translator = await pipeline("translation", "Xenova/m2m100_418M");
    }
    return translator;
}

export async function translateText(text: string, targetLang: string = "ar") {
    const translate = await getTranslator();
    const output = await translate(text, {
        src_lang: "en",
        tgt_lang: targetLang,
    });
    return output[0].translation_text;
}

// Simple Romanization helper (mock or real if possible)
// In a real app, one would use a library or a specific AI task
export function romanizeArabic(text: string): string {
    // This is a very complex task for simple JS. 
    // For the demo, we'll provide a few mappings or use a placeholder logic.
    // In a production app, we'd use a dedicated library like 'arabic-to-roman'
    return text; // Placeholder
}
