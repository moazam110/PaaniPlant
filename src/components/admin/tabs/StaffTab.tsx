"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Users, BarChart3, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StaffTab() {
  const staffUrl = 'https://paani-f.onrender.com/staff';

  const handleOpenStaffDashboard = () => {
    window.open(staffUrl, '_blank');
  };

  return (
    <div className="p-4 space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Staff Dashboard Access</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Staff Delivery Interface</h3>
            <p className="text-muted-foreground">
              Access the staff dashboard to manage deliveries, update delivery status, and communicate with customers.
            </p>
            <Button onClick={handleOpenStaffDashboard} size="lg" className="w-full">
              <ExternalLink className="mr-2 h-5 w-5" />
              Open Staff Dashboard
            </Button>
          </div>
          
          <div className="border-t pt-6">
            <h4 className="font-medium mb-3">Staff Dashboard Features:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                <Truck className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">Delivery Management</div>
                  <div className="text-sm text-muted-foreground">View and update delivery status</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                <BarChart3 className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">Real-time Updates</div>
                  <div className="text-sm text-muted-foreground">Live delivery tracking</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium">Customer Communication</div>
                  <div className="text-sm text-muted-foreground">Direct customer contact</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> The staff dashboard opens in a new tab to ensure full functionality and optimal performance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 