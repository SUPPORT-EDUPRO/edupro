/**
 * Start Live Lesson (React Native)
 * 
 * Component for teachers to start group video lessons using Daily.co React Native SDK.
 * Matches web functionality but optimized for native mobile experience.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Class {
  id: string;
  name: string;
  grade_level: string;
}

interface ExistingCall {
  id: string;
  meetingUrl: string;
  title: string;
  className: string;
  classId: string | null;
  startedAt: string;
}

interface StartLiveLessonProps {
  preschoolId: string;
  teacherId: string;
  teacherName: string;
  subscriptionTier?: string;
}

// Duration limits by subscription tier
const TIER_LIMITS = {
  free: { minutes: 15, label: '15 min', badge: 'Free', badgeColor: '#6b7280' },
  starter: { minutes: 30, label: '30 min', badge: 'Starter', badgeColor: '#3b82f6' },
  premium: { minutes: 60, label: '1 hour', badge: 'Premium', badgeColor: '#ec4899' },
  pro: { minutes: 60, label: '1 hour', badge: 'Pro', badgeColor: '#f97316' },
  enterprise: { minutes: 0, label: 'Unlimited', badge: 'Enterprise', badgeColor: '#10b981' },
};

export function StartLiveLesson({
  preschoolId,
  teacherId,
  teacherName,
  subscriptionTier = 'starter',
}: StartLiveLessonProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingCall, setExistingCall] = useState<ExistingCall | null>(null);

  const tierLimit = TIER_LIMITS[subscriptionTier as keyof typeof TIER_LIMITS] || TIER_LIMITS.starter;

  // Check for existing live call
  useEffect(() => {
    const checkExistingCall = async () => {
      const now = new Date().toISOString();

      try {
        // Clean up expired calls
        await supabase
          .from('video_calls')
          .update({ status: 'ended', actual_end: now })
          .eq('teacher_id', teacherId)
          .eq('status', 'live')
          .lt('scheduled_end', now);

        // Check for active call
        const { data: liveCall } = await supabase
          .from('video_calls')
          .select(`
            id,
            meeting_id,
            meeting_url,
            title,
            class_id,
            actual_start,
            scheduled_end,
            classes:class_id (name)
          `)
          .eq('teacher_id', teacherId)
          .eq('status', 'live')
          .order('actual_start', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (liveCall && liveCall.meeting_url) {
          if (liveCall.scheduled_end && new Date(liveCall.scheduled_end) < new Date()) {
            await supabase
              .from('video_calls')
              .update({ status: 'ended', actual_end: now })
              .eq('id', liveCall.id);
            setExistingCall(null);
            return;
          }

          setExistingCall({
            id: liveCall.id,
            meetingUrl: liveCall.meeting_url,
            title: liveCall.title || 'Live Lesson',
            className: (liveCall.classes as any)?.name || 'Class',
            classId: liveCall.class_id,
            startedAt: liveCall.actual_start,
          });
        }
      } catch (err) {
        console.warn('[StartLiveLesson] Error checking existing call:', err);
      }
    };

    checkExistingCall();
    const interval = setInterval(checkExistingCall, 30000);
    return () => clearInterval(interval);
  }, [teacherId]);

  // Fetch teacher's classes
  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .eq('preschool_id', preschoolId)
        .eq('teacher_id', teacherId)
        .order('name');

      if (data) setClasses(data);
      setLoading(false);
    };

    fetchClasses();
  }, [preschoolId, teacherId]);

  // Start new lesson
  const handleStartLesson = useCallback(async () => {
    if (!selectedClass) {
      Alert.alert('Select Class', 'Please select a class to start the lesson.');
      return;
    }

    setIsCreating(true);

    try {
      const now = new Date();
      const durationMinutes = tierLimit.minutes || 1440; // 24 hours for unlimited
      const scheduledEnd = new Date(now.getTime() + durationMinutes * 60000);

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Please sign in to start a lesson.');
      }

      // Create Daily.co room via Edge Function
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/daily-rooms`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name: `lesson-${Date.now()}`,
            isPrivate: false,
            expiryMinutes: durationMinutes,
            maxParticipants: 50,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create lesson room');
      }

      const { room } = await response.json();

      // Create video_calls record
      const { data: callData, error } = await supabase
        .from('video_calls')
        .insert({
          title: lessonTitle || `${teacherName}'s Lesson`,
          class_id: selectedClass,
          preschool_id: preschoolId,
          teacher_id: teacherId,
          meeting_id: room.id,
          meeting_url: room.url,
          status: 'live',
          scheduled_start: now.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          actual_start: now.toISOString(),
          max_participants: 50,
        })
        .select()
        .single();

      if (error) throw error;

      Alert.alert(
        'Lesson Started',
        'Your live lesson has been created. Students can now join.',
        [{ text: 'OK' }]
      );

      // TODO: Navigate to lesson interface
      // For now, just refresh the existing call state
      const selectedClassData = classes.find(c => c.id === selectedClass);
      setExistingCall({
        id: callData.id,
        meetingUrl: room.url,
        title: lessonTitle || `${teacherName}'s Lesson`,
        className: selectedClassData?.name || 'Class',
        classId: selectedClass,
        startedAt: now.toISOString(),
      });

      setLessonTitle('');
      setSelectedClass(null);
    } catch (err) {
      console.error('[StartLiveLesson] Error:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start lesson');
    } finally {
      setIsCreating(false);
    }
  }, [selectedClass, lessonTitle, teacherId, teacherName, preschoolId, classes, tierLimit]);

  // End existing lesson
  const handleEndLesson = useCallback(async () => {
    if (!existingCall) return;

    Alert.alert(
      'End Lesson',
      'Are you sure you want to end this lesson? All participants will be disconnected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Lesson',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('video_calls')
                .update({ status: 'ended', actual_end: new Date().toISOString() })
                .eq('id', existingCall.id);

              setExistingCall(null);
              Alert.alert('Success', 'Lesson ended successfully');
            } catch (err) {
              Alert.alert('Error', 'Failed to end lesson');
            }
          },
        },
      ]
    );
  }, [existingCall]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Show existing lesson
  if (existingCall) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE NOW</Text>
          </View>

          <Text style={styles.lessonTitle}>{existingCall.title}</Text>
          <Text style={styles.className}>{existingCall.className}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>
              Started {new Date(existingCall.startedAt).toLocaleTimeString()}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.joinButton} onPress={() => {
              // TODO: Navigate to lesson interface with existingCall.meetingUrl
              Alert.alert('Rejoin Lesson', 'Lesson interface coming soon!');
            }}>
              <Ionicons name="videocam" size={20} color="white" />
              <Text style={styles.joinButtonText}>Rejoin Lesson</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.endButton} onPress={handleEndLesson}>
              <Ionicons name="stop-circle" size={20} color="#ef4444" />
              <Text style={styles.endButtonText}>End Lesson</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Show create lesson form
  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Start Live Lesson</Text>
        <Text style={styles.subtitle}>
          Duration Limit: {tierLimit.label} ({tierLimit.badge})
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Lesson Title (Optional)</Text>
          <Text style={styles.input} onPress={() => {
            // TODO: Add TextInput modal
            Alert.prompt('Lesson Title', 'Enter a title for your lesson', (text) => {
              setLessonTitle(text);
            });
          }}>
            {lessonTitle || 'Tap to set title'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Select Class *</Text>
          {classes.length === 0 ? (
            <Text style={styles.emptyText}>No classes found</Text>
          ) : (
            <FlatList
              data={classes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.classItem,
                    selectedClass === item.id && styles.classItemSelected,
                  ]}
                  onPress={() => setSelectedClass(item.id)}
                >
                  <View style={styles.classInfo}>
                    <Text style={styles.className}>{item.name}</Text>
                    <Text style={styles.gradeLevel}>{item.grade_level}</Text>
                  </View>
                  {selectedClass === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        <TouchableOpacity
          style={[styles.startButton, !selectedClass && styles.startButtonDisabled]}
          onPress={handleStartLesson}
          disabled={!selectedClass || isCreating}
        >
          {isCreating ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="videocam" size={24} color="white" />
              <Text style={styles.startButtonText}>Start Lesson</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 16,
    color: '#111827',
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 8,
  },
  classItemSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  gradeLevel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    padding: 20,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  startButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
    letterSpacing: 1,
  },
  lessonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  joinButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  endButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  endButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
});
