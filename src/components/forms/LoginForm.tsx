
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

interface LoginFormProps {
  userType?: 'admin' | 'staff';
}

// No hardcoded credentials - authentication removed for direct access

export default function LoginForm({ userType = 'admin' }: LoginFormProps) {
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
    // No authentication required - directly redirect to dashboard
    console.log(`✅ ${userType} access granted (no authentication required)`);
    
    toast({
      title: "Access Granted",
      description: `Welcome ${userType}! Redirecting to dashboard.`,
    });
    
    // Redirect based on user type
    if (userType === 'admin') {
      router.push('/admin');
    } else {
      router.push('/staff');
    }
  };

  return (
    <Card className="w-full max-w-md glass-card">
      <CardHeader>
        <CardTitle className="text-3xl font-headline text-center text-primary">
          {userType === 'admin' ? 'Admin' : 'Staff'} Login
        </CardTitle>
        <CardDescription className="text-center">
          Click login to access the {userType} dashboard (no authentication required).
        </CardDescription>
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
                      <Input 
                        type="email" 
                        placeholder="" 
                        {...field} 
                        className="bg-input/80 backdrop-blur-sm"
                      />
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
                      <Input 
                        type="password" 
                        placeholder="" 
                        {...field} 
                        className="bg-input/80 backdrop-blur-sm"
                      />
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
