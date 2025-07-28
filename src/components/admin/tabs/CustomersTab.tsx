"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Settings } from 'lucide-react';
import CustomerList, { CustomerListRef } from '@/components/admin/CustomerList';
import type { Customer } from '@/types';

interface CustomersTabProps {
  customerListRef: React.RefObject<CustomerListRef>;
  onEditCustomer: (customer: Customer) => void;
  onAddNewCustomer: () => void;
}

export default function CustomersTab({
  customerListRef,
  onEditCustomer,
  onAddNewCustomer
}: CustomersTabProps) {
  return (
    <div className="p-4 space-y-6">
      {/* Customer Management Section */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Customer Records</CardTitle>
            <Button variant="default" onClick={onAddNewCustomer}>
              <UserPlus className="mr-2 h-4 w-4" /> Add New Customer
            </Button>
          </div>
          <CardDescription>View, search, and manage customer profiles.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <CustomerList ref={customerListRef} onEditCustomer={onEditCustomer} />
        </CardContent>
      </Card>

      {/* System Settings Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
          <CardDescription>Manage admin accounts and system-wide settings.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground mb-4">
            Admin user management functionality removed. Users are managed via Firebase Console.
          </p>
          <Button variant="outline" className="mt-4" disabled>
            <Settings className="mr-2 h-4 w-4" />
            Configure (Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}