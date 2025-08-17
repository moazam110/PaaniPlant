"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, UserX, UserCheck, Trash2 } from 'lucide-react';

interface Admin {
  id: string;
  name: string;
  username: string;
  email: string;
  status: 'active' | 'suspended' | 'deleted';
  lastLogin: string;
  createdAt: string;
}

export function AdminManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Mock data - will be replaced with real API calls
  const admins: Admin[] = [
    {
      id: '1',
      name: 'John Doe',
      username: 'john_doe',
      email: 'john@example.com',
      status: 'active',
      lastLogin: '2 hours ago',
      createdAt: '2024-01-10'
    },
    {
      id: '2',
      name: 'Sarah Miller',
      username: 'sarah_m',
      email: 'sarah@example.com',
      status: 'active',
      lastLogin: '1 day ago',
      createdAt: '2024-01-08'
    },
    {
      id: '3',
      name: 'Mike Johnson',
      username: 'mike_k',
      email: 'mike@example.com',
      status: 'suspended',
      lastLogin: '5 days ago',
      createdAt: '2024-01-05'
    }
  ];

  const filteredAdmins = admins.filter(admin =>
    admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      case 'deleted':
        return <Badge variant="secondary">Deleted</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleCreateAdmin = () => {
    setShowCreateForm(true);
  };

  const handleEditAdmin = (adminId: string) => {
    console.log('Edit admin:', adminId);
    // TODO: Implement edit functionality
  };

  const handleSuspendAdmin = (adminId: string) => {
    console.log('Suspend admin:', adminId);
    // TODO: Implement suspend functionality
  };

  const handleActivateAdmin = (adminId: string) => {
    console.log('Activate admin:', adminId);
    // TODO: Implement activate functionality
  };

  const handleDeleteAdmin = (adminId: string) => {
    console.log('Delete admin:', adminId);
    // TODO: Implement delete functionality
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Management</h1>
          <p className="text-muted-foreground">
            Create and manage admin accounts
          </p>
        </div>
        <Button onClick={handleCreateAdmin} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Create New Admin</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search admins by name, username, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">Filter</Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin List */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Accounts</CardTitle>
          <CardDescription>
            {filteredAdmins.length} admin{filteredAdmins.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAdmins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-primary font-semibold">
                      {admin.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium">{admin.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      @{admin.username} • {admin.email}
                    </p>
                    <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                      <span>Created: {admin.createdAt}</span>
                      <span>Last login: {admin.lastLogin}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {getStatusBadge(admin.status)}
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditAdmin(admin.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    {admin.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuspendAdmin(admin.id)}
                        className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivateAdmin(admin.id)}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <UserCheck className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAdmin(admin.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Admin Form - Placeholder */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Admin</CardTitle>
            <CardDescription>
              Fill in the details to create a new admin account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center py-8 text-muted-foreground">
              Create Admin Form will be implemented here
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button>Create Admin</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
