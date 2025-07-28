"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Settings, Users } from 'lucide-react';
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
      <Card className="glass-card border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Customer Records</CardTitle>
            </div>
            <Button variant="default" onClick={onAddNewCustomer} size="sm">
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
      <Card className="glass-card border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Settings className="mr-2 h-5 w-5 text-primary" />
            System Configuration
          </CardTitle>
          <CardDescription>Manage system settings and configurations.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground mb-4">
            System management functionality will be available soon.
          </p>
          <Button variant="outline" disabled>
            <Settings className="mr-2 h-4 w-4" />
            Configure Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}