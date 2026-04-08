"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', mobile: '', address: '', cans: '1', notes: '' },
  });

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    setIsSubmittingRegister(true);
    try {
      const response = await fetch(buildApiUrl('api/register-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to send request.');
      }
      toast({
        title: "Request Sent!",
        description: "Your registration request has been sent. Admin will contact you shortly.",
        duration: 10000,
      });
      setShowRegister(false);
      registerForm.reset();
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

      {/* Registration Dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-sm w-full" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Customer Registration Request</DialogTitle>
          <div className="relative overflow-hidden rounded-3xl bg-white border border-white/30 shadow-2xl">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 opacity-50 blur-xl"></div>
            <div className="absolute inset-[1px] rounded-3xl bg-white"></div>
            <div className="relative p-5">
              <div className="text-center mb-3">
                <h2 className="text-2xl font-black bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent" style={{ backgroundSize: '200% auto' }}>
                  REGISTER
                </h2>
                <div className="h-0.5 w-14 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent rounded-full mt-1"></div>
              </div>

              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-2">
                  <FormField control={registerForm.control} name="name" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-gray-700 font-semibold text-xs">Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" {...field}
                          className="bg-white border-2 border-primary/30 focus:border-primary focus:ring-0 focus:outline-none h-9 text-sm text-gray-900" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />

                  <FormField control={registerForm.control} name="mobile" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-gray-700 font-semibold text-xs">WhatsApp / Mobile *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 03001234567" {...field}
                          className="bg-white border-2 border-primary/30 focus:border-primary focus:ring-0 focus:outline-none h-9 text-sm text-gray-900" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />

                  <FormField control={registerForm.control} name="address" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-gray-700 font-semibold text-xs">Address *</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter your full address" {...field}
                          className="bg-white border-2 border-primary/30 focus:border-primary focus:ring-0 focus:outline-none text-sm text-gray-900 resize-none min-h-0" rows={1} />
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
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex-1 h-9 flex items-center justify-center border-2 border-primary/30 rounded-lg bg-white text-gray-900 font-bold text-sm">
                            {field.value || '1'}
                          </div>
                          <button type="button"
                            onClick={() => { const c = parseInt(field.value || '1'); field.onChange(String(c + 1)); }}
                            className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg border-2 border-primary/30 text-primary hover:bg-primary hover:text-white hover:border-primary transition-all">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={registerForm.control} name="notes" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-gray-700 font-semibold text-xs">Any Note <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any special instructions..." {...field}
                          className="bg-white border-2 border-primary/30 focus:border-primary focus:ring-0 focus:outline-none text-sm text-gray-900 resize-none min-h-0" rows={1} />
                      </FormControl>
                    </FormItem>
                  )} />

                  <div className="pt-2 space-y-1.5">
                    <Button type="submit" disabled={isSubmittingRegister}
                      className="w-full h-10 text-sm font-bold bg-gradient-to-r from-primary via-accent to-primary hover:shadow-primary/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                      style={{ backgroundSize: '200% auto' }}>
                      <span className="relative z-10">{isSubmittingRegister ? 'Sending...' : 'Submit Request'}</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => { setShowRegister(false); registerForm.reset(); }}
                      className="w-full h-7 text-xs text-gray-400 hover:text-gray-600">
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>{/* end flex-1 center wrapper */}

      <Footer />
    </div>
  );
}

