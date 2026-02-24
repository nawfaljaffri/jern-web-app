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

    useEffect(() => {
        if (typeof window !== "undefined" && window.speechSynthesis) {
            synthRef.current = window.speechSynthesis;

            // Function to load voices
            const loadVoices = () => {
                const availableVoices = window.speechSynthesis.getVoices();
                setVoices(availableVoices);
            };

            // Load immediately (Chrome sometimes has them ready)
            loadVoices();

            // Safari / some engines load them asynchronously
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
        }
        return () => {
            stop();
        };
    }, []);

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
            // 1. Try an exact match (e.g. 'fr-FR')
            let matchedVoice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase());

            // 2. Try matching just the base language (e.g. 'fr')
            if (!matchedVoice) {
                const baseLang = lang.split('-')[0].toLowerCase();
                matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(baseLang));
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
