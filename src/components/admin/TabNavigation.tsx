"use client";

import React, { useRef, useEffect, useState } from 'react';
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
  const [isMounted, setIsMounted] = useState(false);
  
  // Convert children to array for easier access
  const childrenArray = React.Children.toArray(children);
  
  // Find active index with proper fallback
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  const validActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  // Ensure component is mounted
  useEffect(() => {
    setIsMounted(true);
    console.log('TabNavigation mounted with activeTab:', activeTab);
  }, []);

  // Debug logging for tab switching
  useEffect(() => {
    console.log('TabNavigation State:', {
      activeTab,
      activeIndex,
      validActiveIndex,
      tabsLength: tabs.length,
      childrenCount: childrenArray.length,
      isMounted
    });
    
    if (activeTab === 'customers') {
      console.log('🎯 Customer tab should now be visible!');
    }
  }, [activeTab, validActiveIndex, childrenArray.length, isMounted]);

  // Hide keyboard when switching tabs
  useEffect(() => {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.blur) {
      activeElement.blur();
    }
  }, [activeTab]);

  if (!isMounted) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Loading navigation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab Navigation Bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border shadow-sm">
        <nav className="flex w-full">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            
            return (
              <button
                key={tab.id}
                onClick={() => {
                  console.log(`Switching to tab: ${tab.id}`);
                  onTabChange(tab.id);
                }}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-3 px-2 transition-all duration-200 ease-in-out",
                  "min-h-[60px] touch-manipulation relative",
                  isActive
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                aria-label={`Switch to ${tab.label} tab`}
                role="tab"
                aria-selected={isActive}
                type="button"
              >
                <Icon className={cn(
                  "h-5 w-5 mb-1 transition-transform duration-200",
                  isActive && "scale-110"
                )} />
                <span className="text-xs font-medium">{tab.label}</span>
                {isActive && (
                  <div className="absolute inset-0 bg-primary/10 rounded-md opacity-50" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content - Simple Conditional Rendering */}
      <div className="flex-1 overflow-hidden relative bg-background">
        {/* Debug Panel */}
        <div className="absolute top-2 right-2 z-50 bg-yellow-100 border border-yellow-400 rounded px-2 py-1 text-xs">
          Active: {activeTab} ({validActiveIndex})
        </div>

        {/* Render only the active tab content */}
        {childrenArray.map((child, index) => {
          const isActiveChild = index === validActiveIndex;
          
          return (
            <div
              key={index}
              className={cn(
                "absolute inset-0 w-full h-full overflow-y-auto",
                isActiveChild ? "block" : "hidden"
              )}
              style={{
                display: isActiveChild ? 'block' : 'none'
              }}
            >
              {/* Additional debug info for customer tab */}
              {activeTab === 'customers' && index === validActiveIndex && (
                <div className="absolute top-0 left-0 w-full bg-green-100 border-b-2 border-green-500 p-2 z-40">
                  <p className="text-green-800 text-sm font-medium">
                    ✅ Customer Tab Content is Rendering (Index: {index}, Active Index: {validActiveIndex})
                  </p>
                </div>
              )}
              
              {/* Render the actual child content */}
              <div className={activeTab === 'customers' ? 'pt-12' : ''}>
                {child}
              </div>
            </div>
          );
        })}

        {/* Fallback content if no children */}
        {childrenArray.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">No content available</p>
              <p className="text-sm text-muted-foreground">No child components found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}