
"use client";

import React, { useState, useEffect } from 'react';
import type { DeliveryRequest } from '@/types';
import Header from '@/components/shared/Header';
import StaffDashboardMetrics from '@/components/dashboard/StaffDashboardMetrics';
import RequestQueue from '@/components/requests/RequestQueue';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';


export default function StaffPage() {
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [previousRequestCount, setPreviousRequestCount] = useState(0);
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [isPlayingAlarm, setIsPlayingAlarm] = useState(false);
  const { toast } = useToast();
  const router = useRouter();



  // Function to play notification sound for exactly 5 seconds - SIMPLIFIED VERSION
  const playNotificationSound = () => {
    if (isPlayingAlarm) {
      console.log('🔇 Alarm already playing, skipping');
      return;
    }

    setIsPlayingAlarm(true);
    console.log('🔊 Starting 5-second alarm for new delivery request');

    try {
      // Use Web Audio API for reliable cross-browser beeping
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a sequence of beeps for 5 seconds
      const frequency = 800; // Hz
      const beepDuration = 0.2; // 200ms beep
      const pauseDuration = 0.3; // 300ms pause
      const totalDuration = 5; // 5 seconds total
      
      let currentTime = audioContext.currentTime;
      const endTime = currentTime + totalDuration;
      
      // Generate beeps until 5 seconds is reached
      while (currentTime < endTime) {
        // Create oscillator for this beep
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, currentTime);
        oscillator.type = 'sine';
        
        // Set volume envelope
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0.5, currentTime + beepDuration - 0.01);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + beepDuration);
        
        // Start and stop the beep
        oscillator.start(currentTime);
        oscillator.stop(currentTime + beepDuration);
        
        // Move to next beep time
        currentTime += beepDuration + pauseDuration;
      }
      
    } catch (error) {
      console.warn('Web Audio API failed, falling back to simple approach:', error);
      
      // Fallback: Use simple alert-like approach
      let beepCount = 0;
      const maxBeeps = 10;
      
      const playSimpleBeep = () => {
        if (beepCount >= maxBeeps || !isPlayingAlarm) return;
        
        // Create a short beep using base64 audio
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhCSuByO/efy8TLHrP8dZeLhJFme7hd0wKFVew6eimUSQMUrPn5al4KhxGme/nhnASJ3nA7+OVQw4NV6nn6a5VHBFHmenm');
        audio.volume = 0.7;
        audio.play().catch(() => console.log('Audio play failed'));
        
        beepCount++;
        if (beepCount < maxBeeps && isPlayingAlarm) {
          setTimeout(playSimpleBeep, 500);
        }
      };
      
      playSimpleBeep();
    }
    
    // GUARANTEED stop after exactly 5 seconds
    setTimeout(() => {
      setIsPlayingAlarm(false);
      console.log('🔇 5-second alarm completed - FORCE STOPPED');
    }, 5000);
  };

  // Initialize audio context on user interaction (required by browsers)
  useEffect(() => {
    const enableAudio = async () => {
      try {
        // Create and resume AudioContext on any user interaction
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('🔊 Audio context enabled');
        }
      } catch (error) {
        console.log('Audio context setup failed:', error);
      }
    };

    // Listen for user interactions to enable audio
    const events = ['click', 'touchstart', 'keydown'];
    const handler = () => {
      enableAudio();
      // Remove listeners after first interaction
      events.forEach(event => {
        document.removeEventListener(event, handler);
      });
    };

    events.forEach(event => {
      document.addEventListener(event, handler);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handler);
      });
    };
  }, []);

  // Check staff authentication
  useEffect(() => {
    const checkAuth = () => {
      try {
        // Check for regular staff session
        const authSession = localStorage.getItem('paani_auth_session');
        
        // Check for admin staff access
        const adminStaffAccess = localStorage.getItem('admin_staff_access');
        const adminSession = localStorage.getItem('paani_auth_session');
        
        let isAuthenticated = false;
        let userInfo = null;
        
        // Regular staff user authentication
        if (authSession) {
          const session = JSON.parse(authSession);
          if (session.userType === 'staff' && session.email === 'staff@paani.com') {
            userInfo = {
              uid: session.sessionId,
              email: session.email,
              userType: session.userType,
              loginTime: session.loginTime
            };
            isAuthenticated = true;
            console.log('✅ Staff user authentication verified');
          }
        }
        
        // Admin with staff access authentication
        if (!isAuthenticated && adminStaffAccess && adminSession) {
          const staffAccess = JSON.parse(adminStaffAccess);
          const adminAuth = JSON.parse(adminSession);
          
          // Verify admin has valid session and staff access
          if (adminAuth.userType === 'admin' && adminAuth.email === 'admin@paani.com' && staffAccess.sessionId) {
            userInfo = {
              uid: staffAccess.sessionId,
              email: `${adminAuth.email} (Staff Access)`,
              userType: 'admin_staff',
              loginTime: adminAuth.loginTime,
              staffAccessGranted: staffAccess.grantedAt
            };
            isAuthenticated = true;
            console.log('✅ Admin staff access verified');
          }
        }
        
        if (isAuthenticated && userInfo) {
          setAuthUser(userInfo);
        } else {
          // No valid authentication, redirect to login
          console.log('❌ No valid staff authentication found, redirecting to login');
          router.push('/staff/login');
        }
      } catch (error) {
        console.error('Staff auth check error:', error);
        router.push('/staff/login');
      }
    };

    checkAuth();
  }, [router]);

  const handleSignOut = () => {
    try {
      if (authUser?.userType === 'admin_staff') {
        // Admin with staff access - only clear staff access, keep admin session
        localStorage.removeItem('admin_staff_access');
        console.log('✅ Admin staff access revoked, returning to admin dashboard');
        
        // Close current window and return to admin dashboard
        window.close();
      } else {
        // Regular staff user - clear staff session
        localStorage.removeItem('paani_auth_session');
        console.log('✅ Staff signed out successfully');
        
        // Redirect to login page
        router.push('/staff/login');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Error signing out. Please try again.');
    }
  };

  useEffect(() => {
    // Check backend connection
    const checkBackendConnection = async () => {
      try {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.HEALTH), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        setIsBackendConnected(response.ok);
      } catch (err) {
        console.error('Backend connection error:', err);
        setIsBackendConnected(false);
      }
    };

    checkBackendConnection();
    const interval = setInterval(checkBackendConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Function to fetch delivery requests
    const fetchDeliveryRequests = async () => {
      try {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS));
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        
        // Check for new delivery requests (only pending/pending_confirmation)
        const currentPendingRequests = data.filter((req: DeliveryRequest) => 
          req.status === 'pending' || req.status === 'pending_confirmation'
        );
        const currentPendingCount = currentPendingRequests.length;
        
        console.log(`📊 Request count check - Previous: ${previousRequestCount}, Current: ${currentPendingCount}, Total requests: ${data.length}`);
        
        // Play sound if there are new pending requests (not on initial load and not already playing)
        if (previousRequestCount >= 0 && currentPendingCount > previousRequestCount && !isPlayingAlarm) {
          console.log(`🔔 NEW DELIVERY REQUEST DETECTED! Previous: ${previousRequestCount}, Current: ${currentPendingCount}`);
          
          // Play notification sound only once
          playNotificationSound();
        }
        
        // Update previous count after processing
        setPreviousRequestCount(currentPendingCount);
        setDeliveryRequests(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching delivery requests:', err);
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Unable to fetch delivery requests. Check if backend is running.",
        });
      }
    };

    // Initial fetch
    setIsLoading(true);
    fetchDeliveryRequests();

    // Initialize previous count after first successful fetch
    let initializationAttempts = 0;
    const initializePreviousCount = () => {
      if (deliveryRequests.length > 0 || initializationAttempts >= 3) {
        const currentRequests = deliveryRequests.filter(req => 
          req.status === 'pending' || req.status === 'pending_confirmation'
        );
        setPreviousRequestCount(currentRequests.length);
        console.log('📊 Initial pending request count set to:', currentRequests.length);
      } else {
        initializationAttempts++;
        setTimeout(initializePreviousCount, 2000);
      }
    };
    
    setTimeout(initializePreviousCount, 3000);

    // Set up real-time updates every 3 seconds
    const interval = setInterval(() => {
      fetchDeliveryRequests();
    }, 3000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [toast]);

  const handleMarkAsDone = async (requestId: string) => {
    try {
      const currentRequest = deliveryRequests.find(req => (req._id || req.requestId) === requestId);
      if (!currentRequest) return;

      let newStatus = 'delivered';
      if (currentRequest.status === 'pending' || currentRequest.status === 'pending_confirmation') {
        newStatus = 'processing';
      } else if (currentRequest.status === 'processing') {
        newStatus = 'delivered';
      }

      const actualRequestId = currentRequest._id || currentRequest.requestId;
      const response = await fetch(buildApiUrl(`api/delivery-requests/${actualRequestId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updatedRequest = await response.json();
        setDeliveryRequests(prev => prev.map(req => 
          (req._id || req.requestId) === requestId ? { ...req, ...updatedRequest } : req
        ));
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error("Error updating request status:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not update the request status. Please try again.",
      });
    }
  };



  if (isLoading || !authUser) {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header title="Staff Delivery Interface" />
            <main className="flex-grow p-4 md:p-8">
                <Skeleton className="h-24 w-full mb-6 bg-muted/50" /> 
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="bg-card shadow-md">
                            <CardHeader><Skeleton className="h-6 w-3/4 bg-muted/50" /></CardHeader>
                            <CardContent><Skeleton className="h-16 w-full bg-muted/50" /></CardContent>
                        </Card>
                    ))}
                </div>
            </main>
            <div className="p-4 border-t border-[hsl(var(--border))]/20 bg-background/30">
              <Skeleton className="h-10 w-32 mx-auto bg-muted/50" />
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-grow">
        {!isBackendConnected && (
          <div className="mx-4 mt-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">⚠️ Backend server is not connected</p>
                <p className="text-xs mt-1">
                  Make sure the backend is running on port 4000. 
                  <a href={buildApiUrl(API_ENDPOINTS.HEALTH)} target="_blank" rel="noopener noreferrer" className="underline ml-1">
                    Test backend health
                  </a>
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
                className="ml-4 text-yellow-700 border-yellow-400 hover:bg-yellow-200"
              >
                Retry Connection
              </Button>
            </div>
          </div>
        )}
        <StaffDashboardMetrics requests={deliveryRequests} /> 
        <RequestQueue requests={deliveryRequests} onMarkAsDone={handleMarkAsDone} />
      </main>
      
      {/* Bottom Sign Out Button */}
      <div className="p-4 border-t border-[hsl(var(--border))]/20 bg-background/30 flex justify-center">
        <Button 
          variant="outline" 
          onClick={handleSignOut} 
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {authUser?.userType === 'admin_staff' ? 'Close Staff Access' : 'Sign Out'}
        </Button>
      </div>
    </div>
  );
}

