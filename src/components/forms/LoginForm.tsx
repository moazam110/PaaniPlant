
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  userType?: 'admin' | 'staff';
}

// Hardcoded authentication credentials
const HARDCODED_CREDENTIALS = {
  admin: {
    email: 'admin@paani.com',
    password: 'adminpaani@123'
  },
  staff: {
    email: 'staff@paani.com', 
    password: 'staffpaani@123'
  }
};

export default function LoginForm({ userType = 'admin' }: LoginFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "", 
      password: "",   
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const credentials = HARDCODED_CREDENTIALS[userType];
      
      // Check hardcoded credentials
      if (data.email === credentials.email && data.password === credentials.password) {
        // Create persistent session
        const authSession = {
          email: data.email,
          userType: userType,
          loginTime: new Date().toISOString(),
          sessionId: `${userType}_${Date.now()}`
        };
        
        // Store session in localStorage (persists until logout)
        localStorage.setItem('paani_auth_session', JSON.stringify(authSession));
        
        console.log(`✅ ${userType} authentication successful`);
        
        toast({
          title: "Login Successful",
          description: `Welcome ${userType}! Redirecting to dashboard.`,
        });
        
        // Redirect based on user type
        if (userType === 'admin') {
          router.push('/admin');
        } else {
          router.push('/staff');
        }
      } else {
        // Invalid credentials
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid email or password. Please check your credentials and try again.",
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      toast({
        variant: "destructive",
        title: "Login Error",
        description: "An unexpected error occurred during login. Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/30 to-primary/50 animate-gradient"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(63,81,181,0.4),transparent_50%)] animate-pulse"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(48,63,159,0.4),transparent_50%)] animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(63,81,181,0.2),transparent_70%)]"></div>
      
      {/* Animated floating orbs */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-accent/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>

      {/* Main login card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="relative overflow-hidden rounded-3xl bg-white backdrop-blur-2xl border border-white/30 shadow-2xl">
          {/* Animated border glow */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 opacity-50 animate-gradient blur-xl"></div>
          <div className="absolute inset-[1px] rounded-3xl bg-white"></div>
          
          <div className="relative p-8 md:p-10">
            {/* Title section with vibrant styling */}
            <div className="text-center mb-8">
              <div className="inline-block mb-4">
                <h1 className={`text-5xl md:text-6xl font-black bg-gradient-to-r ${userType === 'admin' ? 'from-primary via-accent to-primary' : 'from-accent via-primary to-accent'} bg-clip-text text-transparent animate-gradient`} style={{ backgroundSize: '200% auto' }}>
                  {userType === 'admin' ? 'ADMIN' : 'STAFF'}
                </h1>
              </div>
              <div className="h-1 w-24 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent rounded-full"></div>
            </div>

      <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                          <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                      <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">Email</FormLabel>
                    <FormControl>
                        <div className="relative group">
                      <Input 
                        type="email" 
                            placeholder={userType === 'admin' ? 'admin@paani.com' : 'staff@paani.com'} 
                        {...field} 
                            className="bg-white border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all duration-300 h-12 text-base pr-4 pl-4 text-gray-900"
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
                            className="bg-white border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all duration-300 h-12 text-base pr-12 pl-4 text-gray-900"
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

                <div className="pt-4">
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
                </div>
        </form>
      </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
