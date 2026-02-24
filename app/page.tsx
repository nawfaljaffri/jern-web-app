"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import TypingTest from "@/components/TypingTest";
import { LANGUAGES, FREQUENCY_TIERS } from "@/lib/constants";
import { Word, Language, Difficulty, SessionSettings } from "@/lib/types";
import { transliterate } from "@/lib/transliterate";
import { useTTS } from "@/hooks/useTTS";
import { Upload, FileText, Settings, History, Volume2, Globe, ChevronRight, ChevronDown, CheckCircle2, RotateCcw, Search, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useVirtualizer } from "@tanstack/react-virtual";
import Flag from "react-world-flags";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Home() {

  const [settings, setSettings] = useState<SessionSettings>({
    language: 'ar',
    difficulty: 'beginner',
    audioRepeat: false,
    activeRecall: true
  });

  const [dataPack, setDataPack] = useState<Word[]>([]);
  const [upcomingWords, setUpcomingWords] = useState<Word[]>([]);
  const [history, setHistory] = useState<Word[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [expandedLangInHistory, setExpandedLangInHistory] = useState<Language | null>('ar');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const { speak, stop, voices, isSpeaking, isPending } = useTTS();
  const historyRef = useRef<Word[]>([]);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    }
  }, []);
  const wordsSinceRecallRef = useRef(0);

  const isVoiceMissing = React.useMemo(() => {
    // Only show warning on iOS, as Android Chrome dynamically fetches TTS
    // without returning it in `getVoices()`
    if (!isIOS) return false;

    if (voices.length === 0) return false; // Still loading or not supported
    const langCode = LANGUAGES.find(l => l.value === settings.language)?.ttsLocale || "en-US";
    let matchedVoice = voices.find(v => v.lang.toLowerCase() === langCode.toLowerCase());
    if (!matchedVoice) {
      const baseLang = langCode.split('-')[0].toLowerCase();
      matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(baseLang));
    }
    return !matchedVoice;
  }, [voices, settings.language, isIOS]);

  // 1. Data Loader - Fetch JSON asynchronously
  const loadDataPack = useCallback(async (lang: Language) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/data/${lang}.json`);
      const data = await response.json();
      setDataPack(data);
      // Immediately try to fill the queue with the new data
      setUpcomingWords([]);
    } catch (error) {
      console.error("Failed to load data pack:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDataPack(settings.language);
  }, [settings.language, loadDataPack]);


  // 3. Pre-fetching Logic
  const refillUpcoming = useCallback((currentHistory: Word[]) => {
    if (dataPack.length === 0) return;

    setUpcomingWords(prev => {
      const needed = 6 - prev.length;
      if (needed <= 0) return prev;

      const newWords: Word[] = [];
      const excludeIds = [...prev.map(w => w.id)];

      // Filter history for current language only to avoid cross-contamination
      const langHistory = currentHistory.filter(w => w.language === settings.language);

      // If data pack is extremely small, don't over-exclude history
      const historyExclusionLimit = dataPack.length < 50 ? 5 : langHistory.length;
      const historyToExclude = langHistory.slice(0, historyExclusionLimit).map(w => w.id);
      const fullExclude = [...excludeIds, ...historyToExclude];

      for (let i = 0; i < needed; i++) {
        // Active Recall Injection: exactly every 5 new words
        if (settings.activeRecall && langHistory.length > 0 && wordsSinceRecallRef.current >= 5) {
          const recallWord = langHistory[Math.floor(Math.random() * langHistory.length)];
          newWords.push(recallWord);
          fullExclude.push(recallWord.id);
          excludeIds.push(recallWord.id);
          wordsSinceRecallRef.current = 0; // Reset
        } else {
          const tier = FREQUENCY_TIERS[settings.difficulty];
          const filtered = dataPack.filter(w =>
            (w.frequency || 0) >= tier.min &&
            (w.frequency || 0) <= tier.max &&
            !fullExclude.includes(w.id)
          );

          let pool = filtered;
          if (pool.length === 0) {
            // Fallback 1: Ignore history, just avoid queue duplicates
            pool = dataPack.filter(w =>
              (w.frequency || 0) >= tier.min &&
              (w.frequency || 0) <= tier.max &&
              !excludeIds.includes(w.id)
            );
            // Fallback 2: Completely desperate, just avoid queue duplicates regardless of tier
            if (pool.length === 0) {
              pool = dataPack.filter(w => !excludeIds.includes(w.id));
            }
            // Fallback 3: Nuclear, just allow duplicates if the pack is smaller than queue
            if (pool.length === 0) {
              pool = dataPack;
            }
          }

          if (pool.length > 0) {
            const nextWord = pool[Math.floor(Math.random() * pool.length)];
            newWords.push({
              ...nextWord,
              romanized: nextWord.romanized || transliterate(nextWord.original, settings.language)
            });
            fullExclude.push(nextWord.id);
            excludeIds.push(nextWord.id);
            wordsSinceRecallRef.current += 1;
          }
        }
      }
      return [...prev, ...newWords];
    });
  }, [dataPack, settings.difficulty, settings.activeRecall, settings.language]);

  // Initialize and Refill
  useEffect(() => {
    if (dataPack.length > 0 && upcomingWords.length < 3) {
      refillUpcoming(history);
    }
  }, [dataPack, refillUpcoming, history.length, upcomingWords.length]);

  const currentWord = upcomingWords[0];

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (currentWord) {
      // Delay speech slightly to allow Framer Motion entrance animation to finish naturally
      timeout = setTimeout(() => {
        speak(currentWord.definition, "en-US", settings.audioRepeat);
      }, 400);
    }
    return () => {
      clearTimeout(timeout);
      stop();
    };
  }, [currentWord, settings.audioRepeat, speak, stop]);

  const handleComplete = useCallback(() => {
    if (!currentWord) return;

    // Add to History (No duplicates)
    setHistory(prev => {
      if (prev.find(w => w.id === currentWord.id)) return prev;
      const updated = [currentWord, ...prev].slice(0, 500);
      localStorage.setItem('jern-history', JSON.stringify(updated));
      return updated;
    });

    // Move upcoming queue
    setUpcomingWords(prev => prev.slice(1));
  }, [currentWord]);

  const updateSettings = (updates: Partial<SessionSettings>) => {
    setSettings(prev => {
      const isQueueReset = (updates.language && updates.language !== prev.language) ||
        (updates.difficulty && updates.difficulty !== prev.difficulty);
      if (isQueueReset) {
        setUpcomingWords([]);
      }
      return { ...prev, ...updates };
    });
    stop();
  };

  const groupedHistory = LANGUAGES.map(lang => ({
    ...lang,
    words: history.filter(w => w.language === lang.value || (w.id.startsWith(lang.value)))
  })).filter(group => group.words.length > 0);

  if (isLoading && upcomingWords.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-muted animate-pulse font-mono uppercase tracking-[0.3em] text-[10px]">
        Loading Data Pack...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 flex justify-between items-center bg-background/50 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-background font-bold transition-transform group-hover:scale-110">J</div>
          <h1 className="text-xl font-medium tracking-tight">JERN</h1>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={() => setIsInfoOpen(true)} className="text-muted hover:text-foreground transition-all">
            <Info size={18} />
          </button>
          <button onClick={() => setIsHistoryOpen(true)} className="text-muted hover:text-foreground transition-all relative">
            <History size={18} />
            {history.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" />}
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="text-muted hover:text-foreground transition-all">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-6 relative">
        <div className="absolute top-0 sm:top-8 w-full flex-col flex items-center pointer-events-none z-10">
          <div className="w-full flex justify-between items-center opacity-20 pointer-events-auto">
            <div className="text-[10px] font-mono uppercase tracking-[0.4em] flex items-center gap-4">
              <Globe size={12} />
              <span>{LANGUAGES.find(l => l.value === settings.language)?.label} / {settings.difficulty}</span>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] flex items-center gap-2">
              <CheckCircle2 size={12} />
              <span>Mastered: {history.length}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-2 w-full text-center pointer-events-auto">
            <AnimatePresence>
              {['ja', 'ko'].includes(settings.language) && (
                <motion.div
                  key="unstable-warning"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-[9px] font-mono uppercase tracking-widest text-orange-500/80 bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full text-center"
                >
                  ⚠️ This language is currently under development and may be unstable or inaccurate at times.
                </motion.div>
              )}
              {settings.language === 'ur' && isIOS && (
                <motion.div
                  key="urdu-ios-warning"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-[9px] font-mono uppercase tracking-widest text-red-500/80 bg-red-500/10 border border-red-500/20 px-6 py-2.5 rounded-xl text-center max-w-lg leading-loose"
                >
                  🔇 Apple iOS currently does not support Urdu Text-To-Speech natively. Audio may only work on Android or Desktop browsers.
                </motion.div>
              )}
              {isVoiceMissing && settings.language !== 'ur' && (
                <motion.div
                  key="missing-voice-warning"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-[9px] font-mono uppercase tracking-widest text-red-500/80 bg-red-500/10 border border-red-500/20 px-6 py-2.5 rounded-xl text-center max-w-lg leading-loose"
                >
                  🔇 Missing Voice Data: You may need to download the {LANGUAGES.find(l => l.value === settings.language)?.label} voice in your device settings (e.g. Settings &gt; Accessibility &gt; Spoken Content &gt; Voices on iOS).
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {currentWord ? (
            <TypingTest
              key={currentWord.id + settings.language}
              word={currentWord}
              onComplete={handleComplete}
              onSpeak={(text, lang) => speak(text, lang, false)}
              isSpeaking={isSpeaking}
              isPending={isPending}
              isIOS={isIOS}
            />
          ) : (
            <div className="text-muted font-mono animate-pulse">Replenishing pool...</div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer (Minimal) */}
      <footer className="px-8 py-12 flex justify-center opacity-5">
        <p className="text-[8px] font-light tracking-[0.6em] uppercase">
          Engine Active . Local Intelligence
        </p>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/60 backdrop-blur-sm"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background border border-extra-muted p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Languages</h2>
                <div className="grid grid-cols-3 gap-4">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => updateSettings({ language: lang.value })}
                      className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${settings.language === lang.value ? "border-accent bg-accent text-background" : "border-extra-muted hover:border-muted"
                        }`}
                    >
                      <Flag code={lang.countryCode} className="h-6 object-cover rounded-sm shadow-sm" />
                      <span className="text-[9px] font-bold uppercase tracking-tighter">{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Difficulty</h2>
                <div className="flex gap-2 p-1 bg-extra-muted/20 rounded-2xl">
                  {(['beginner', 'intermediate', 'hard'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => updateSettings({ difficulty: d })}
                      className={`flex-1 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${settings.difficulty === d ? "bg-foreground text-background shadow-lg" : "hover:bg-extra-muted/40 text-muted"
                        }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Feedback</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => updateSettings({ audioRepeat: !settings.audioRepeat })}
                    className={`w-full p-5 rounded-3xl border flex items-center justify-between transition-all ${settings.audioRepeat ? "bg-accent/5 border-accent" : "border-extra-muted"
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${settings.audioRepeat ? "bg-accent text-background" : "bg-extra-muted text-muted"}`}>
                        <Volume2 size={18} />
                      </div>
                      <span className="text-xs font-semibold">Continuous Pronunciation</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.audioRepeat ? "bg-accent" : "bg-extra-muted"}`}>
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.audioRepeat ? "right-1" : "left-1"}`} />
                    </div>
                  </button>

                  <button
                    onClick={() => updateSettings({ activeRecall: !settings.activeRecall })}
                    className={`w-full p-5 rounded-3xl border flex items-center justify-between transition-all ${settings.activeRecall ? "bg-accent/5 border-accent" : "border-extra-muted"
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${settings.activeRecall ? "bg-accent text-background" : "bg-extra-muted text-muted"}`}>
                        <RotateCcw size={18} />
                      </div>
                      <span className="text-xs font-semibold">Spaced Repetition</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.activeRecall ? "bg-accent" : "bg-extra-muted"}`}>
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.activeRecall ? "right-1" : "left-1"}`} />
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Modal */}
      <AnimatePresence>
        {isInfoOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/60 backdrop-blur-sm"
            onClick={() => setIsInfoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background border border-extra-muted p-12 rounded-[3rem] shadow-2xl max-w-lg w-full space-y-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight mb-2">About JERN</h2>
                <p className="text-muted text-sm leading-relaxed">
                  JERN is a focused environment designed for deep linguistic association, built on the scientific principles of Dual Coding and Multisensory Integration. We believe that true learning happens when your motor skills (typing), your ears (listening), and your eyes (reading) are all focused on a single point of data at the same time, creating a multisensory loop that accelerates memory encoding; allowing you to type to remember and listen to understand.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="p-2 bg-accent/10 text-accent rounded-xl mt-1"><Globe size={16} /></div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Total Privacy. 100% Local.</h3>
                    <p className="text-xs text-muted leading-relaxed">
                      JERN runs entirely in your browser. No data is saved to any external servers, and once the website has loaded, it can even work completely offline.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="p-2 bg-accent/10 text-accent rounded-xl mt-1"><RotateCcw size={16} /></div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Spaced Repetition</h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Our engine utilizes active recall, tracking your mastered words and seamlessly injecting tricky vocabulary back into your queue without breaking your typing flow.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="p-2 bg-accent/10 text-accent rounded-xl mt-1"><Volume2 size={16} /></div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Dual-Language Audio</h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Toggle the pronunciation engine between English and the target language instantly, or enable continuous pronunciation in the settings to enforce auditory pairing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-extra-muted/10 p-4 rounded-2xl flex items-center gap-4">
                <div className="text-[10px] font-mono border border-muted/30 px-2 py-1 rounded bg-background text-foreground uppercase shrink-0">
                  {isIOS ? "PEN" : "TAB"}
                </div>
                <div className="text-xs text-muted font-medium">
                  {isIOS
                    ? "Double tap the screen with Apple Pencil to skip to the next word. You can also press TAB."
                    : "Press TAB at any time to skip a difficult word."}
                </div>
              </div>

              <div className="pt-4 border-t border-extra-muted text-center">
                <p className="text-[10px] text-muted uppercase tracking-widest">
                  Developed by <a href="https://www.linkedin.com/in/nawfaljafri/" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-accent transition-colors font-semibold">Nawfal Jaffri</a>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dictionary Sidebar */}
      <AnimatePresence>
        {isHistoryOpen && (
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-background border-l border-extra-muted shadow-2xl p-10 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-semibold tracking-tight">Core Lexicon</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="text-muted hover:text-foreground">
                <ChevronRight size={28} />
              </button>
            </div>

            <div className="relative mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                placeholder="Search mastered words..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-extra-muted/10 border border-extra-muted rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-muted transition-colors"
              />
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 pb-10">
              {groupedHistory.length === 0 && <p className="text-muted text-sm italic py-10 opacity-40">Your brain is a tabula rasa. Move your fingers.</p>}
              {groupedHistory.map((group) => (
                <div key={group.value} className="border border-extra-muted rounded-[2rem] overflow-hidden">
                  <button
                    onClick={() => setExpandedLangInHistory(expandedLangInHistory === group.value ? null : group.value)}
                    className="w-full flex items-center justify-between p-5 bg-extra-muted/10 hover:bg-extra-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Flag code={group.countryCode} className="h-4 object-cover rounded-sm shadow-sm" />
                      <span className="font-semibold text-sm">{group.label}</span>
                      <span className="text-[10px] text-muted font-mono bg-extra-muted px-2 py-0.5 rounded-full">{group.words.length}</span>
                    </div>
                    {expandedLangInHistory === group.value ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>

                  <AnimatePresence>
                    {expandedLangInHistory === group.value && (
                      <VirtualList words={group.words.filter(w =>
                        w.original.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        w.romanized.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        w.definition.toLowerCase().includes(searchQuery.toLowerCase())
                      )} />
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function VirtualList({ words }: { words: Word[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: words.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 70,
    overscan: 5,
  });

  return (
    <motion.div
      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
      className="bg-background"
    >
      <div
        ref={parentRef}
        className="max-h-[50vh] overflow-y-auto p-4 custom-scrollbar"
      >
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const word = words[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="py-1"
              >
                <div className="flex items-center justify-between p-4 rounded-2xl bg-extra-muted/5 group hover:bg-extra-muted/20 transition-all h-full">
                  <div>
                    <div className={cn(
                      "text-lg",
                      word.language === 'ar' || word.language === 'ur' ? "font-arabic" : "font-sans"
                    )} dir={word.language === 'ar' || word.language === 'ur' ? "rtl" : "ltr"}>
                      {word.original}
                    </div>
                    <div className="text-[10px] text-muted font-mono opacity-50 group-hover:opacity-100 transition-opacity">{word.romanized}</div>
                  </div>
                  <div className="text-[10px] font-bold uppercase text-muted tracking-tight max-w-[100px] text-right truncate">
                    {word.definition}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
