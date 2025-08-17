"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Download, Calendar } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  ipAddress: string;
  type: 'authentication' | 'admin_activity' | 'security' | 'system' | 'database' | 'email';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
}

export function SystemLogs() {
  const [selectedLogType, setSelectedLogType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data - will be replaced with real API calls
  const logs: LogEntry[] = [
    {
      id: '1',
      timestamp: '2024-01-15 14:30:25',
      user: 'john_a',
      action: 'Login Success',
      ipAddress: '192.168.1.5',
      type: 'authentication',
      severity: 'low',
      details: 'User logged in successfully from IP 192.168.1.5'
    },
    {
      id: '2',
      timestamp: '2024-01-15 14:25:10',
      user: 'sarah_m',
      action: 'Created Customer',
      ipAddress: '192.168.1.10',
      type: 'admin_activity',
      severity: 'low',
      details: 'New customer "ABC Company" created with ID 12345'
    },
    {
      id: '3',
      timestamp: '2024-01-15 14:20:15',
      user: 'mike_k',
      action: 'Login Failed',
      ipAddress: '192.168.1.15',
      type: 'security',
      severity: 'medium',
      details: 'Failed login attempt with incorrect password'
    },
    {
      id: '4',
      timestamp: '2024-01-15 14:15:30',
      user: 'system',
      action: 'Database Backup',
      ipAddress: 'N/A',
      type: 'system',
      severity: 'low',
      details: 'Daily database backup completed successfully'
    }
  ];

  const logTypes = [
    { value: 'all', label: 'All Logs' },
    { value: 'authentication', label: 'Authentication' },
    { value: 'admin_activity', label: 'Admin Activity' },
    { value: 'security', label: 'Security Events' },
    { value: 'system', label: 'System Performance' },
    { value: 'database', label: 'Database Operations' },
    { value: 'email', label: 'Email Notifications' }
  ];

  const severityLevels = [
    { value: 'all', label: 'All Severities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];

  const filteredLogs = logs.filter(log => {
    const matchesType = selectedLogType === 'all' || log.type === selectedLogType;
    const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
    const matchesSearch = searchTerm === '' || 
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesSeverity && matchesSearch;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low':
        return <Badge variant="default" className="bg-green-100 text-green-800">Low</Badge>;
      case 'medium':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case 'high':
        return <Badge variant="default" className="bg-orange-100 text-orange-800">High</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'authentication':
        return <Badge variant="outline" className="border-blue-200 text-blue-700">Auth</Badge>;
      case 'admin_activity':
        return <Badge variant="outline" className="border-green-200 text-green-700">Activity</Badge>;
      case 'security':
        return <Badge variant="outline" className="border-red-200 text-red-700">Security</Badge>;
      case 'system':
        return <Badge variant="outline" className="border-purple-200 text-purple-700">System</Badge>;
      case 'database':
        return <Badge variant="outline" className="border-orange-200 text-orange-700">Database</Badge>;
      case 'email':
        return <Badge variant="outline" className="border-gray-200 text-gray-700">Email</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleExportLogs = () => {
    console.log('Exporting logs...');
    // TODO: Implement log export functionality
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
          <p className="text-muted-foreground">
            Monitor system activity, security events, and admin actions
          </p>
        </div>
        <Button onClick={handleExportLogs} className="flex items-center space-x-2">
          <Download className="h-4 w-4" />
          <span>Export Logs</span>
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedLogType} onValueChange={setSelectedLogType}>
              <SelectTrigger>
                <SelectValue placeholder="Log Type" />
              </SelectTrigger>
              <SelectContent>
                {logTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                {severityLevels.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Date Range</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <CardTitle>System Logs</CardTitle>
          <CardDescription>
            {filteredLogs.length} log entries found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        {log.timestamp}
                      </span>
                      {getTypeBadge(log.type)}
                      {getSeverityBadge(log.severity)}
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className="font-medium">User: {log.user}</span>
                      <span className="text-muted-foreground">Action: {log.action}</span>
                      <span className="text-muted-foreground">IP: {log.ipAddress}</span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{log.details}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredLogs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No logs found matching the current filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
