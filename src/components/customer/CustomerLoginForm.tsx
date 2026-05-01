"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Minus, Plus, Menu, Phone, MapPin, MessageCircle } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import Footer from '@/components/shared/Footer';

const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  mobile: z.string().min(10, { message: "Enter a valid WhatsApp/mobile number." }),
  address: z.string().min(5, { message: "Address must be at least 5 characters." }),
  cans: z.string().optional(),
  notes: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const loginSchema = z.object({
  username: z.string().min(1, { message: "Username is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function CustomerLoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState<'YES' | 'NO' | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Auto-redirect if session already exists
  useEffect(() => {
    const session = localStorage.getItem('customer_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.customerId && parsed.customer) {
          router.replace('/customer/dashboard');
        }
      } catch {
        localStorage.removeItem('customer_session');
      }
    }
  }, [router]);

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', mobile: '', address: '', cans: '1', notes: '' },
  });

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    if (!isNewCustomer) {
      toast({ variant: 'destructive', title: 'Required', description: 'Please select YES or NO for new customer.' });
      return;
    }
    setIsSubmittingRegister(true);
    try {
      const response = await fetch(buildApiUrl('api/register-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, isNewCustomer }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to send request.');
      }
      setShowRegister(false);
      registerForm.reset();
      setIsNewCustomer(null);
      setShowSuccessPopup(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Send",
        description: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmittingRegister(false);
    }
  };
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      // Phase 4: Proper authentication with backend
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CUSTOMER_LOGIN), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid username or password');
      }

      const result = await response.json();
      
      if (result.success && result.credential && result.customer) {
        // Store customer session
        const customerId = typeof result.customer._id === 'object'
          ? result.customer._id._id || result.customer._id
          : result.customer._id || result.customer.id;
        
        localStorage.setItem('customer_session', JSON.stringify({
          customerId: String(customerId),
          username: result.credential.username,
          customer: result.customer,
          loginTime: new Date().toISOString(),
          sessionId: `customer_${Date.now()}`,
        }));
        
        router.push(`/customer/dashboard`);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid username or password. Please try again.",
      });
    }
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

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
      {/* Main login card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="relative overflow-hidden rounded-3xl bg-white backdrop-blur-2xl border border-white/30 shadow-2xl">
          {/* Animated border glow */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 opacity-50 animate-gradient blur-xl"></div>
          <div className="absolute inset-[1px] rounded-3xl bg-white"></div>

          <div className="relative p-8 md:p-10">
            {/* Menu button - inside card, top left */}
            <button
              onClick={() => setMenuOpen(true)}
              className="absolute top-2 left-2 p-1.5 rounded-lg text-primary/60 hover:text-primary hover:bg-primary/10 transition-all"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Title section with vibrant styling */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-normal text-primary mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                The Paani<sup className="text-xs font-normal">™</sup>
              </h2>
              <div className="inline-block mb-4">
                <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent animate-gradient" style={{ backgroundSize: '200% auto' }}>
                  CUSTOMER
                </h1>
              </div>
              <div className="h-1 w-24 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent rounded-full"></div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">Username</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input 
                            type="text" 
                            placeholder="Enter your username" 
                            {...field} 
                            className="bg-white border-2 border-primary/30 focus:border-primary focus:ring-0 focus:outline-none transition-all duration-300 h-12 text-base pr-4 pl-4 text-gray-900"
                          />
                          <div className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">Password</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Enter your password" 
                            {...field} 
                            className="bg-white border-2 border-primary/30 focus:border-primary focus:ring-0 focus:outline-none transition-all duration-300 h-12 text-base pr-12 pl-4 text-gray-900"
                          />
                          <div className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/70 hover:text-primary transition-colors duration-200"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <div className="pt-4 space-y-3">
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary via-accent to-primary hover:from-primary hover:via-accent hover:to-primary transition-all duration-300 shadow-lg hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                    disabled={form.formState.isSubmitting}
                    style={{ backgroundSize: '200% auto' }}
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      {form.formState.isSubmitting ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Logging in...
                        </>
                      ) : (
                        'Login'
                      )}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  </Button>

                  <div className="relative flex items-center gap-3">
                    <div className="flex-1 h-px bg-primary/20"></div>
                    <span className="text-xs text-gray-400 font-medium">New here?</span>
                    <div className="flex-1 h-px bg-primary/20"></div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 text-base font-bold border-2 border-primary/40 text-primary hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setShowRegister(true)}
                  >
                    Register Request
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>

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

      {/* Registration Dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-[360px] w-full" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Customer Registration Request</DialogTitle>
          <div className="relative overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 opacity-40 blur-xl"></div>
            <div className="absolute inset-[1px] rounded-3xl bg-white"></div>
            <div className="relative px-5 pt-4 pb-3">

              {/* Title */}
              <div className="text-center mb-3">
                <h2 className="text-2xl font-black bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent" style={{ backgroundSize: '200% auto' }}>
                  REGISTRATION
                </h2>
                <div className="h-0.5 w-14 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent rounded-full mt-1"></div>
              </div>

              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-2">

                  {/* Full Name */}
                  <FormField control={registerForm.control} name="name" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-gray-700 font-semibold text-xs">Full Name <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Your Name/Sirname" {...field}
                          className="bg-white border-2 border-primary/30 focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 h-9 text-gray-900" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />

                  {/* Mobile */}
                  <FormField control={registerForm.control} name="mobile" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-gray-700 font-semibold text-xs">WhatsApp / Mobile <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 03001234567" {...field}
                          className="bg-white border-2 border-primary/30 focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 h-9 text-gray-900" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />

                  {/* Address */}
                  <FormField control={registerForm.control} name="address" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-gray-700 font-semibold text-xs">Address <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Your Home Address Colony/Street" {...field}
                          className="bg-white border-2 border-primary/30 focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 h-9 text-gray-900" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />

                  {/* Cans stepper */}
                  <FormField control={registerForm.control} name="cans" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-gray-700 font-semibold text-xs">Cans Required <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <button type="button"
                            onClick={() => { const c = parseInt(field.value || '1'); if (c > 1) field.onChange(String(c - 1)); }}
                            disabled={parseInt(field.value || '1') <= 1}
                            className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg border-2 border-primary/30 text-primary hover:bg-primary hover:text-white hover:border-primary transition-all disabled:opacity-40">
                            <Minus className="h-4 w-4" />
                          </button>
                          <div className="flex-1 h-9 flex items-center justify-center border-2 border-primary/30 rounded-lg bg-white text-gray-900 font-bold">
                            {field.value || '1'}
                          </div>
                          <button type="button"
                            onClick={() => { const c = parseInt(field.value || '1'); field.onChange(String(c + 1)); }}
                            className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg border-2 border-primary/30 text-primary hover:bg-primary hover:text-white hover:border-primary transition-all">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />

                  {/* Any Note */}
                  <FormField control={registerForm.control} name="notes" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-gray-700 font-semibold text-xs">Any Note <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Any Special Instructions..." {...field}
                          className="bg-white border-2 border-primary/30 focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 h-9 text-gray-900" />
                      </FormControl>
                    </FormItem>
                  )} />

                  {/* New customer YES/NO */}
                  <div className="space-y-1">
                    <p className="text-gray-700 font-semibold text-xs">Are You A New Customer? <span className="text-red-500">*</span></p>
                    <div className="flex gap-4">
                      {(['YES', 'NO'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isNewCustomer === opt}
                            onChange={() => setIsNewCustomer(prev => prev === opt ? null : opt)}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm font-bold text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-1 space-y-1.5">
                    <Button type="submit" disabled={isSubmittingRegister}
                      className="w-full h-10 font-bold bg-gradient-to-r from-primary via-accent to-primary hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                      style={{ backgroundSize: '200% auto' }}>
                      <span className="relative z-10">{isSubmittingRegister ? 'Sending...' : 'Submit Request'}</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => { setShowRegister(false); registerForm.reset(); setIsNewCustomer(null); }}
                      className="w-full h-8 text-xs text-gray-400 hover:text-gray-600">
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Popup — does not auto-close */}
      <Dialog open={showSuccessPopup} onOpenChange={() => {}}>
        <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-xs w-full" aria-describedby={undefined} onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
          <DialogTitle className="sr-only">Registration Successful</DialogTitle>
          <div className="relative overflow-hidden rounded-3xl bg-white border border-white/30 shadow-2xl">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 opacity-40 blur-xl"></div>
            <div className="absolute inset-[1px] rounded-3xl bg-white"></div>
            <div className="relative p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-primary fill-none stroke-current stroke-2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-black bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent mb-2" style={{ backgroundSize: '200% auto' }}>
                  Thank You!
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Thank you for registration.<br />Our team will contact you.
                </p>
              </div>
              <Button
                onClick={() => setShowSuccessPopup(false)}
                className="w-full h-10 text-sm font-bold bg-gradient-to-r from-primary via-accent to-primary transition-all duration-300"
                style={{ backgroundSize: '200% auto' }}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      </div>{/* end flex-1 center wrapper */}

      <Footer />
    </div>
  );
}

