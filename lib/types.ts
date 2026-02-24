export type Language = 'ar' | 'es' | 'ru' | 'de' | 'ur' | 'zh' | 'fr' | 'ko' | 'ja';
export type Difficulty = 'beginner' | 'intermediate' | 'hard';

export interface Word {
    id: string;
    romanized: string;
    original: string;
    definition: string;
    language?: Language;
    frequency?: number; // 1 to 5000
}

export interface SessionSettings {
    language: Language;
    difficulty: Difficulty;
    audioRepeat: boolean;
    activeRecall: boolean;
    penThickness?: number;
    penColor?: string;
}

export interface SessionStats {
    correctChars: number;
    totalChars: number;
    startTime: number | null;
}
