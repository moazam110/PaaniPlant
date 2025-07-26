
"use client";

import React, { useEffect, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import type { Customer } from '@/types';
// REMOVE: import { db } from '@/lib/firebase';
// REMOVE: import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; // Removed AvatarImage
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle2, Search, Pencil } from 'lucide-react'; // Added Pencil
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button'; // Added Button

interface CustomerListProps {
  onEditCustomer?: (customer: Customer) => void; // Optional for now, will be used by AdminDashboardPage
}

export interface CustomerListRef {
  refreshCustomers: () => void;
}

const CustomerList = forwardRef<CustomerListRef, CustomerListProps>(({ onEditCustomer }, ref) => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setIsLoading(true);
    console.log('Fetching customers...');
    try {
      const response = await fetch('http://localhost:4000/api/customers');
      console.log('Customer fetch response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched customers:', data);
      setAllCustomers(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to fetch customers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    
    // Set up real-time updates every 10 seconds for customer list
    const interval = setInterval(fetchCustomers, 10000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  useImperativeHandle(ref, () => ({
    refreshCustomers: fetchCustomers,
  }));

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) {
      return allCustomers;
    }
    return allCustomers.filter(customer => {
      const term = searchTerm.toLowerCase();
      return (
        customer.name.toLowerCase().includes(term) ||
        (customer.phone && customer.phone.toLowerCase().includes(term)) ||
        customer.address.toLowerCase().includes(term)
      );
    });
  }, [allCustomers, searchTerm]);

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-10 w-1/3" /> 
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-2 border rounded-md">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1 flex-grow">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchCustomers} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name, phone, or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={fetchCustomers} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'No customers found matching your search.' : 'No customers found. Add your first customer!'}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-center">Default Cans</TableHead>
                <TableHead className="text-center">Price/Can</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer, idx) => {
                const isSindhiName = /[\u0621-\u064a]/.test(customer.name);
                const nameClasses = cn(isSindhiName ? 'font-sindhi rtl' : 'ltr');
                const initials = customer.name.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
                return (
                  <TableRow key={customer._id || customer.customerId || idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {initials.substring(0,2)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className={nameClasses}>{customer.name}</TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell className="whitespace-normal break-words max-w-xs">{customer.address}</TableCell>
                    <TableCell className="text-center">{customer.defaultCans}</TableCell>
                    <TableCell className="text-center">{customer.pricePerCan ? `Rs. ${customer.pricePerCan}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      {onEditCustomer && (
                        <Button variant="ghost" size="icon" onClick={() => onEditCustomer(customer)} title="Edit Customer">
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
});

CustomerList.displayName = "CustomerList";

export default CustomerList;
    
