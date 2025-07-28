"use client";

import React, { useState, useEffect } from 'react';
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
  const [isVisible, setIsVisible] = useState(false);

  // Debug: Check if the component is mounting
  useEffect(() => {
    console.log('CustomersTab mounted');
    setIsVisible(true);
    return () => {
      console.log('CustomersTab unmounted');
    };
  }, []);

  // Debug: Check if props are being passed correctly
  useEffect(() => {
    console.log('CustomersTab props:', {
      hasCustomerListRef: !!customerListRef,
      hasOnEditCustomer: !!onEditCustomer,
      hasOnAddNewCustomer: !!onAddNewCustomer
    });
  }, [customerListRef, onEditCustomer, onAddNewCustomer]);

  if (!isVisible) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading Customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 min-h-screen bg-background">
      {/* Simple Test Content - This should ALWAYS show */}
      <div className="bg-red-100 border-2 border-red-500 rounded-lg p-6 text-center">
        <h1 className="text-2xl font-bold text-red-800 mb-2">🎯 CUSTOMER TAB IS WORKING!</h1>
        <p className="text-red-700">If you can see this red box, the Customer tab navigation is working correctly.</p>
        <p className="text-red-600 text-sm mt-2">Customer Tab Active | Time: {new Date().toLocaleTimeString()}</p>
      </div>

      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Debug:</strong> CustomersTab is now visible and rendering
        </p>
      </div>

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
          <div className="min-h-[300px]">
            <CustomerList ref={customerListRef} onEditCustomer={onEditCustomer} />
          </div>
        </CardContent>
      </Card>

      {/* Test Section to ensure rendering works */}
      <Card className="glass-card border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Settings className="mr-2 h-5 w-5 text-primary" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-lg font-semibold text-green-600">✓ Tab Navigation</div>
              <div className="text-sm text-green-600">Working properly</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-lg font-semibold text-blue-600">✓ Component Loading</div>
              <div className="text-sm text-blue-600">CustomersTab rendered successfully</div>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => {
              console.log('Test button clicked in CustomersTab');
              if (customerListRef.current) {
                customerListRef.current.refreshCustomers();
              }
            }}>
              <Settings className="mr-2 h-4 w-4" />
              Refresh Customer Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}