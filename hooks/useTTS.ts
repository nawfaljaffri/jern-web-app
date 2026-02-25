"use client";

import { useCallback, useRef, useEffect, useState } from "react";

export function useTTS() {
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const repeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // We store voices in state so components can react if needed
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const stop = useCallback(() => {
        if (repeatTimeoutRef.current) {
            clearTimeout(repeatTimeoutRef.current);
            repeatTimeoutRef.current = null;
        }
        if (synthRef.current) {
            synthRef.current.cancel();
        }
        currentUtteranceRef.current = null;
        setIsSpeaking(false);
        setIsPending(false);
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined" && window.speechSynthesis) {
            synthRef.current = window.speechSynthesis;

            // Function to load voices
            const loadVoices = () => {
                const availableVoices = window.speechSynthesis.getVoices();
                if (availableVoices.length > 0) {
                    setVoices(availableVoices);
                }
            };

            // Load immediately (Chrome sometimes has them ready)
            loadVoices();

            // Safari / some engines load them asynchronously
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }

            const handleVisibilityChange = () => {
                if (document.visibilityState === 'hidden') {
                    stop();
                    window.speechSynthesis.cancel();
                }
            };

            const handleBeforeUnload = () => {
                stop();
                window.speechSynthesis.cancel();
            };

            window.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('beforeunload', handleBeforeUnload);

            return () => {
                window.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('beforeunload', handleBeforeUnload);
                stop();
            };
        }
        return () => {
            stop();
        };
    }, [stop]); // Added stop to dependency array as it's used in cleanup

    const speak = useCallback((text: string, lang: string = "en-US", repeat: boolean = false) => {
        if (!synthRef.current) return;

        // Stop previous before starting new
        stop();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;

        setIsPending(true);

        // Smart Voice Selection logic
        if (voices.length > 0) {
            let matchedVoice;

            // Special handling for English (especially on iOS to avoid robotic default)
            if (lang.startsWith("en")) {
                const preferredUSNames = ["Samantha", "Ava", "Allison", "Susan", "Siri", "Google US English"];

                // 1. Try to find a premium/enhanced US voice matching preferred names
                matchedVoice = voices.find(v => v.lang === "en-US" && preferredUSNames.some(name => v.name.includes(name)) && (v.name.includes("Premium") || v.name.includes("Enhanced")));

                // 2. Try any of the preferred US names (standard quality)
                if (!matchedVoice) {
                    matchedVoice = voices.find(v => v.lang === "en-US" && preferredUSNames.some(name => v.name.includes(name)));
                }

                // 3. Try any premium en-US voice
                if (!matchedVoice) {
                    matchedVoice = voices.find(v => v.lang === "en-US" && (v.name.includes("Premium") || v.name.includes("Enhanced")));
                }

                // 4. Fallback to any en-US voice
                if (!matchedVoice) {
                    matchedVoice = voices.find(v => v.lang === "en-US");
                }

                // 5. Final fallback to any English voice
                if (!matchedVoice) {
                    matchedVoice = voices.find(v => v.lang.startsWith("en"));
                }
            } else {
                // For other languages, try an exact match (e.g. 'fr-FR')
                matchedVoice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase());

                // Try matching just the base language (e.g. 'fr')
                if (!matchedVoice) {
                    const baseLang = lang.split('-')[0].toLowerCase();
                    matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(baseLang));
                }
            }

            if (matchedVoice) {
                utterance.voice = matchedVoice;
            }
        }

        currentUtteranceRef.current = utterance;

        utterance.onstart = () => {
            if (currentUtteranceRef.current === utterance) {
                setIsPending(false);
                setIsSpeaking(true);
            }
        };

        utterance.onend = () => {
            if (currentUtteranceRef.current === utterance) {
                setIsSpeaking(false);
                if (repeat) {
                    repeatTimeoutRef.current = setTimeout(() => {
                        if (currentUtteranceRef.current === utterance) {
                            synthRef.current?.speak(utterance);
                        }
                    }, 1500);
                }
            }
        };

        utterance.onerror = (e) => {
            if (currentUtteranceRef.current === utterance) {
                setIsPending(false);
                setIsSpeaking(false);
                console.error("Speech Synthesis Error:", e);
            }
        };

        synthRef.current.speak(utterance);
    }, [stop, voices]);

    return { speak, stop, voices, isSpeaking, isPending };
}
