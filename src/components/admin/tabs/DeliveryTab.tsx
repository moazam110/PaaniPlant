"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DeliveryRequestList from '@/components/admin/DeliveryRequestList';
import type { Customer, DeliveryRequest } from '@/types';

interface DeliveryTabProps {
  deliveryRequests: DeliveryRequest[];
  setDeliveryRequests: React.Dispatch<React.SetStateAction<DeliveryRequest[]>>;
  onInitiateNewRequest: (customer?: Customer) => void;
  onEditRequest: (request: DeliveryRequest) => void;
}

export default function DeliveryTab({
  deliveryRequests,
  setDeliveryRequests,
  onInitiateNewRequest,
  onEditRequest
}: DeliveryTabProps) {
  return (
    <div className="p-4 space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Delivery Request Dashboard</CardTitle>
          </div>
          <CardDescription>Search for requests or find customers to create new requests.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <DeliveryRequestList 
            onInitiateNewRequest={onInitiateNewRequest}
            onEditRequest={onEditRequest}
            deliveryRequests={deliveryRequests}
            setDeliveryRequests={setDeliveryRequests}
          />
        </CardContent>
      </Card>
    </div>
  );
}