"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="p-4 space-y-6 min-h-0 flex flex-col">
      {/* Delivery Management Section */}
      <Card className="glass-card border shadow-sm flex-1 flex flex-col min-h-0">
        <CardContent className="p-6 flex-1 flex flex-col min-h-0 overflow-visible">
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