
"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "", 
      password: "",   
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      // TODO: Implement actual login logic with an API endpoint
      // For now, we'll just simulate a successful login
      console.log("Simulating login with:", data);
      toast({
        title: "Login Successful",
        description: "Simulated login successful. Redirecting to admin page.",
      });
      router.push('/admin'); 
    } catch (error: any) {
      // Removed console.error to prevent Next.js dev overlay for handled errors
      
      let userFriendlyMessage = "An unexpected error occurred during login.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        userFriendlyMessage = "Login failed: Invalid email or password. Please check your credentials and try again.";
      } else if (error.code === 'auth/too-many-requests') {
        userFriendlyMessage = "Access temporarily disabled due to too many failed login attempts. Please try again later or reset your password.";
      }
      // Add more specific Firebase error codes here if needed

      toast({
        variant: "destructive",
        title: "Login Attempt Failed",
        description: userFriendlyMessage,
      });
    }
  };

  return (
    <Card className="w-full max-w-md glass-card">
      <CardHeader>
        <CardTitle className="text-3xl font-headline text-center text-primary">Admin Login</CardTitle>
        <CardDescription className="text-center">Enter your credentials to access the dashboard.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="admin@example.com" {...field} className="bg-input/80 backdrop-blur-sm"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} className="bg-input/80 backdrop-blur-sm"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col items-center pt-2">
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Logging in..." : "Login"}
            </Button>
            
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
