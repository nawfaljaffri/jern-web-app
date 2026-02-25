"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Undo2, Redo2 } from "lucide-react";

interface DrawingCanvasProps {
    wordId: string;
    penThickness?: number;
    penColor?: string;
    isIOS?: boolean;
}

export default function DrawingCanvas({ wordId, penThickness, penColor, isIOS }: DrawingCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const [undoStack, setUndoStack] = useState<ImageData[]>([]);
    const [redoStack, setRedoStack] = useState<ImageData[]>([]);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Use the logical size since the context is scaled
        const logicalWidth = canvas.width / window.devicePixelRatio;
        const logicalHeight = canvas.height / window.devicePixelRatio;
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    }, []);

    // Clear canvas when the word changes
    useEffect(() => {
        setTimeout(() => {
            setUndoStack([]);
            setRedoStack([]);
        }, 0);
        clearCanvas();
    }, [wordId, clearCanvas]);

    useEffect(() => {
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            if (canvas && canvas.parentElement) {
                const rect = canvas.parentElement.getBoundingClientRect();

                // If it's the exact same size, just clear it and return
                if (canvas.width === rect.width * window.devicePixelRatio && canvas.height === rect.height * window.devicePixelRatio) {
                    clearCanvas();
                    return;
                }

                canvas.width = rect.width * window.devicePixelRatio;
                canvas.height = rect.height * window.devicePixelRatio;

                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;

                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
                    ctx.lineCap = "round";
                    ctx.lineJoin = "round";
                }
            }
        };

        // Delay initial resize slightly to ensure parent is fully rendered
        setTimeout(resizeCanvas, 0);
        window.addEventListener("resize", resizeCanvas);

        return () => {
            window.removeEventListener("resize", resizeCanvas);
        };
    }, [clearCanvas]);

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.pointerType !== "pen") {
            return;
        }

        e.preventDefault();

        // Blur any active input so the keyboard hides
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        if (canvasRef.current) {
            canvasRef.current.setPointerCapture(e.pointerId);

            // Save state for undo
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
                const currentData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
                setUndoStack(prev => [...prev, currentData]);
                setRedoStack([]);
            }
        }

        setIsDrawing(true);
        const pos = getPos(e);
        lastPosRef.current = pos;

        draw(pos, pos, e.pressure || 0.5);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing || e.pointerType !== "pen" || !lastPosRef.current) return;
        e.preventDefault();

        const currentPos = getPos(e);
        draw(lastPosRef.current, currentPos, e.pressure || 0.5);
        lastPosRef.current = currentPos;
    };

    const handlePointerUpOrOut = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        setIsDrawing(false);
        lastPosRef.current = null;
        if (canvasRef.current && canvasRef.current.hasPointerCapture(e.pointerId)) {
            canvasRef.current.releasePointerCapture(e.pointerId);
        }
    };

    const undo = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (undoStack.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
            const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setRedoStack(prev => [...prev, currentData]);
            const previousState = undoStack[undoStack.length - 1];
            ctx.putImageData(previousState, 0, 0);
            setUndoStack(prev => prev.slice(0, -1));
        }
    };

    const redo = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (redoStack.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
            const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setUndoStack(prev => [...prev, currentData]);
            const nextState = redoStack[redoStack.length - 1];
            ctx.putImageData(nextState, 0, 0);
            setRedoStack(prev => prev.slice(0, -1));
        }
    };

    const draw = (start: { x: number; y: number }, end: { x: number; y: number }, pressure: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Base color on dark mode preference or user setting
        if (penColor && penColor !== "default") {
            ctx.strokeStyle = penColor;
        } else {
            const isDark = document.documentElement.className.includes('dark') ||
                (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
            ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.9)";
        }

        const baseThickness = penThickness || 6;
        const minWidth = Math.max(1, baseThickness * 0.5);
        const maxWidth = baseThickness * 1.5;
        // Adjust width smoothly based on pressure
        const currentWidth = minWidth + (maxWidth - minWidth) * pressure;

        ctx.lineWidth = currentWidth;

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.closePath();
    };

    return (
        <>
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full z-10 touch-none pointer-events-auto rounded-xl"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUpOrOut}
                onPointerCancel={handlePointerUpOrOut}
                onPointerOut={handlePointerUpOrOut}
                onClick={(e) => {
                    if (isIOS) e.stopPropagation();
                }}
            />
            {isIOS && (
                <div className="absolute top-2 right-4 flex gap-3 z-30 pointer-events-none">
                    <button
                        onClick={undo}
                        disabled={undoStack.length === 0}
                        className="pointer-events-auto p-3 bg-background/80 backdrop-blur-md rounded-full border border-extra-muted text-muted hover:text-foreground disabled:opacity-30 transition-all shadow-sm"
                    >
                        <Undo2 size={24} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={redoStack.length === 0}
                        className="pointer-events-auto p-3 bg-background/80 backdrop-blur-md rounded-full border border-extra-muted text-muted hover:text-foreground disabled:opacity-30 transition-all shadow-sm"
                    >
                        <Redo2 size={24} />
                    </button>
                </div>
            )}
        </>
    );
}
