import I18nProvider from '@/i18n/I18nProvider';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PaperFlow - 学术论文智能流程图生成平台',
  description:
    'Transform natural language descriptions into publication-ready flowcharts for academic papers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
