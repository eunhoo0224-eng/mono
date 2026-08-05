import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '대화 연습',
  description: '혼자서 대화를 연습하는 웹앱 — 음성 대화 + 행동 지표',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
