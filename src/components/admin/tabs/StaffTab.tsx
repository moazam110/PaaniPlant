"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StaffTab() {
  const staffUrl = 'https://paani-f.onrender.com/staff';

  const handleOpenInNewTab = () => {
    window.open(staffUrl, '_blank');
  };

  return (
    <div className="p-4 space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Staff Dashboard</CardTitle>
            <Button variant="outline" onClick={handleOpenInNewTab}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in New Tab
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <iframe
            src={staffUrl}
            className="w-full h-[calc(100vh-200px)] border-0"
            title="Staff Dashboard"
            loading="lazy"
          />
        </CardContent>
      </Card>
    </div>
  );
} 