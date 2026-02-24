import { Language } from "./types";

export const LANGUAGES: { label: string; value: Language; countryCode: string }[] = [
    { label: "Arabic", value: "ar", countryCode: "AE" },
    { label: "Spanish", value: "es", countryCode: "ES" },
    { label: "Russian", value: "ru", countryCode: "RU" },
    { label: "German", value: "de", countryCode: "DE" },
    { label: "Urdu", value: "ur", countryCode: "PK" },
    { label: "Chinese", value: "zh", countryCode: "CN" },
    { label: "French", value: "fr", countryCode: "FR" },
    { label: "Korean", value: "ko", countryCode: "KR" },
    { label: "Japanese", value: "ja", countryCode: "JP" },
];

export const FREQUENCY_TIERS = {
    beginner: { min: 1, max: 500 },
    intermediate: { min: 501, max: 2000 },
    hard: { min: 2001, max: 5000 },
};
