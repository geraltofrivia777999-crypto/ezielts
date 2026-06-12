import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ieltszen — Подготовка к IELTS онлайн",
  description:
    "Сдай IELTS с первого раза. Реальные тесты, AI-фидбек по writing и speaking, персональный план подготовки.",
  keywords: ["IELTS", "подготовка к IELTS", "IELTS онлайн", "IELTS тесты", "IELTS writing", "IELTS speaking"],
  openGraph: {
    title: "ieltszen — Подготовка к IELTS онлайн",
    description: "Сдай IELTS с первого раза. AI-фидбек, реальные тесты, персональный план.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
