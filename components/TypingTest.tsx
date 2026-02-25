"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Word } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Volume2, Loader2, Volume1, ChevronLeft, ChevronRight, Repeat, Eraser } from "lucide-react";
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
    onBack?: () => void;
    onMismatch?: () => void;
    onSpeak: (text: string, lang: string, repeat?: boolean) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    isPending?: boolean;
    isIOS?: boolean;
    isPhone?: boolean;
    isAudioRepeat?: boolean;
    penThickness?: number;
    penColor?: string;
    isLooping?: boolean;
    onToggleLoop?: () => void;
}

export default function TypingTest({ word, onComplete, onBack, onMismatch, onSpeak, onStop, isSpeaking, isPending, isIOS, isPhone, isAudioRepeat, penThickness, penColor, isLooping, onToggleLoop }: TypingTestProps) {
    const [userInput, setUserInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(true);
    const [isShaking, setIsShaking] = useState(false);
    const [audioMode, setAudioMode] = useState<"en" | "original">("en");
    const [loopCounter, setLoopCounter] = useState(0);
    const [clearTrigger, setClearTrigger] = useState(0);
    const initialMount = useRef(true);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        const text = audioMode === "en" ? word.definition : word.original;
        const lang = audioMode === "en" ? "en-US" : (word.language ? TTS_LANG_MAP[word.language] : "en-US");

        if (initialMount.current) {
            timeout = setTimeout(() => {
                onSpeak(text, lang || "en-US", !!isAudioRepeat);
                initialMount.current = false;
            }, 400);
        } else {
            onSpeak(text, lang || "en-US", !!isAudioRepeat);
        }

        return () => {
            clearTimeout(timeout);
            onStop?.();
        };
    }, [word, audioMode, isAudioRepeat, onSpeak, onStop]);

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
                if (isLooping) {
                    setUserInput("");
                    setLoopCounter(prev => prev + 1);
                    const text = audioMode === "en" ? word.definition : word.original;
                    const lang = audioMode === "en" ? "en-US" : (word.language ? TTS_LANG_MAP[word.language] : "en-US");
                    onSpeak(text, lang || "en-US", !!isAudioRepeat);
                } else {
                    onComplete();
                    setUserInput("");
                }
            }, 150);
        }
    };

    return (
        <div
            className="relative flex flex-col items-center justify-center min-h-[400px] md:min-h-[500px] w-full cursor-text"
            onClick={() => {
                if (!isIOS) inputRef.current?.focus();
            }}
        >
            <DrawingCanvas
                key={`${word.id}-${loopCounter}`}
                wordId={word.id}
                penThickness={penThickness}
                penColor={penColor}
                isIOS={isIOS}
                clearTrigger={clearTrigger}
            />
            {(isIOS || isPhone) && (
                <>
                    <button
                        onClick={() => { onBack?.(); setUserInput(""); }}
                        className="absolute left-0 lg:-left-12 top-1/2 -translate-y-1/2 p-4 text-muted hover:text-foreground z-30 transition-colors bg-background/50 backdrop-blur-sm rounded-full shadow-sm sm:left-4"
                    >
                        <ChevronLeft size={36} />
                    </button>
                    <button
                        onClick={() => { onComplete(); setUserInput(""); }}
                        className="absolute right-0 lg:-right-12 top-1/2 -translate-y-1/2 p-4 text-muted hover:text-foreground z-30 transition-colors bg-background/50 backdrop-blur-sm rounded-full shadow-sm sm:right-4"
                    >
                        <ChevronRight size={36} />
                    </button>
                </>
            )}
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
                className="relative text-7xl md:text-8xl lg:text-[9rem] font-medium tracking-tight select-none flex flex-wrap justify-center gap-[0.05em] mb-12 md:mt-4 lg:mt-6 z-0"
                onClick={(e) => {
                    if (isIOS) {
                        e.stopPropagation();
                        inputRef.current?.focus();
                    }
                }}
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
                        "transition-colors",
                        isIOS ? "text-6xl md:text-7xl lg:text-[7rem] text-muted/70" : "text-6xl text-muted/60",
                        word.language === 'ar' || word.language === 'ur' ? "font-arabic" : "font-sans"
                    )} dir={word.language === 'ar' || word.language === 'ur' ? "rtl" : "ltr"}>
                        {word.original}
                    </div>
                    <div className={cn(
                        "font-medium uppercase tracking-[0.3em] mt-3",
                        isIOS ? "text-[12px] md:text-sm text-muted/60" : "text-sm text-muted/40"
                    )}>
                        {word.definition}
                    </div>

                    <div className={cn(
                        "flex items-center justify-center font-medium text-muted z-10",
                        isIOS ? "mt-8 gap-4 text-xs md:text-sm tracking-[0.15em]" : "mt-6 gap-3 text-sm tracking-widest"
                    )}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setAudioMode("en"); }}
                            className={cn(
                                "transition-colors",
                                isIOS ? "px-3 py-2 rounded-lg" : "px-2 py-1 rounded-md",
                                audioMode === "en" ? "bg-extra-muted text-foreground" : "hover:text-foreground"
                            )}
                        >
                            EN
                        </button>
                        <span className={cn(
                            isIOS ? "opacity-30 text-extra-muted mx-1" : "opacity-20 text-extra-muted"
                        )}>|</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setAudioMode("original"); }}
                            className={cn(
                                "transition-colors",
                                isIOS ? "px-3 py-2 rounded-lg" : "px-2 py-1 rounded-md",
                                audioMode === "original" ? "bg-extra-muted text-foreground" : "hover:text-foreground"
                            )}
                        >
                            {(word.language || "EN").toUpperCase()}
                        </button>

                        <button
                            className={cn(
                                "transition-all flex justify-center items-center",
                                isIOS ? "ml-3 p-3 rounded-full w-12 h-12" : "ml-2 p-2 rounded-full w-8 h-8",
                                isSpeaking ? (isIOS ? "text-accent bg-accent/5" : "text-accent") : (isIOS ? "hover:bg-extra-muted/50 border border-transparent hover:border-extra-muted hover:text-foreground" : "hover:bg-extra-muted/50 hover:text-foreground")
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                const text = audioMode === "en" ? word.definition : word.original;
                                const lang = audioMode === "en" ? "en-US" : (word.language ? TTS_LANG_MAP[word.language] : "en-US");
                                onSpeak(text, lang || "en-US", !!isAudioRepeat);
                            }}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <Loader2 size={isIOS ? 20 : 14} className="animate-spin text-muted" />
                            ) : isSpeaking ? (
                                <Volume1 size={isIOS ? 20 : 14} className="animate-pulse" />
                            ) : (
                                <Volume2 size={isIOS ? 20 : 14} />
                            )}
                        </button>
                        <button
                            className={cn(
                                "transition-all flex justify-center items-center relative",
                                isIOS ? "ml-3 p-3 rounded-full w-12 h-12" : "ml-2 p-2 rounded-full w-8 h-8",
                                isIOS
                                    ? "hover:bg-extra-muted/50 border border-transparent hover:border-extra-muted hover:text-foreground"
                                    : isLooping
                                        ? "text-accent border border-accent/20"
                                        : "hover:bg-extra-muted/50 hover:text-foreground"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isIOS) {
                                    setClearTrigger(prev => prev + 1);
                                } else {
                                    onToggleLoop?.();
                                }
                            }}
                            title={isIOS ? "Erase Canvas" : "Loop Word"}
                        >
                            {isIOS ? (
                                <Eraser size={20} />
                            ) : (
                                <>
                                    <Repeat size={14} />
                                    {isLooping && <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />}
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Hint for skip */}
            {!isPhone && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 3 }}
                    className={cn(
                        "absolute opacity-40 select-none text-center font-medium tracking-widest text-muted",
                        isIOS ? "-bottom-16 text-[10px] md:text-xs" : "-bottom-12 text-xs"
                    )}
                >
                    {isIOS ? "Use side arrows to navigate" : "Press TAB to skip"}
                </motion.div>
            )}
        </div>
    );
}
