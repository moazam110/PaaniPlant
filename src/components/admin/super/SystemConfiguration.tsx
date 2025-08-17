"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Shield, Bell, Database } from 'lucide-react';

export function SystemConfiguration() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground">
          Configure global system settings and security policies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Security Settings</span>
            </CardTitle>
            <CardDescription>
              Configure password policies and security measures
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Password Policy</Label>
              <select className="w-full p-2 border rounded-md">
                <option>Strong</option>
                <option>Medium</option>
                <option>Weak</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Session Timeout</Label>
              <Input type="text" placeholder="8 hours" />
            </div>
            <div className="space-y-2">
              <Label>Login Attempts</Label>
              <Input type="number" placeholder="5" />
            </div>
            <div className="space-y-2">
              <Label>Account Lockout</Label>
              <Input type="text" placeholder="30 minutes" />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Notification Settings</span>
            </CardTitle>
            <CardDescription>
              Configure alert thresholds and notification methods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Email Alerts</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>SMS Alerts</Label>
              <Switch />
            </div>
            <div className="space-y-2">
              <Label>Alert Threshold</Label>
              <Input type="text" placeholder="3 failed logins" />
            </div>
          </CardContent>
        </Card>

        {/* Database Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Database Settings</span>
            </CardTitle>
            <CardDescription>
              Configure backup and maintenance settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Backup Frequency</Label>
              <select className="w-full p-2 border rounded-md">
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Log Retention</Label>
              <Input type="text" placeholder="90 days" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto Cleanup</Label>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>System Information</span>
            </CardTitle>
            <CardDescription>
              Current system status and version information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>System Version</Label>
              <Input value="v1.0.0" disabled />
            </div>
            <div className="space-y-2">
              <Label>Last Updated</Label>
              <Input value="2024-01-15" disabled />
            </div>
            <div className="space-y-2">
              <Label>Database Version</Label>
              <Input value="MongoDB 6.0" disabled />
            </div>
            <div className="space-y-2">
              <Label>Node.js Version</Label>
              <Input value="v18.17.0" disabled />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline">Reset to Defaults</Button>
        <Button>Save Changes</Button>
      </div>
    </div>
  );
}
