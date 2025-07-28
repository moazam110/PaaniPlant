"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
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
      {/* Centered Add New Customer Button */}
      <div className="flex justify-center mb-6">
        <Button variant="default" onClick={onAddNewCustomer} size="lg" className="px-8 py-3">
          <UserPlus className="mr-2 h-5 w-5" /> Add New Customer
        </Button>
      </div>

      {/* Customer Management Section */}
      <Card className="glass-card border shadow-sm">
        <CardContent className="p-6">
          <CustomerList ref={customerListRef} onEditCustomer={onEditCustomer} />
        </CardContent>
      </Card>


    </div>
  );
}