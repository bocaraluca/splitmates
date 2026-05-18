"use client";

import { useInactivityLogout } from "@/lib/inactivity-logout";

export function InactivityMonitor() {
    useInactivityLogout();
    return null;
}