import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitGuardian AI",
  description: "AI-powered GitHub repository monitoring and code review",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
