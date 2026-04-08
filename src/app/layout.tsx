import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'The Paani™',
  description: 'The Paani™ Serving Larkano with pure mineral water. Register, place orders & track your deliveries online.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Using Poppins and PT Sans as per PRD (if desired, currently Roboto is in tailwind.config) */}
        {/* <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" /> */}
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Noto+Serif+Sindhi:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground"> {/* Ensure body also gets theme bg/fg */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}

