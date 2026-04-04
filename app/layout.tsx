import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Knowledge Base",
  description: "Local LLM-powered knowledge base for Obsidian vaults",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
