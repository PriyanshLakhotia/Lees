import type { Metadata } from 'next';
import { Geist, Lora } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-ui',
  subsets: ['latin'],
});

const lora = Lora({
  variable: '--font-reading',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Lees — Dutch reading',
  description: 'Generate Dutch reading practice at your level.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${lora.variable}`}>{children}</body>
    </html>
  );
}
