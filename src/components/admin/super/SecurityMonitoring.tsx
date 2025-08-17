"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  Clock, 
  Ban, 
  CheckCircle,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';

export function SecurityMonitoring() {
  const [showBlockedIPs, setShowBlockedIPs] = useState(false);

  // Mock data - will be replaced with real API calls
  const securityStats = {
    failedLogins: 5,
    suspiciousIPs: 1,
    bruteForceAttempts: 0,
    activeSessions: 3,
    lockedAccounts: 1,
    passwordExpiry: 2,
    blockedIPs: 2,
    whitelistedIPs: 5,
    recentBlocked: 1
  };

  const activeSessions = [
    { id: '1', user: 'john_a', ip: '192.168.1.5', location: 'Office', lastActivity: '2 min ago' },
    { id: '2', user: 'sarah_m', ip: '192.168.1.10', location: 'Office', lastActivity: '15 min ago' },
    { id: '3', user: 'mike_k', ip: '192.168.1.15', location: 'Remote', lastActivity: '1 hour ago' }
  ];

  const blockedIPs = [
    { ip: '203.0.113.45', reason: 'Multiple failed logins', blockedAt: '2024-01-15 10:30', attempts: 15 },
    { ip: '198.51.100.123', reason: 'Suspicious activity', blockedAt: '2024-01-15 09:15', attempts: 8 }
  ];

  const whitelistedIPs = [
    { ip: '192.168.1.0/24', description: 'Office Network', addedAt: '2024-01-01' },
    { ip: '10.0.0.0/8', description: 'VPN Range', addedAt: '2024-01-01' }
  ];

  const handleForceLogoutAll = () => {
    console.log('Force logout all users');
    // TODO: Implement force logout functionality
  };

  const handleUnblockIP = (ip: string) => {
    console.log('Unblock IP:', ip);
    // TODO: Implement IP unblock functionality
  };

  const handleAddToWhitelist = (ip: string) => {
    console.log('Add to whitelist:', ip);
    // TODO: Implement whitelist functionality
  };

  const handleRefreshSecurity = () => {
    console.log('Refreshing security data');
    // TODO: Implement refresh functionality
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor threats, manage access, and control security settings
          </p>
        </div>
        <Button onClick={handleRefreshSecurity} variant="outline" className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Security Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Threat Detection */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Threat Detection</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Failed Logins:</span>
                <Badge variant={securityStats.failedLogins > 0 ? "destructive" : "default"}>
                  {securityStats.failedLogins}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Suspicious IPs:</span>
                <Badge variant={securityStats.suspiciousIPs > 0 ? "destructive" : "default"}>
                  {securityStats.suspiciousIPs}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Brute Force:</span>
                <Badge variant={securityStats.bruteForceAttempts > 0 ? "destructive" : "default"}>
                  {securityStats.bruteForceAttempts}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access Control */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Access Control</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active Sessions:</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {securityStats.activeSessions}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Locked Accounts:</span>
                <Badge variant="destructive">{securityStats.lockedAccounts}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Password Expiry:</span>
                <Badge variant="secondary">{securityStats.passwordExpiry}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* IP Address Monitoring */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IP Monitoring</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Blocked IPs:</span>
                <Badge variant="destructive">{securityStats.blockedIPs}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Whitelisted:</span>
                <Badge variant="default" className="bg-blue-100 text-blue-800">
                  {securityStats.whitelistedIPs}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Recent Blocked:</span>
                <Badge variant="secondary">{securityStats.recentBlocked}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Session Management</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Session Timeout:</span>
                <span className="text-xs text-muted-foreground">8h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Idle Timeout:</span>
                <span className="text-xs text-muted-foreground">30m</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={handleForceLogoutAll}
              >
                Force Logout All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Currently active user sessions across the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{session.user}</p>
                    <p className="text-sm text-muted-foreground">
                      {session.ip} • {session.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">
                    Last activity: {session.lastActivity}
                  </span>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* IP Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blocked IPs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Ban className="h-5 w-5 text-red-500" />
              <span>Blocked IP Addresses</span>
            </CardTitle>
            <CardDescription>
              IP addresses that have been blocked due to security violations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {blockedIPs.map((blockedIP, index) => (
                <div
                  key={index}
                  className="p-3 border border-red-200 bg-red-50 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-red-800">{blockedIP.ip}</p>
                      <p className="text-sm text-red-600">{blockedIP.reason}</p>
                      <p className="text-xs text-red-500">
                        Blocked: {blockedIP.blockedAt} • Attempts: {blockedIP.attempts}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnblockIP(blockedIP.ip)}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        Unblock
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToWhitelist(blockedIP.ip)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        Whitelist
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Whitelisted IPs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Whitelisted IP Addresses</span>
            </CardTitle>
            <CardDescription>
              Trusted IP addresses that bypass security restrictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {whitelistedIPs.map((whitelistedIP, index) => (
                <div
                  key={index}
                  className="p-3 border border-green-200 bg-green-50 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-800">{whitelistedIP.ip}</p>
                      <p className="text-sm text-green-600">{whitelistedIP.description}</p>
                      <p className="text-xs text-green-500">
                        Added: {whitelistedIP.addedAt}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
