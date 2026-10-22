import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ボンバーディフューザー3Dオンライン",
  description: "橋本駅前の2サイト・3ルートで友達と遊ぶタクティカルFPS。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
