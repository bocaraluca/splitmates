import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, logout } from "./auth-storage";
import { fetchFromBackend } from "./backend-api";

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; 

export function useInactivityLogout() {
    const router = useRouter();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        function resetTimer() {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            timerRef.current = setTimeout(async () => {
                const token = getToken();
                if (!token) {
                    return;
                }

                try {
                    await fetchFromBackend("/auth/logout", {method: "POST", token});
                } 
                finally {
                    logout();
                    router.push("/login");
                }
            }, INACTIVITY_TIMEOUT_MS);
        }

        const events = ["mousemove", "mousedown", "keypress", "touchstart", "scroll"];
        for (const event of events) {
            window.addEventListener(event, resetTimer);
        }
        resetTimer();

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            for (const event of events) {
                window.removeEventListener(event, resetTimer);
            }
        };
    }, [router]);
}