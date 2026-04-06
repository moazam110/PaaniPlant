
"use client";

import React, { useState } from 'react';
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
              <p className="text-lg md:text-xl text-primary font-semibold text-center tracking-wide" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
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

              <Link href="/customer/login" passHref className="group">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-accent/90 to-primary p-6 hover:from-primary hover:via-accent hover:to-primary transition-all duration-500 transform hover:scale-105 hover:rotate-1 shadow-2xl hover:shadow-primary/50">
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <div className="relative z-10 text-center">
                    <h3 className="text-2xl font-bold text-white">CUSTOMER</h3>
                  </div>
                </div>
              </Link>
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

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/923337860444"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-2 right-2 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200"
        style={{ backgroundColor: '#25D366' }}
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </div>
  );
}

