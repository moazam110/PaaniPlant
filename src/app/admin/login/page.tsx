
import LoginForm from '@/components/forms/LoginForm';
import React from 'react';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--accent))]/10"> {/* Subtle gradient for light theme */}
      <LoginForm />
    </div>
  );
}
