import { pinyin } from 'pinyin-pro';
import arTranslit from 'arabic-transliterate';

export function transliterate(word: string, lang: string): string {
    if (!word) return "";

    try {
        switch (lang) {
            case 'zh':
                // Generate pinyin without tone marks for typing
                return pinyin(word, { toneType: 'none', type: 'string', v: true });
            case 'ar':
                // Arabic transliteration
                return arTranslit(word).toLowerCase().replace(/[^a-z\'\-]/g, '');
            case 'ur':
                // Basic Urdu/Perso-Arabic mapping as fallback
                // The data pack should ideally contain romanized strings.
                return arTranslit(word).toLowerCase().replace(/[^a-z\'\-]/g, '');
            case 'ru':
                return transliterateCyrillic(word);
            default:
                // Strip accents and special characters for Latin-based languages
                return word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, '');
        }
    } catch (error) {
        console.error("Transliteration error:", error);
        return word.toLowerCase().replace(/[^a-z]/g, '');
    }
}

// Basic Cyrillic to Latin transliteration
function transliterateCyrillic(text: string): string {
    const cyrillicToLatin: Record<string, string> = {
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
        'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
        'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
        'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu',
        'Я': 'Ya',
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
        'я': 'ya'
    };

    return text.split('').map(char => cyrillicToLatin[char] || char).join('').toLowerCase().replace(/[^a-z]/g, '');
}
