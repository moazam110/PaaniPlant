
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
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Function to create and initialize audio context
  const initializeAudio = async () => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended
      if (context.state === 'suspended') {
        await context.resume();
      }
      
      setAudioContext(context);
      setAudioEnabled(true);
      console.log('✅ Audio context initialized successfully');
      return context;
    } catch (error) {
      console.warn('Failed to initialize audio context:', error);
      return null;
    }
  };

  // Function to play notification sound for 5 seconds
  const playNotificationSound = async () => {
    try {
      let context = audioContext;
      
      // Initialize audio if not already done
      if (!context || context.state === 'closed') {
        context = await initializeAudio();
        if (!context) {
          throw new Error('Could not initialize audio context');
        }
      }
      
      // Ensure context is running
      if (context.state === 'suspended') {
        await context.resume();
      }
      
      if (context.state !== 'running') {
        throw new Error('Audio context not running');
      }
      
      // Play immediate test beep to verify audio works
      const testOsc = context.createOscillator();
      const testGain = context.createGain();
      testOsc.type = 'sine';
      testOsc.frequency.setValueAtTime(800, context.currentTime);
      testGain.gain.setValueAtTime(0.3, context.currentTime);
      testOsc.connect(testGain);
      testGain.connect(context.destination);
      testOsc.start(context.currentTime);
      testOsc.stop(context.currentTime + 0.1);
      
      // Play notification pattern
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          if (context && context.state === 'running') {
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, context.currentTime);
            
            // Set volume envelope
            gainNode.gain.setValueAtTime(0, context.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            oscillator.start(context.currentTime);
            oscillator.stop(context.currentTime + 0.15);
          }
        }, i * 300); // Beep every 300ms
      }
      
      console.log('🔊 Staff notification sound played for new delivery request');
    } catch (error) {
      console.warn('Web Audio API failed, trying fallback:', error);
      
      // Enhanced fallback with multiple audio formats
      try {
        // Create a more audible beep sound
        const audio = new Audio();
        audio.volume = 0.8;
        
        // Try to create a simple beep using data URI
        const sampleRate = 44100;
        const duration = 0.2;
        const frequency = 800;
        const samples = sampleRate * duration;
        const wave = new Array(samples);
        
        for (let i = 0; i < samples; i++) {
          wave[i] = Math.sin(frequency * 2 * Math.PI * i / sampleRate) * 0.3;
        }
        
        // Convert to base64 audio
        const audioData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhCSuByO/efy8TLHrP8dZeLhJFme7hd0wKFVew6eimUSQMUrPn5al4KhxGme/nhnASJ3nA7+OVQw4NV6nn6a5VHBFHmenm'; 
        
        audio.src = audioData;
        audio.play().then(() => {
          console.log('🔊 Fallback audio notification played');
          
          // Play multiple short beeps
          for (let i = 1; i < 4; i++) {
            setTimeout(() => {
              const audioClone = audio.cloneNode() as HTMLAudioElement;
              audioClone.volume = 0.6;
              audioClone.play().catch(() => {});
            }, i * 400);
          }
        }).catch(() => {
          console.warn('All audio methods failed');
          
          // Last resort: try to use system notification API
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🔔 New Delivery Request!', {
              body: 'A new delivery request has been received.',
              icon: '/favicon.ico',
              tag: 'delivery-request'
            });
          }
        });
      } catch {
        console.warn('All notification methods failed');
      }
    }
  };

  // Enable audio context on first user interaction
  useEffect(() => {
    const enableAudio = async () => {
      if (audioEnabled) return; // Already enabled
      
      try {
        await initializeAudio();
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            console.log('Notification permission:', permission);
          });
        }
        
                 // Test audio capability with a brief quiet tone (no full notification)
         setTimeout(() => {
           console.log('🔊 Testing audio capability...');
           if (audioContext && audioContext.state === 'running') {
             const testOsc = audioContext.createOscillator();
             const testGain = audioContext.createGain();
             testOsc.type = 'sine';
             testOsc.frequency.setValueAtTime(440, audioContext.currentTime);
             testGain.gain.setValueAtTime(0.1, audioContext.currentTime); // Very quiet test
             testOsc.connect(testGain);
             testGain.connect(audioContext.destination);
             testOsc.start(audioContext.currentTime);
             testOsc.stop(audioContext.currentTime + 0.1);
             console.log('✅ Audio test completed');
           }
         }, 100);
        
      } catch (error) {
        console.warn('Could not enable audio:', error);
      }
    };

    // Enable audio on various user interactions
    const events = ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown'];
    events.forEach(eventType => {
      document.addEventListener(eventType, enableAudio, { once: true });
    });

    // Also try to initialize on page load after a delay
    const timeoutId = setTimeout(() => {
      if (!audioEnabled) {
        console.log('🔊 Auto-initializing audio...');
        initializeAudio().catch(console.warn);
      }
    }, 2000);

    return () => {
      events.forEach(eventType => {
        document.removeEventListener(eventType, enableAudio);
      });
      clearTimeout(timeoutId);
    };
  }, [audioEnabled]);

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
        
        // Play sound if there are new pending requests (not on initial load)
        if (previousRequestCount >= 0 && currentPendingCount > previousRequestCount) {
          console.log(`🔔 NEW DELIVERY REQUEST DETECTED! Previous: ${previousRequestCount}, Current: ${currentPendingCount}`);
          console.log('🔊 Attempting to play notification sound...');
          
          // Play notification sound with retries
          const playWithRetry = async (attempts: number = 3) => {
            for (let i = 0; i < attempts; i++) {
              try {
                await playNotificationSound();
                console.log('✅ Notification sound played successfully');
                break;
              } catch (error) {
                console.warn(`🔇 Sound attempt ${i + 1} failed:`, error);
                if (i === attempts - 1) {
                  console.error('🔇 All sound attempts failed');
                  
                  // Show browser notification as fallback
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('🔔 New Delivery Request!', {
                      body: `${currentPendingCount - previousRequestCount} new request(s) received`,
                      icon: '/favicon.ico',
                      tag: 'new-delivery-request',
                      requireInteraction: true
                    });
                  }
                }
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
              }
            }
          };
          
          playWithRetry();
          
          // Show visual notification as well
          toast({
            title: "🔔 New Delivery Request!",
            description: `${currentPendingCount - previousRequestCount} new request(s) received`,
            duration: 5000,
          });
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
        <StaffDashboardMetrics requests={deliveryRequests} audioEnabled={audioEnabled} /> 
        <RequestQueue requests={deliveryRequests} onMarkAsDone={handleMarkAsDone} />
      </main>
      
      {/* Bottom Controls */}
      <div className="p-4 border-t border-[hsl(var(--border))]/20 bg-background/30 flex justify-center gap-3">
        <Button 
          variant="outline" 
          onClick={() => {
            console.log('🔊 Manual sound test triggered');
            playNotificationSound().catch(error => {
              console.warn('Manual sound test failed:', error);
              toast({
                variant: "destructive",
                title: "Sound Test Failed",
                description: "Please click anywhere on the page first to enable audio.",
              });
            });
          }}
          className="border-green-500 text-green-600 hover:bg-green-50 rounded-lg"
          title="Test notification sound"
        >
          🔊 Test Sound
        </Button>
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

