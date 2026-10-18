import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YDevHub — Geliştirici Komuta Merkezi",
  description: "Projeler, Kanban görevleri, mimari notlar ve sunucu yapılandırmaları için yeni nesil takip platformu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
