"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Word } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Volume2, Loader2, Volume1 } from "lucide-react";
import DrawingCanvas from "./DrawingCanvas";

const TTS_LANG_MAP: Record<string, string> = {
    ar: "ar-SA",
    ur: "ur",
    zh: "zh",
    ru: "ru",
    es: "es",
    de: "de",
    fr: "fr",
    ko: "ko",
    ja: "ja",
};

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface TypingTestProps {
    word: Word;
    onComplete: () => void;
    onMismatch?: () => void;
    onSpeak: (text: string, lang: string) => void;
    isSpeaking?: boolean;
    isPending?: boolean;
    isIOS?: boolean;
    penThickness?: number;
    penColor?: string;
}

export default function TypingTest({ word, onComplete, onMismatch, onSpeak, isSpeaking, isPending, isIOS, penThickness, penColor }: TypingTestProps) {
    const [userInput, setUserInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(true);
    const [isShaking, setIsShaking] = useState(false);
    const [audioMode, setAudioMode] = useState<"en" | "original">("en");

    useEffect(() => {
        inputRef.current?.focus();
        setTimeout(() => {
            setUserInput("");
            setIsShaking(false);
        }, 0);
    }, [word]);

    const triggerError = useCallback(() => {
        setIsShaking(true);
        onMismatch?.();
        setTimeout(() => setIsShaking(false), 500);
    }, [onMismatch]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip word feature
            if (e.key === "Tab" || e.key === "Escape" || e.key === "ArrowRight") {
                e.preventDefault();
                triggerError(); // Visual feedback
                setTimeout(() => {
                    onComplete();
                    setUserInput("");
                }, 300);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onComplete, word, triggerError]);

    const normalizedRomanized = React.useMemo(() => {
        // Strip out accents (NFD), quotes, spaces, hyphens
        return word.romanized.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    }, [word.romanized]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase();

        // Character length limit
        if (value.length > normalizedRomanized.length) {
            triggerError();
            return;
        }

        // Check if the typed character is correct so far
        const lastIndex = value.length - 1;
        if (lastIndex >= 0 && value[lastIndex] !== normalizedRomanized[lastIndex]) {
            triggerError();
            // We still update the input so they can see the red character
        }

        setUserInput(value);

        if (value === normalizedRomanized) {
            setTimeout(() => {
                onComplete();
                setUserInput("");
            }, 150);
        }
    };

    return (
        <div
            className="relative flex flex-col items-center justify-center min-h-[400px] md:min-h-[500px] w-full cursor-text"
        >
            <DrawingCanvas
                wordId={word.id}
                onNext={() => {
                    onComplete();
                    setUserInput("");
                }}
                penThickness={penThickness}
                penColor={penColor}
            />
            <input
                ref={inputRef}
                type="text"
                className="absolute opacity-0 pointer-events-none"
                value={userInput}
                onChange={handleInputChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus
            />

            <motion.div
                animate={isShaking ? { x: [-5, 5, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                className="relative text-7xl md:text-8xl lg:text-[9rem] font-medium tracking-tight select-none flex flex-wrap justify-center gap-[0.05em] mb-12 z-0"
                onClick={() => inputRef.current?.focus()}
            >
                {normalizedRomanized.split("").map((char, index) => {
                    let colorClass = "text-foreground opacity-20";
                    if (index < userInput.length) {
                        colorClass = userInput[index] === char.toLowerCase() ? "text-foreground opacity-100" : "text-red-500 opacity-100";
                    }

                    return (
                        <span key={index} className="relative">
                            {isFocused && index === userInput.length && (
                                <motion.div
                                    layoutId="caret"
                                    className="absolute -left-[0.05em] top-0 bottom-0 w-[4px] bg-foreground opacity-50 rounded-full animate-pulse"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                />
                            )}
                            <span className={cn("transition-all duration-150", colorClass)}>
                                {char}
                            </span>
                        </span>
                    );
                })}
                {isFocused && userInput.length === normalizedRomanized.length && (
                    <span className="relative">
                        <motion.div
                            layoutId="caret"
                            className="absolute -left-[0.05em] top-0 bottom-0 w-[4px] bg-foreground opacity-50 rounded-full animate-pulse"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        />
                    </span>
                )}
            </motion.div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={word.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col items-center gap-6 relative z-20 pointer-events-auto"
                >
                    <div className={cn(
                        "text-6xl text-muted/60 transition-colors",
                        word.language === 'ar' || word.language === 'ur' ? "font-arabic" : "font-sans"
                    )} dir={word.language === 'ar' || word.language === 'ur' ? "rtl" : "ltr"}>
                        {word.original}
                    </div>
                    <div className="text-[10px] font-mono text-muted/40 uppercase tracking-[0.5em] mt-2">
                        {word.definition}
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-3 text-[10px] font-mono tracking-[0.1em] text-muted z-10">
                        <button
                            onClick={(e) => { e.stopPropagation(); setAudioMode("en"); }}
                            className={`transition-colors px-2 py-1 rounded-md ${audioMode === "en" ? "bg-extra-muted text-foreground" : "hover:text-foreground"}`}
                        >
                            EN
                        </button>
                        <span className="opacity-20 text-extra-muted">|</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setAudioMode("original"); }}
                            className={`transition-colors px-2 py-1 rounded-md ${audioMode === "original" ? "bg-extra-muted text-foreground" : "hover:text-foreground"}`}
                        >
                            {(word.language || "EN").toUpperCase()}
                        </button>

                        <button
                            className={cn(
                                "ml-2 p-2 rounded-full transition-all flex justify-center items-center w-8 h-8",
                                isSpeaking ? "text-accent" : "hover:bg-extra-muted/50 hover:text-foreground"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                const text = audioMode === "en" ? word.definition : word.original;
                                const lang = audioMode === "en" ? "en-US" : (word.language ? TTS_LANG_MAP[word.language] : "en-US");
                                onSpeak(text, lang || "en-US");
                            }}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <Loader2 size={14} className="animate-spin text-muted" />
                            ) : isSpeaking ? (
                                <Volume1 size={14} className="animate-pulse" />
                            ) : (
                                <Volume2 size={14} />
                            )}
                        </button>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Hint for skip */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 3 }}
                className="absolute -bottom-12 text-[10px] text-muted font-mono opacity-40 select-none text-center"
            >
                {isIOS ? "Press TAB to skip • Double tap to skip or go next" : "Press TAB to skip"}
            </motion.div>
        </div>
    );
}
