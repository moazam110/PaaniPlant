"use client";

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Truck, BarChart3, Users, UserCheck } from 'lucide-react';

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
  
  // Find which tab is active
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  
  // Debug logging
  useEffect(() => {
    console.log('Simple TabNavigation:', {
      activeTab,
      activeIndex,
      childrenCount: childrenArray.length
    });
  }, [activeTab, activeIndex, childrenArray.length]);

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
                onClick={() => onTabChange(tab.id)}
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
        
        {/* Show staff content */}
        {activeTab === 'staff' && childrenArray[3]}
        
        {/* Debug info */}
        <div className="fixed bottom-4 right-4 bg-black text-white px-2 py-1 rounded text-xs z-50">
          {activeTab} (index: {activeIndex})
        </div>
      </div>
    </div>
  );
}