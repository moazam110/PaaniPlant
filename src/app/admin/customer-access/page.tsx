"use client";

/**
 * Customer Access Management Page
 * 
 * Admin page for managing customer dashboard access and credentials
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CustomerAccessManagement from '@/components/admin/CustomerAccessManagement';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function CustomerAccessPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check admin authentication
  useEffect(() => {
    const checkAuth = () => {
      try {
        const authSession = localStorage.getItem('paani_auth_session');
        if (authSession) {
          const session = JSON.parse(authSession);
          if (session.userType === 'admin' && session.email === 'admin@paani.com') {
            setIsAuthenticated(true);
          } else {
            router.push('/admin/login');
          }
        } else {
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        router.push('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/30 to-primary/50 animate-gradient"></div>
        <div className="relative z-10">
          <Card className="glass-card">
            <CardContent className="p-8">
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

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

      <main className="flex-grow relative z-10 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header - Same line */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin')}
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <div className="text-center flex-1">
              <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient mb-2" style={{ backgroundSize: '200% auto' }}>
                Customer Access Management
              </h1>
              <p className="text-muted-foreground">
                Manage customer dashboard access and credentials
              </p>
            </div>
            <div className="w-[180px]"></div> {/* Spacer to balance layout */}
          </div>

          {/* Customer Access Management */}
          <Card className="glass-card border-2 border-primary/30">
            <CardContent className="p-6">
              <CustomerAccessManagement onClose={() => router.push('/admin')} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

