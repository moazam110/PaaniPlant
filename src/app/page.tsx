
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Persists in memory across back/forward navigation, resets on full page reload
let hasAutoRedirected = false;
import Footer from '@/components/shared/Footer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Menu, Phone, MapPin, MessageCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  // Auto-redirect only on fresh app launch, not when user navigates back
  useEffect(() => {
    if (hasAutoRedirected) return;

    try {
      const customerSession = localStorage.getItem('customer_session');
      if (customerSession) {
        const parsed = JSON.parse(customerSession);
        if (parsed.customerId && parsed.customer) {
          hasAutoRedirected = true;
          router.push('/customer/dashboard');
          return;
        }
      }
      const authSession = localStorage.getItem('paani_auth_session');
      if (authSession) {
        const parsed = JSON.parse(authSession);
        if (parsed.userType === 'admin' && parsed.email === 'admin@paani.com') {
          hasAutoRedirected = true;
          router.push('/admin');
          return;
        }
        if (parsed.userType === 'staff' && parsed.email === 'staff@paani.com') {
          hasAutoRedirected = true;
          router.push('/staff');
          return;
        }
      }
    } catch {
      // corrupted session — ignore and show root page
    }
  }, [router]);

  const handleCustomerClick = () => {
    try {
      const session = localStorage.getItem('customer_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.customerId && parsed.customer) {
          router.push('/customer/dashboard');
          return;
        }
      }
    } catch {
      localStorage.removeItem('customer_session');
    }
    router.push('/customer/login');
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated gradient background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/30 to-primary/50 animate-gradient"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(63,81,181,0.4),transparent_50%)] animate-pulse"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(48,63,159,0.4),transparent_50%)] animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(63,81,181,0.2),transparent_70%)]"></div>
      
      {/* Animated floating orbs */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-accent/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      
      {/* Main content */}
      <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8 relative z-10">
        {/* Welcome section with enhanced glassmorphism */}
        <div className="w-full max-w-4xl">
          <div className="relative bg-white dark:bg-[hsl(var(--card))] border-2 border-border rounded-3xl p-8 md:p-12 shadow-2xl overflow-hidden">
            {/* Hamburger Menu - inside card, top left */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen(true)}
              className="absolute top-3 left-3 h-10 w-10 z-20"
            >
              <Menu className="h-6 w-6" />
            </Button>

            <div className="mb-10 relative z-10 flex flex-col items-center justify-center w-full">
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal text-primary mb-4 text-center" style={{ fontFamily: 'Georgia, serif' }}>
                The Paani<sup className="text-base font-normal">™</sup>
              </h2>
              <p className="text-lg md:text-xl font-normal text-center tracking-wide" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'hsl(var(--primary) / 0.45)' }}>
                Simple Access to Your PAANI™ Orders
              </p>
            </div>

            {/* Portal buttons with enhanced vibrant design */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              <Link href="/admin" passHref className="group">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-accent p-6 hover:from-primary hover:via-primary hover:to-accent transition-all duration-500 transform hover:scale-105 hover:rotate-1 shadow-2xl hover:shadow-primary/50">
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <div className="relative z-10 text-center">
                    <h3 className="text-2xl font-bold text-white">ADMIN</h3>
                  </div>
                </div>
              </Link>

              <Link href="/staff" passHref className="group">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent via-accent/90 to-primary p-6 hover:from-accent hover:via-accent hover:to-primary transition-all duration-500 transform hover:scale-105 hover:-rotate-1 shadow-2xl hover:shadow-accent/50">
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <div className="relative z-10 text-center">
                    <h3 className="text-2xl font-bold text-white">STAFF</h3>
                  </div>
                </div>
              </Link>

              <div onClick={handleCustomerClick} className="group cursor-pointer">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-accent/90 to-primary p-6 hover:from-primary hover:via-accent hover:to-primary transition-all duration-500 transform hover:scale-105 hover:rotate-1 shadow-2xl hover:shadow-primary/50">
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <div className="relative z-10 text-center">
                    <h3 className="text-2xl font-bold text-white">CUSTOMER</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Company Info Menu Sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[85vw] sm:w-[400px] overflow-y-auto p-0">
          <SheetTitle className="sr-only">PAANI Company Information</SheetTitle>

          {/* Header with gradient */}
          <div className="bg-gradient-to-br from-primary via-primary/90 to-accent px-6 pt-10 pb-8">
            <h1 className="text-4xl font-normal text-white mb-1" style={{ fontFamily: 'Georgia, serif' }}>
              The Paani<sup className="text-sm font-normal">™</sup>
            </h1>
            <p className="text-sm text-white/80 mt-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              Simple Access to Your PAANI™ Orders
            </p>
          </div>

          <div className="px-5 py-6 space-y-4">
            {/* Description card */}
            <div className="rounded-2xl bg-muted/50 border border-border/60 p-4">
              <p className="text-sm leading-relaxed text-justify" style={{ fontFamily: 'Georgia, serif', color: 'hsl(var(--foreground))' }}>
                <span className="font-semibold italic text-primary">The PAANI™</span> is a trusted mineral water supply brand in{' '}
                <span className="font-semibold text-primary">Larkano</span>, serving homes, offices, and businesses for the past three years.{' '}
                <span className="italic font-medium text-foreground">We deliver clean, safe, and healthy RO-based mineral water, enhanced with <span className="font-semibold text-primary">UV purification</span> to ensure <span className="font-semibold text-primary">100% bacteria-free</span> drinking water,</span>{' '}
                through our <span className="font-bold text-primary">smart Delivery Management System</span> featuring{' '}
                <span className="italic font-medium text-primary">easy one-click ordering</span>,{' '}
                <span className="italic font-medium text-primary">live tracking</span>, and{' '}
                <span className="italic font-medium text-primary">full order history</span>.
              </p>
            </div>

            {/* Address card */}
            <div className="rounded-2xl bg-muted/50 border border-border/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Address</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed pl-9">
                Rahmatpur Latif Colony<br />Near Arfat Masjid, Larkano
              </p>
            </div>

            {/* Contact cards */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary pl-1">Contact Us</span>

              <a
                href="tel:03337860444"
                className="flex items-center gap-3 rounded-2xl bg-muted/50 border border-border/60 p-4 hover:bg-primary/5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Call us</p>
                  <p className="text-sm font-semibold text-foreground">0333 786 0 444</p>
                </div>
              </a>

              <a
                href="https://maps.app.goo.gl/Ss9yFHFw6Kg2fh289"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-muted/50 border border-border/60 p-4 hover:bg-primary/5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Find us</p>
                  <p className="text-sm font-semibold text-foreground">View on Google Maps</p>
                </div>
              </a>

              <a
                href="https://wa.me/c/923337860444"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border p-4 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#25D36615', borderColor: '#25D36640' }}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: '#25D36620' }}>
                  <MessageCircle className="h-4 w-4" style={{ color: '#25D366' }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Chat with us</p>
                  <p className="text-sm font-semibold text-foreground">WhatsApp</p>
                </div>
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}

