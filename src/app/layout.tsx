
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Paani Delivery System', 
  description: 'Manage customer profiles and water delivery requests for Paani Delivery System.', 
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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

