/**
 * Start Live Lesson (React Native)
 * 
 * Component for teachers to start group video lessons using Daily.co React Native SDK.
 * Feature parity with PWA: scheduling, duration selector, reminders, dark mode support.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Modal,
  useColorScheme,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  student_count?: number;
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

// Tier-based time limits in minutes
const TIER_TIME_LIMITS: Record<string, { minutes: number; label: string; badge: string; badgeColor: string }> = {
  free: { minutes: 15, label: '15 min', badge: 'Free', badgeColor: '#6b7280' },
  starter: { minutes: 30, label: '30 min', badge: 'Starter', badgeColor: '#3b82f6' },
  school_starter: { minutes: 30, label: '30 min', badge: 'School Starter', badgeColor: '#3b82f6' },
  basic: { minutes: 60, label: '1 hour', badge: 'Basic', badgeColor: '#8b5cf6' },
  premium: { minutes: 60, label: '1 hour', badge: 'Premium', badgeColor: '#ec4899' },
  school_premium: { minutes: 90, label: '1.5 hours', badge: 'School Premium', badgeColor: '#ec4899' },
  pro: { minutes: 60, label: '1 hour', badge: 'Pro', badgeColor: '#f97316' },
  school_pro: { minutes: 120, label: '2 hours', badge: 'School Pro', badgeColor: '#f97316' },
  enterprise: { minutes: 0, label: 'Unlimited', badge: 'Enterprise', badgeColor: '#10b981' },
  school_enterprise: { minutes: 0, label: 'Unlimited', badge: 'School Enterprise', badgeColor: '#10b981' },
};

export function StartLiveLesson({
  preschoolId,
  teacherId,
  teacherName,
  subscriptionTier = 'starter',
}: StartLiveLessonProps) {
  const systemColorScheme = useColorScheme();
  const { isDark: themeIsDark } = useTheme();
  const isDark = themeIsDark ?? systemColorScheme === 'dark';

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Existing call state
  const [existingCall, setExistingCall] = useState<ExistingCall | null>(null);
  const [isRejoining, setIsRejoining] = useState(false);
  
  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [sendReminders, setSendReminders] = useState(true);
  
  // Custom duration state
  const [customDuration, setCustomDuration] = useState<number>(0); // 0 means use max

  // Get time limit based on tier
  const tierConfig = TIER_TIME_LIMITS[subscriptionTier.toLowerCase()] || TIER_TIME_LIMITS.starter;
  const maxDurationMinutes = tierConfig.minutes || 1440; // 24hr if unlimited
  
  // Available duration options based on tier
  const durationOptions = useMemo(() => {
    const options: { value: number; label: string }[] = [];
    if (maxDurationMinutes >= 15) options.push({ value: 15, label: '15 min' });
    if (maxDurationMinutes >= 30) options.push({ value: 30, label: '30 min' });
    if (maxDurationMinutes >= 45) options.push({ value: 45, label: '45 min' });
    if (maxDurationMinutes >= 60) options.push({ value: 60, label: '1 hour' });
    if (maxDurationMinutes >= 90) options.push({ value: 90, label: '1.5 hours' });
    if (maxDurationMinutes >= 120) options.push({ value: 120, label: '2 hours' });
    if (maxDurationMinutes >= 180) options.push({ value: 180, label: '3 hours' });
    if (maxDurationMinutes >= 1440) options.push({ value: 1440, label: 'All day' });
    if (!options.find(o => o.value === maxDurationMinutes)) {
      options.push({ value: maxDurationMinutes, label: tierConfig.label });
    }
    return options.sort((a, b) => a.value - b.value);
  }, [maxDurationMinutes, tierConfig.label]);
  
  const effectiveDuration = customDuration > 0 ? Math.min(customDuration, maxDurationMinutes) : maxDurationMinutes;

  // Theme colors
  const colors = {
    background: isDark ? '#0f172a' : '#f8fafc',
    cardBg: isDark ? '#1e293b' : '#ffffff',
    modalBg: isDark ? '#1a1a2e' : '#ffffff',
    inputBg: isDark ? '#27272a' : '#f1f5f9',
    inputBorder: isDark ? '#3f3f46' : '#cbd5e1',
    inputFocusBorder: '#7c3aed',
    text: isDark ? '#fafafa' : '#0f172a',
    textMuted: isDark ? '#a1a1aa' : '#64748b',
    textDimmed: isDark ? '#71717a' : '#94a3b8',
    gradient: ['#7c3aed', '#db2777'],
    accent: '#7c3aed',
    accentLight: isDark ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.1)',
    border: isDark ? '#3f3f46' : '#e2e8f0',
    error: '#dc2626',
    errorBg: isDark ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)',
    white: '#ffffff',
    whiteAlpha: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  };

  // Check for existing live calls
  useEffect(() => {
    const checkExistingCall = async () => {
      const now = new Date().toISOString();
      try {
        await supabase
          .from('video_calls')
          .update({ status: 'ended', actual_end: now })
          .eq('teacher_id', teacherId)
          .eq('status', 'live')
          .lt('scheduled_end', now);

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

        if (liveCall?.meeting_url) {
          if (liveCall.scheduled_end && new Date(liveCall.scheduled_end) < new Date()) {
            await supabase
              .from('video_calls')
              .update({ status: 'ended', actual_end: now })
              .eq('id', liveCall.id);
            setExistingCall(null);
          } else {
            setExistingCall({
              id: liveCall.id,
              meetingUrl: liveCall.meeting_url,
              title: liveCall.title || 'Live Lesson',
              className: (liveCall.classes as any)?.name || 'Class',
              classId: liveCall.class_id,
              startedAt: liveCall.actual_start,
            });
          }
        }
      } catch (err) {
        console.warn('[StartLiveLesson] Error checking existing call:', err);
      }
    };

    checkExistingCall();
    const interval = setInterval(checkExistingCall, 30000);
    return () => clearInterval(interval);
  }, [teacherId]);

  // Fetch teacher's classes with student counts
  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .eq('teacher_id', teacherId)
        .eq('active', true)
        .order('name');

      if (data) {
        const classesWithCounts = await Promise.all(
          data.map(async (cls) => {
            const { count } = await supabase
              .from('students')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', cls.id);
            return { ...cls, student_count: count || 0 };
          })
        );
        setClasses(classesWithCounts);
        if (classesWithCounts.length > 0) {
          setSelectedClass(classesWithCounts[0].id);
        }
      }
      setLoading(false);
    };

    fetchClasses();
  }, [teacherId]);

  const handleStartLesson = async () => {
    if (!selectedClass || !lessonTitle.trim()) {
      setError('Please select a class and enter a lesson title');
      return;
    }

    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        setError('Please select both date and time for the scheduled lesson');
        return;
      }
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      if (scheduledDateTime <= new Date()) {
        setError('Scheduled time must be in the future');
        return;
      }
    }

    setIsCreating(true);
    setError(null);

    try {
      // Create Daily.co room via edge function
      const { data: roomData, error: roomError } = await supabase.functions.invoke('create-daily-room', {
        body: {
          name: lessonTitle,
          properties: {
            max_participants: 50,
            enable_recording: subscriptionTier.toLowerCase() !== 'free',
            exp: Math.floor(Date.now() / 1000) + (effectiveDuration * 60),
          },
        },
      });

      if (roomError || !roomData?.url) throw new Error('Failed to create meeting room');

      const scheduledStart = isScheduled 
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : new Date().toISOString();

      const scheduledEnd = new Date(new Date(scheduledStart).getTime() + effectiveDuration * 60000).toISOString();

      // Save to database
      const { data: callData, error: callError } = await supabase
        .from('video_calls')
        .insert({
          teacher_id: teacherId,
          class_id: selectedClass,
          preschool_id: preschoolId,
          title: lessonTitle,
          meeting_url: roomData.url,
          meeting_id: roomData.name,
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          status: isScheduled ? 'scheduled' : 'live',
          actual_start: isScheduled ? null : new Date().toISOString(),
        })
        .select()
        .single();

      if (callError) throw callError;

      // Notify parents
      if (sendReminders || !isScheduled) {
        const selectedClassData = classes.find(c => c.id === selectedClass);
        await supabase.functions.invoke('notify-parents-live-lesson', {
          body: {
            classId: selectedClass,
            className: selectedClassData?.name || 'Class',
            lessonTitle,
            teacherName,
            meetingUrl: roomData.url,
            scheduledStart,
            isScheduled,
          },
        });
      }

      if (isScheduled) {
        Alert.alert('Lesson Scheduled', `Your lesson has been scheduled for ${scheduledDate} at ${scheduledTime}. Parents will receive reminders.`);
        setShowModal(false);
        setLessonTitle('');
        setScheduledDate('');
        setScheduledTime('');
        setIsScheduled(false);
      } else {
        Alert.alert('Success', 'Live lesson started! Opening meeting...', [
          { text: 'OK', onPress: () => Linking.openURL(roomData.url) },
        ]);
        setShowModal(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start lesson');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRejoinCall = () => {
    if (!existingCall) return;
    setIsRejoining(true);
    Linking.openURL(existingCall.meetingUrl).finally(() => setIsRejoining(false));
  };

  const handleEndExistingCall = async () => {
    if (!existingCall) return;
    
    Alert.alert(
      'End Lesson',
      'Are you sure you want to end this live lesson?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('video_calls')
                .update({ status: 'ended', actual_end: new Date().toISOString() })
                .eq('id', existingCall.id);
              setExistingCall(null);
              Alert.alert('Success', 'Live lesson ended');
            } catch (err) {
              Alert.alert('Error', 'Failed to end lesson');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroGradient}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}>
              <Ionicons name="videocam" size={28} color="#ffffff" />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>Live Lessons</Text>
              <Text style={styles.heroSubtitle}>Start or schedule group video lessons</Text>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statContent}>
                <Ionicons name="people" size={18} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.statValue}>{classes.length}</Text>
              </View>
              <Text style={styles.statLabel}>Classes</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statContent}>
                <Ionicons name="time" size={18} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.statValue}>{tierConfig.label}</Text>
              </View>
              <Text style={styles.statLabel}>Max Duration</Text>
            </View>
          </View>

          {/* Features */}
          <View style={styles.featuresList}>
            {['Screen Share', 'Recording', 'Chat', 'Hand Raise'].map((feature) => (
              <View key={feature} style={styles.featureTag}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Start Button */}
          <TouchableOpacity
            style={[styles.startButton, classes.length === 0 && styles.startButtonDisabled]}
            onPress={() => setShowModal(true)}
            disabled={classes.length === 0}
          >
            <Ionicons name="radio" size={20} color="#7c3aed" />
            <Text style={styles.startButtonText}>
              {classes.length === 0 ? 'No Classes Assigned' : 'Start Live Lesson'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Existing Call Banner */}
      {existingCall && (
        <View style={[styles.existingCallBanner, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.existingCallHeader}>
            <View style={styles.pulseDot} />
            <Text style={[styles.existingCallTitle, { color: colors.text }]}>Live Lesson in Progress</Text>
          </View>
          <Text style={[styles.existingCallSubtitle, { color: colors.textMuted }]}>
            {existingCall.title} • {existingCall.className}
          </Text>
          <View style={styles.existingCallActions}>
            <TouchableOpacity
              style={[styles.rejoinButton, { backgroundColor: colors.accent }]}
              onPress={handleRejoinCall}
              disabled={isRejoining}
            >
              {isRejoining ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="enter" size={16} color="#ffffff" />
                  <Text style={styles.rejoinButtonText}>Rejoin</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.endButton, { backgroundColor: colors.errorBg, borderColor: colors.error }]}
              onPress={handleEndExistingCall}
            >
              <Ionicons name="stop-circle" size={16} color={colors.error} />
              <Text style={[styles.endButtonText, { color: colors.error }]}>End</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.modalBg }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <View style={styles.modalIcon}>
                  <Ionicons name="videocam" size={24} color="#ffffff" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Start Live Lesson</Text>
                  <Text style={styles.modalSubtitle}>Parents will be notified instantly</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModal(false)}
              >
                <Ionicons name="close" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {error && (
                <View style={[styles.errorBox, { backgroundColor: colors.errorBg, borderColor: colors.error }]}>
                  <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                </View>
              )}

              {/* Lesson Title */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Lesson Title</Text>
                <TextInput
                  value={lessonTitle}
                  onChangeText={setLessonTitle}
                  placeholder="e.g., Math - Counting to 10"
                  placeholderTextColor={colors.textDimmed}
                  style={[styles.input, { 
                    backgroundColor: colors.inputBg, 
                    color: colors.text, 
                    borderColor: colors.inputBorder 
                  }]}
                />
              </View>

              {/* Select Class */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Select Class</Text>
                <View style={styles.classGrid}>
                  {classes.map((cls) => (
                    <TouchableOpacity
                      key={cls.id}
                      style={[
                        styles.classCard,
                        { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                        selectedClass === cls.id && { 
                          borderColor: colors.accent, 
                          backgroundColor: colors.accentLight 
                        },
                      ]}
                      onPress={() => setSelectedClass(cls.id)}
                    >
                      <Text style={[styles.className, { color: colors.text }]}>{cls.name}</Text>
                      <Text style={[styles.classInfo, { color: colors.textMuted }]}>
                        {cls.grade_level || 'All Ages'} • {cls.student_count} students
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Schedule Toggle */}
              <TouchableOpacity
                style={[
                  styles.scheduleToggle,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                  isScheduled && { borderColor: colors.accent, backgroundColor: colors.accentLight },
                ]}
                onPress={() => setIsScheduled(!isScheduled)}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: isScheduled ? colors.accent : colors.border },
                  isScheduled && { backgroundColor: colors.accent },
                ]}>
                  {isScheduled && <Ionicons name="calendar" size={12} color="#ffffff" />}
                </View>
                <View style={styles.scheduleToggleText}>
                  <Text style={[styles.scheduleToggleTitle, { color: colors.text }]}>Schedule for Later</Text>
                  <Text style={[styles.scheduleToggleSubtitle, { color: colors.textMuted }]}>
                    Set a specific date and time
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Schedule Fields */}
              {isScheduled && (
                <View style={styles.scheduleFields}>
                  <View style={styles.scheduleRow}>
                    <View style={styles.scheduleCol}>
                      <Text style={[styles.smallLabel, { color: colors.textMuted }]}>Date</Text>
                      <TextInput
                        value={scheduledDate}
                        onChangeText={setScheduledDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textDimmed}
                        style={[styles.smallInput, { 
                          backgroundColor: colors.inputBg, 
                          color: colors.text,
                          borderColor: colors.inputBorder 
                        }]}
                      />
                    </View>
                    <View style={styles.scheduleCol}>
                      <Text style={[styles.smallLabel, { color: colors.textMuted }]}>Time</Text>
                      <TextInput
                        value={scheduledTime}
                        onChangeText={setScheduledTime}
                        placeholder="HH:MM"
                        placeholderTextColor={colors.textDimmed}
                        style={[styles.smallInput, { 
                          backgroundColor: colors.inputBg, 
                          color: colors.text,
                          borderColor: colors.inputBorder 
                        }]}
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.reminderToggle, { backgroundColor: colors.inputBg }]}
                    onPress={() => setSendReminders(!sendReminders)}
                  >
                    <View style={[
                      styles.smallCheckbox,
                      { borderColor: sendReminders ? colors.accent : colors.border },
                      sendReminders && { backgroundColor: colors.accent },
                    ]}>
                      {sendReminders && <Ionicons name="notifications" size={10} color="#ffffff" />}
                    </View>
                    <Text style={[styles.reminderText, { color: colors.text }]}>
                      Send reminders to parents
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Duration Selector */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Lesson Duration</Text>
                <View style={styles.durationGrid}>
                  {durationOptions.map((option) => {
                    const isSelected = customDuration === option.value || 
                      (customDuration === 0 && option.value === maxDurationMinutes);
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.durationButton,
                          { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                          isSelected && { 
                            borderColor: colors.accent, 
                            backgroundColor: colors.accentLight 
                          },
                        ]}
                        onPress={() => setCustomDuration(option.value)}
                      >
                        <Text style={[
                          styles.durationButtonText,
                          { color: isSelected ? colors.accent : colors.textMuted },
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.durationHint, { color: colors.textDimmed }]}>
                  Your {tierConfig.badge} plan allows up to {tierConfig.label}
                </Text>
              </View>

              {/* Start Button */}
              <TouchableOpacity
                style={[styles.modalStartButton, { backgroundColor: colors.accent }]}
                onPress={handleStartLesson}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name={isScheduled ? "calendar" : "play-circle"} size={20} color="#ffffff" />
                    <Text style={styles.modalStartButtonText}>
                      {isScheduled ? 'Schedule Lesson' : 'Start Live Lesson'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  heroGradient: {
    padding: 20,
    backgroundColor: '#7c3aed',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  featureTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  featureText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7c3aed',
  },
  existingCallBanner: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  existingCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  existingCallTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  existingCallSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  existingCallActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejoinButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  rejoinButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  endButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  endButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 28,
    backgroundColor: '#7c3aed',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 15,
  },
  classGrid: {
    gap: 10,
  },
  classCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  className: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  classInfo: {
    fontSize: 13,
  },
  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleToggleText: {
    flex: 1,
  },
  scheduleToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  scheduleToggleSubtitle: {
    fontSize: 12,
  },
  scheduleFields: {
    marginBottom: 16,
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  scheduleCol: {
    flex: 1,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  smallInput: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    fontSize: 14,
  },
  reminderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  smallCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderText: {
    fontSize: 13,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  durationButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    minWidth: 65,
    alignItems: 'center',
  },
  durationButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationHint: {
    fontSize: 11,
    marginTop: 6,
  },
  modalStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  modalStartButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
