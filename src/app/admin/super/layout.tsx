import React from 'react';
import { SuperAdminSidebar } from '@/components/admin/super/SuperAdminSidebar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRole="super_admin">
      <div className="flex h-screen bg-background">
        <SuperAdminSidebar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
