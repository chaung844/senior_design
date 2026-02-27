import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { QueryProvider } from "@/lib/query-client";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-sans",
});

export const metadata: Metadata = {
    title: "Matcha — Reconciliation System",
    description:
        "Bank reconciliation dashboard for managing account books, statements, and transaction matching.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={jetbrainsMono.variable}>
            <body className="antialiased">
                <QueryProvider>
                    <AuthProvider>{children}</AuthProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
