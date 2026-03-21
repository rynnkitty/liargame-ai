import type { Metadata } from 'next';
import { Black_Han_Sans, Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

// 로고/타이틀용 디스플레이 폰트 (한국어 + 라틴 지원)
const blackHanSans = Black_Han_Sans({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

// 한국어 지원 본문 폰트
const notoSansKR = Noto_Sans_KR({
  weight: ['400', '500', '700', '900'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LiarGame AI',
  description: 'AI가 실제 플레이어로 참여하는 실시간 멀티플레이어 라이어게임',
  icons: {
    icon: '/kitty-logo.png',
    apple: '/kitty-logo.png',
  },
  openGraph: {
    title: 'LiarGame AI',
    description: 'AI가 함께하는 라이어게임 — 링크 하나로 시작',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${blackHanSans.variable} ${notoSansKR.variable}`}>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
