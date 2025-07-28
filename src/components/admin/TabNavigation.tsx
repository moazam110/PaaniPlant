"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Truck, BarChart3, Users, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

const tabs = [
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'staff', label: 'Staff', icon: UserCheck },
];

export default function TabNavigation({ activeTab, onTabChange, children }: TabNavigationProps) {
  // Convert children to array
  const childrenArray = React.Children.toArray(children);
  
  // Staff access dialog state
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [staffEmail, setStaffEmail] = useState('staff@paani.com');
  const [staffPassword, setStaffPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleStaffAuthentication = () => {
    setIsAuthenticating(true);
    
    // Simulate authentication delay
    setTimeout(() => {
      if (staffEmail === 'staff@paani.com' && staffPassword === 'staffpaani@123') {
        // Store staff access for admin
        localStorage.setItem('admin_staff_access', JSON.stringify({
          grantedAt: new Date().toISOString(),
          sessionId: `admin_staff_${Date.now()}`
        }));
        
        // Close dialog and open staff dashboard
        setShowStaffDialog(false);
        setStaffPassword('');
        setIsAuthenticating(false);
        
        // Open staff dashboard
        window.open('/staff', '_blank');
      } else {
        // Invalid credentials
        alert('Invalid staff credentials. Please try again.');
        setIsAuthenticating(false);
        setStaffPassword('');
      }
    }, 500);
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === 'staff') {
      // Check if admin has staff access, if not show dialog for credentials
      const staffAccess = localStorage.getItem('admin_staff_access');
      if (staffAccess) {
        // Admin already has staff access, open staff dashboard
        window.open('/staff', '_blank');
      } else {
        // Show staff credentials dialog
        setShowStaffDialog(true);
      }
      return;
    }
    onTabChange(tabId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b bg-background">
        <nav className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-3 px-2",
                  "min-h-[60px]",
                  isActive
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Show delivery content */}
        {activeTab === 'delivery' && childrenArray[0]}
        
        {/* Show stats content */}
        {activeTab === 'stats' && childrenArray[1]}
        
        {/* Show customers content */}
        {activeTab === 'customers' && childrenArray[2]}
        
        {/* Staff tab opens separately, no content */}
      </div>

      {/* Staff Access Dialog */}
      <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Staff Dashboard Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="staff-email">Staff Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="staff@paani.com"
                disabled={isAuthenticating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-password">Staff Password</Label>
              <Input
                id="staff-password"
                type="password"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                placeholder="staffpaani@123"
                disabled={isAuthenticating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAuthenticating) {
                    handleStaffAuthentication();
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStaffDialog(false);
                  setStaffPassword('');
                }}
                disabled={isAuthenticating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStaffAuthentication}
                disabled={isAuthenticating || !staffPassword}
              >
                {isAuthenticating ? 'Authenticating...' : 'Access Staff Dashboard'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}