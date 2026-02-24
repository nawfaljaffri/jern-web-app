"use client";

import { useCallback, useRef, useEffect } from "react";

export function useTTS() {
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const repeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            synthRef.current = window.speechSynthesis;
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
    }, []);

    const speak = useCallback((text: string, lang: string = "en-US", repeat: boolean = false) => {
        if (!synthRef.current) return;

        // Stop previous before starting new
        stop();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        currentUtteranceRef.current = utterance;

        utterance.onend = () => {
            if (repeat && currentUtteranceRef.current === utterance) {
                repeatTimeoutRef.current = setTimeout(() => {
                    if (currentUtteranceRef.current === utterance) {
                        synthRef.current?.speak(utterance);
                    }
                }, 1500);
            }
        };

        synthRef.current.speak(utterance);
    }, [stop]);

    return { speak, stop };
}
