
"use client";

import React from 'react';
import Header from '@/components/shared/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { UserCog, HardHat } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background"> 
      <Header title="Paani Delivery System" /> 
      <main className="flex-grow flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--accent))]/5"> 
        <div className="container mx-auto text-center max-w-2xl">
            <Card className="glass-card p-6 md:p-10"> 
                <CardHeader>
                    <CardTitle className="text-4xl font-bold mb-4 font-headline text-primary">
                        Welcome!
                    </CardTitle>
                    <CardDescription className="text-lg text-muted-foreground mb-8">
                        Select your portal to continue.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Link href="/admin" passHref>
                        <Button size="lg" className="w-full py-8 text-xl shadow-md hover:shadow-lg transition-shadow">
                            <UserCog className="mr-3 h-8 w-8" />
                            Admin Panel
                        </Button>
                    </Link>
                    <Link href="/staff" passHref>
                        <Button size="lg" className="w-full py-8 text-xl shadow-md hover:shadow-lg transition-shadow">
                            <HardHat className="mr-3 h-8 w-8" />
                            Staff App
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
      </main>
      <footer className="text-center p-4 text-sm text-muted-foreground bg-background/80"> 
        Paani Delivery System &copy; {new Date().getFullYear()} 
      </footer>
    </div>
  );
}

