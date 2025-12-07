import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "OpenDataChat - AI-Powered Data Analysis in Your Browser",
  description: "Open source AI-powered data analysis tool. Chat with your data using natural language. Runs entirely in your browser with Python, NumPy, Pandas, and Matplotlib.",
  keywords: ["data analysis", "AI", "Python", "Pyodide", "browser", "open source", "pandas", "numpy", "matplotlib"],
  authors: [{ name: "OpenDataChat Contributors" }],
  openGraph: {
    title: "OpenDataChat - AI Data Analysis",
    description: "Open source AI-powered data analysis in your browser",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
