
import React from 'react';
import Header from '@/components/shared/Header'; // Assuming Header is appropriately styled

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow">{children}</main>
      {/* Footer moved to AdminDashboardPage */}
    </div>
  );
}
