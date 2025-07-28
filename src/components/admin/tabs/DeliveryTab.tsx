"use client";

import React from 'react';
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
    <div className="p-4">
      <DeliveryRequestList 
        onInitiateNewRequest={onInitiateNewRequest}
        onEditRequest={onEditRequest}
        deliveryRequests={deliveryRequests}
        setDeliveryRequests={setDeliveryRequests}
      />
    </div>
  );
}