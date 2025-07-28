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
  const contentRef = useRef<HTMLDivElement>(null);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Simplified activeIndex calculation with proper fallback
  let activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  if (activeIndex === -1) {
    activeIndex = 0; // Default to first tab if not found
  }

  // Convert children to array for easier handling
  const childrenArray = React.Children.toArray(children);

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setStartY(e.touches[0].clientY);
    setIsDragging(false);
  };

  // Handle touch move  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startX || !startY) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    
    const diffX = Math.abs(currentX - startX);
    const diffY = Math.abs(currentY - startY);

    // Only handle horizontal swipes (ignore vertical scrolling)
    if (diffX > diffY && diffX > 20) {
      const target = e.target as HTMLElement;
      const isScrollableElement = target.closest('.overflow-y-auto, .overflow-auto, table, .table-container');
      
      if (!isScrollableElement) {
        setIsDragging(true);
        e.preventDefault();
      }
    }
  };

  // Handle touch end
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!startX || !isDragging) return;

    const endX = e.changedTouches[0].clientX;
    const diffX = startX - endX;
    const threshold = 50;

    if (Math.abs(diffX) > threshold) {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      
      if (diffX > 0 && currentIndex < tabs.length - 1) {
        onTabChange(tabs[currentIndex + 1].id);
      } else if (diffX < 0 && currentIndex > 0) {
        onTabChange(tabs[currentIndex - 1].id);
      }
    }

    setStartX(0);
    setStartY(0);
    setIsDragging(false);
  };

  // Hide keyboard when switching tabs
  useEffect(() => {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.blur) {
      activeElement.blur();
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <nav className="flex w-full">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-3 px-2 transition-all duration-200 ease-in-out",
                  "min-h-[60px] touch-manipulation",
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
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Individual tab content - only show active tab */}
        {childrenArray.map((child, index) => (
          <div
            key={index}
            className={cn(
              "absolute inset-0 w-full h-full overflow-y-auto transition-opacity duration-300",
              index === activeIndex ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}