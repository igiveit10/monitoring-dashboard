import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "URL 모니터링 대시보드",
  description: "URL 모니터링 및 체크 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

