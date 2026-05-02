import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BackendSyncProvider } from "@/components/providers/backend-sync-provider";
import { MuiThemeProvider } from "@/components/providers/mui-theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SplitMates",
  description: "Frontend connected to the local backend API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <MuiThemeProvider>
          <BackendSyncProvider>{children}</BackendSyncProvider>
        </MuiThemeProvider>
      </body>
    </html>
  );
}
