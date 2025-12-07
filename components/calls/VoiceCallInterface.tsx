/**
 * Voice Call Interface (React Native)
 * 
 * Audio-only call interface using Daily.co React Native SDK.
 * Provides controls for mute, speaker, and end call.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import type { CallState } from './types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Conditionally import InCallManager (may not be available in some environments)
let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch (error) {
  console.warn('[VoiceCall] InCallManager not available:', error);
}

// Note: Daily.co React Native SDK is conditionally imported
// This allows the app to build even without the native module
let Daily: any = null;
try {
  Daily = require('@daily-co/react-native-daily-js').default;
} catch (error) {
  console.warn('[VoiceCall] Daily.co SDK not available:', error);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VoiceCallInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
  userName?: string;
  isOwner?: boolean;
  calleeId?: string;
  callId?: string;
  meetingUrl?: string;
  onCallStateChange?: (state: CallState) => void;
}

export function VoiceCallInterface({
  isOpen,
  onClose,
  roomName,
  userName = 'User',
  isOwner = false,
  calleeId,
  callId,
  meetingUrl,
  onCallStateChange,
}: VoiceCallInterfaceProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false); // Start with earpiece
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [callDuration, setCallDuration] = useState(0);

  const dailyRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(callId || null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringbackSoundRef = useRef<Audio.Sound | null>(null);

  // Update callIdRef when prop changes
  useEffect(() => {
    if (callId && !callIdRef.current) {
      callIdRef.current = callId;
    }
  }, [callId]);

  // Notify parent of state changes
  useEffect(() => {
    onCallStateChange?.(callState);
  }, [callState, onCallStateChange]);

  // Fade animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen, fadeAnim]);

  // Pulsing animation for ringing state
  useEffect(() => {
    if (callState === 'connecting' || callState === 'ringing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callState, pulseAnim]);

  // Ringback tone for outgoing calls
  useEffect(() => {
    const playRingback = async () => {
      if ((callState === 'connecting' || callState === 'ringing') && isOwner) {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
          });

          const { sound } = await Audio.Sound.createAsync(
            require('@/assets/sounds/ringback.mp3'),
            { isLooping: true, volume: 0.5 }
          );
          ringbackSoundRef.current = sound;
          await sound.playAsync();
        } catch (error) {
          console.warn('[VoiceCall] Failed to play ringback tone:', error);
        }
      } else {
        // Stop ringback when connected or ended
        if (ringbackSoundRef.current) {
          try {
            await ringbackSoundRef.current.stopAsync();
            await ringbackSoundRef.current.unloadAsync();
          } catch (error) {
            console.warn('[VoiceCall] Failed to stop ringback:', error);
          }
          ringbackSoundRef.current = null;
        }
      }
    };

    playRingback();

    return () => {
      if (ringbackSoundRef.current) {
        ringbackSoundRef.current.stopAsync().catch(() => {});
        ringbackSoundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [callState, isOwner]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected' && participantCount > 1) {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callState, participantCount]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Listen for call status changes (other party hung up)
  useEffect(() => {
    if (!callIdRef.current || callState === 'ended') return;

    const currentCallId = callIdRef.current;

    const channel = supabase
      .channel(`voice-status-${currentCallId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_calls',
          filter: `call_id=eq.${currentCallId}`,
        },
        (payload: { new: { status: string } }) => {
          const newStatus = payload.new?.status;
          console.log('[VoiceCall] Status changed:', newStatus);
          if (['ended', 'rejected', 'missed'].includes(newStatus)) {
            cleanupCall();
            setCallState('ended');
            onClose();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callState, onClose]);

  // Cleanup call resources
  const cleanupCall = useCallback(() => {
    if (dailyRef.current) {
      try {
        dailyRef.current.leave();
        dailyRef.current.destroy();
      } catch (err) {
        console.warn('[VoiceCall] Cleanup error:', err);
      }
      dailyRef.current = null;
    }
    
    // Stop InCallManager
    try {
      if (InCallManager) {
        InCallManager.stop();
      }
    } catch (err) {
      console.warn('[VoiceCall] InCallManager stop error:', err);
    }
    
    // Stop ringback sound
    if (ringbackSoundRef.current) {
      ringbackSoundRef.current.stopAsync().catch(() => {});
      ringbackSoundRef.current.unloadAsync().catch(() => {});
      ringbackSoundRef.current = null;
    }
  }, []);

  // Initialize call
  useEffect(() => {
    if (!isOpen) return;
    if (!Daily) {
      setError('Video calls require a development build. Please rebuild the app.');
      setCallState('failed');
      return;
    }

    let isCleanedUp = false;

    const initializeCall = async () => {
      try {
        setCallState('connecting');
        setError(null);
        setCallDuration(0);

        // Get valid session token first - always try to refresh for calls
        console.log('[VoiceCall] Getting session...');
        let { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        let accessToken = sessionData.session?.access_token;
        
        // Always attempt refresh for calls to ensure fresh token
        console.log('[VoiceCall] Refreshing session to ensure valid token...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshData?.session?.access_token) {
          accessToken = refreshData.session.access_token;
          sessionData = refreshData;
          console.log('[VoiceCall] Session refreshed successfully');
        } else if (!accessToken) {
          // Only fail if we have no token at all
          console.warn('[VoiceCall] No valid session:', refreshError || sessionError);
          throw new Error('Please sign in to make calls.');
        } else {
          console.log('[VoiceCall] Using existing session token');
        }

        const user = sessionData.session?.user;
        if (!user) {
          throw new Error('Please sign in to make calls.');
        }

        console.log('[VoiceCall] Creating room with auth token...');
        console.log('[VoiceCall] User ID:', user.id);

        if (isCleanedUp) return;

        // Cleanup existing instance
        cleanupCall();

        let roomUrl = meetingUrl;

        if (isOwner && !roomUrl) {
          // Create a new room via API
          console.log('[VoiceCall] Creating room via Edge Function...');
          console.log('[VoiceCall] URL:', `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/daily-rooms`);
          console.log('[VoiceCall] Has access token:', !!accessToken);
          
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/daily-rooms`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                name: `voice-${Date.now()}`,
                isPrivate: true,
                expiryMinutes: 60,
                maxParticipants: 2,
              }),
            }
          );

          console.log('[VoiceCall] Room creation response status:', response.status);
          
          if (!response.ok) {
            let errorMsg = 'Failed to create room';
            try {
              const errorData = await response.json();
              errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) {
              errorMsg = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`;
            }
            console.warn('[VoiceCall] Room creation failed:', errorMsg);
            throw new Error(errorMsg);
          }

          const { room } = await response.json();
          roomUrl = room.url;
          console.log('[VoiceCall] Room created successfully:', roomUrl);

          // Create call signaling record
          if (calleeId) {
            const newCallId = uuidv4(); // Generate proper UUID
            callIdRef.current = newCallId;

            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user.id)
              .single();

            const callerName = callerProfile
              ? `${callerProfile.first_name || ''} ${callerProfile.last_name || ''}`.trim() ||
                'Someone'
              : 'Someone';

            await supabase.from('active_calls').insert({
              call_id: newCallId,
              caller_id: user.id,
              callee_id: calleeId,
              call_type: 'voice',
              status: 'ringing',
              caller_name: callerName,
              meeting_url: roomUrl,
            });

            await supabase.from('call_signals').insert({
              call_id: newCallId,
              from_user_id: user.id,
              to_user_id: calleeId,
              signal_type: 'offer',
              payload: {
                meeting_url: roomUrl,
                call_type: 'voice',
                caller_name: callerName,
              },
            });

            setCallState('ringing');
          }
        }

        if (!roomUrl) {
          throw new Error('No room URL available');
        }

        if (isCleanedUp) return;

        // Create Daily call object (no token needed for non-private rooms)
        console.log('[VoiceCall] Creating Daily call object...');
        const daily = Daily.createCallObject({
          audioSource: true,
          videoSource: false,
        });

        dailyRef.current = daily;

        // Initialize InCallManager for proper audio routing (if available)
        try {
          if (InCallManager) {
            InCallManager.start({ media: 'audio', ringback: '' }); // Empty ringback since we handle it ourselves
            InCallManager.setForceSpeakerphoneOn(false); // Start with earpiece
          }
        } catch (error) {
          console.warn('[VoiceCall] Failed to start InCallManager:', error);
        }

        // Event listeners
        daily.on('joined-meeting', () => {
          console.log('[VoiceCall] Joined meeting');
          setCallState('connected');
          updateParticipantCount();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        });

        daily.on('left-meeting', () => {
          console.log('[VoiceCall] Left meeting');
          setCallState('ended');
          try {
            if (InCallManager) InCallManager.stop();
          } catch (error) {
            console.warn('[VoiceCall] Failed to stop InCallManager:', error);
          }
        });

        daily.on('participant-joined', () => {
          console.log('[VoiceCall] Participant joined');
          updateParticipantCount();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        });

        daily.on('participant-left', () => {
          console.log('[VoiceCall] Participant left');
          updateParticipantCount();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        });

        daily.on('error', (event: any) => {
          const errorMsg = event?.errorMsg || event?.error || 'Unknown error';
          
          // Map technical errors to user-friendly messages
          let userFriendlyError = errorMsg;
          if (errorMsg.includes('network') || errorMsg.includes('connection')) {
            userFriendlyError = 'Connection failed. Please check your internet connection.';
          } else if (errorMsg.includes('permission') || errorMsg.includes('camera') || errorMsg.includes('microphone')) {
            userFriendlyError = 'Microphone permission denied. Please enable it in settings.';
          } else if (errorMsg.includes('timeout')) {
            userFriendlyError = 'Connection timeout. Please try again.';
          } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
            userFriendlyError = 'Call room not found. The call may have ended.';
          }
          
          setError(userFriendlyError);
          setCallState('failed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        });

        // Join the call (no token needed for rooms created with enable_knocking: false)
        console.log('[VoiceCall] Joining room:', roomUrl);
        await daily.join({
          url: roomUrl,
        });

        function updateParticipantCount() {
          if (dailyRef.current) {
            const participants = dailyRef.current.participants();
            setParticipantCount(Object.keys(participants).length);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to start call';
        
        // Map common errors to user-friendly messages
        let userFriendlyError = errorMsg;
        if (errorMsg.includes('network') || errorMsg.includes('failed to fetch')) {
          userFriendlyError = 'No internet connection. Please check your network and try again.';
        } else if (errorMsg.includes('timeout')) {
          userFriendlyError = 'Connection timeout. The other person may be offline.';
        } else if (errorMsg.includes('No room URL')) {
          userFriendlyError = 'Failed to create call room. Please try again.';
        }
        
        setError(userFriendlyError);
        setCallState('failed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    };

    initializeCall();

    return () => {
      isCleanedUp = true;
      cleanupCall();
    };
  }, [isOpen, meetingUrl, userName, isOwner, calleeId, cleanupCall]);

  // Toggle microphone
  const toggleAudio = useCallback(async () => {
    if (!dailyRef.current) return;
    try {
      await dailyRef.current.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (err) {
      console.warn('[VoiceCall] Toggle audio error:', err);
    }
  }, [isAudioEnabled]);

  // Toggle speaker (using InCallManager for proper audio routing)
  const toggleSpeaker = useCallback(() => {
    const newSpeakerState = !isSpeakerEnabled;
    setIsSpeakerEnabled(newSpeakerState);
    
    try {
      if (InCallManager) {
        InCallManager.setForceSpeakerphoneOn(newSpeakerState);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    } catch (error) {
      console.warn('[VoiceCall] Failed to toggle speaker:', error);
    }
  }, [isSpeakerEnabled]);

  // End call
  const handleEndCall = useCallback(async () => {
    console.log('[VoiceCall] Ending call');

    // Update call status
    if (callIdRef.current) {
      const { error } = await supabase
        .from('active_calls')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('call_id', callIdRef.current);
      
      if (error) {
        console.warn('[VoiceCall] Failed to update call status:', error);
      }
    }

    cleanupCall();
    setCallState('ended');
    onClose();
  }, [cleanupCall, onClose]);

  // Retry call (only shown when call failed or was not answered)
  const handleRetryCall = useCallback(async () => {
    console.log('[VoiceCall] Retrying call');
    
    // Reset state
    setError(null);
    setCallState('idle');
    setParticipantCount(0);
    setCallDuration(0);
    
    // Close and let parent component handle retry
    onClose();
  }, [onClose]);

  // Minimize call
  const handleMinimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  // Maximize call
  const handleMaximize = useCallback(() => {
    setIsMinimized(false);
  }, []);

  if (!isOpen) return null;

  // Minimized view
  if (isMinimized) {
    return (
      <TouchableOpacity
        style={styles.minimizedContainer}
        onPress={handleMaximize}
        activeOpacity={0.9}
      >
        <View style={styles.minimizedContent}>
          <Ionicons name="call" size={20} color="#ffffff" />
          <Text style={styles.minimizedText}>{formatDuration(callDuration)}</Text>
          <TouchableOpacity onPress={handleEndCall}>
            <Ionicons name="close-circle" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // Full view
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <BlurView intensity={90} style={styles.blurView} tint="dark">
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleMinimize} style={styles.minimizeButton}>
              <Ionicons name="chevron-down" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Voice Call</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Call Info */}
          <View style={styles.callInfo}>
            <Animated.View style={[styles.avatar, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="person" size={48} color="#ffffff" />
            </Animated.View>
            <Text style={styles.callerName}>{userName}</Text>
            <View style={styles.statusContainer}>
              {(callState === 'connecting' || callState === 'ringing') && (
                <ActivityIndicator size="small" color="#10b981" style={{ marginRight: 8 }} />
              )}
              <Text style={[
                styles.callStatus,
                callState === 'failed' && styles.callStatusError,
                callState === 'connected' && styles.callStatusConnected,
              ]}>
                {callState === 'connecting' && 'Connecting...'}
                {callState === 'ringing' && 'Ringing...'}
                {callState === 'connected' && formatDuration(callDuration)}
                {callState === 'failed' && 'Call Failed'}
                {callState === 'ended' && 'Call Ended'}
              </Text>
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            {/* Mute */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                !isAudioEnabled && styles.controlButtonActive,
              ]}
              onPress={toggleAudio}
            >
              <Ionicons
                name={isAudioEnabled ? 'mic' : 'mic-off'}
                size={28}
                color="#ffffff"
              />
              <Text style={styles.controlLabel}>
                {isAudioEnabled ? 'Mute' : 'Unmute'}
              </Text>
            </TouchableOpacity>

            {/* Speaker */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                isSpeakerEnabled && styles.controlButtonActive,
              ]}
              onPress={toggleSpeaker}
            >
              <Ionicons
                name={isSpeakerEnabled ? 'volume-high' : 'volume-mute'}
                size={28}
                color="#ffffff"
              />
              <Text style={styles.controlLabel}>Speaker</Text>
            </TouchableOpacity>

            {/* End Call or Call Again */}
            {(callState === 'failed' || (callState === 'ended' && participantCount === 0)) ? (
              <TouchableOpacity
                style={[styles.controlButton, styles.retryCallButton]}
                onPress={handleRetryCall}
              >
                <Ionicons name="call" size={28} color="#ffffff" />
                <Text style={styles.controlLabel}>Call Again</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.controlButton, styles.endCallButton]}
                onPress={handleEndCall}
              >
                <Ionicons name="call" size={28} color="#ffffff" />
                <Text style={styles.controlLabel}>End</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 9999,
  },
  blurView: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  minimizeButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  callInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#00f5ff',
  },
  callerName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callStatus: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  callStatusConnected: {
    color: '#10b981',
    fontWeight: '600',
  },
  callStatusError: {
    color: '#ef4444',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(0, 245, 255, 0.3)',
  },
  endCallButton: {
    backgroundColor: '#ef4444',
  },
  retryCallButton: {
    backgroundColor: '#10b981', // Green for retry
  },
  controlLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  minimizedContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    zIndex: 9998,
    borderRadius: 12,
    overflow: 'hidden',
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00f5ff',
  },
  minimizedText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
});

export default VoiceCallInterface;
