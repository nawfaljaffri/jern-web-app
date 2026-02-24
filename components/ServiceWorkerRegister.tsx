"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
    useEffect(() => {
        if ("serviceWorker" in navigator && typeof window !== "undefined") {
            window.navigator.serviceWorker
                .register("/sw.js")
                .then(() => console.log("Service Worker registered successfully."))
                .catch((err) => console.error("Service Worker registration failed:", err));
        }
    }, []);

    return null;
}
