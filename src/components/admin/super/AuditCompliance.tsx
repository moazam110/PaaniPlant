"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, FileText, Download, AlertTriangle } from 'lucide-react';

export function AuditCompliance() {
  const complianceStatus = [
    { item: 'Data Protection', status: 'compliant', lastCheck: '2024-01-15' },
    { item: 'Access Control', status: 'compliant', lastCheck: '2024-01-15' },
    { item: 'Audit Logging', status: 'compliant', lastCheck: '2024-01-15' },
    { item: 'Security Policies', status: 'warning', lastCheck: '2024-01-10' }
  ];

  const auditReports = [
    { name: 'Monthly Security Report', type: 'Security', lastGenerated: '2024-01-01', status: 'Available' },
    { name: 'Admin Activity Summary', type: 'Activity', lastGenerated: '2024-01-15', status: 'Available' },
    { name: 'System Access Logs', type: 'Access', lastGenerated: '2024-01-15', status: 'Available' },
    { name: 'Compliance Certificate', type: 'Compliance', lastGenerated: '2024-01-01', status: 'Available' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return <Badge variant="default" className="bg-green-100 text-green-800">Compliant</Badge>;
      case 'warning':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Review Due</Badge>;
      case 'non-compliant':
        return <Badge variant="destructive">Non-Compliant</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getReportStatusBadge = (status: string) => {
    switch (status) {
      case 'Available':
        return <Badge variant="default" className="bg-green-100 text-green-800">Available</Badge>;
      case 'Generating':
        return <Badge variant="secondary">Generating</Badge>;
      case 'Failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleGenerateReport = (reportName: string) => {
    console.log('Generating report:', reportName);
    // TODO: Implement report generation
  };

  const handleDownloadReport = (reportName: string) => {
    console.log('Downloading report:', reportName);
    // TODO: Implement report download
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit & Compliance</h1>
        <p className="text-muted-foreground">
          Monitor compliance status and generate audit reports
        </p>
      </div>

      {/* Compliance Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ClipboardCheck className="h-5 w-5" />
            <span>Compliance Status</span>
          </CardTitle>
          <CardDescription>
            Current compliance status across different areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceStatus.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {item.status === 'compliant' ? (
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  ) : (
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  )}
                  <span className="font-medium">{item.item}</span>
                </div>
                <div className="flex items-center space-x-4">
                  {getStatusBadge(item.status)}
                  <span className="text-sm text-muted-foreground">
                    Last check: {item.lastCheck}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Audit Reports</span>
          </CardTitle>
          <CardDescription>
            Generate and download various audit reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {auditReports.map((report, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <h3 className="font-medium">{report.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Type: {report.type} • Last generated: {report.lastGenerated}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  {getReportStatusBadge(report.status)}
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateReport(report.name)}
                    >
                      Generate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadReport(report.name)}
                      className="flex items-center space-x-1"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common compliance and audit tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
              <ClipboardCheck className="h-6 w-6" />
              <span>Run Compliance Check</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
              <FileText className="h-6 w-6" />
              <span>Generate All Reports</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
              <AlertTriangle className="h-6 w-6" />
              <span>View Violations</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
