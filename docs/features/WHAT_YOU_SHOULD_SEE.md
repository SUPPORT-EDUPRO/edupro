# What You Should See After Call System Fixes

## Date: December 8, 2025

## 🎯 Changes Made

### 1. **Live Classes Section on Parent Dashboard** ✅

**Location**: Parent Dashboard (after metrics cards)

**What to Expect**:
- New collapsible section titled "Live Classes"
- Shows all currently ongoing live lessons
- Each lesson displays:
  - Teacher name
  - Class/grade
  - "LIVE" indicator (red dot + badge)
  - "Join Lesson" button
  - Start time
- Empty state when no lessons are active: "No live lessons at the moment"
- Pull-to-refresh support
- Real-time updates (auto-refreshes every 10 seconds)

**How to Access**:
1. Open the app
2. Navigate to Parent Dashboard (home screen)
3. Scroll down past the metrics cards
4. Find the "Live Classes" section

**Testing**:
- Have a teacher start a live lesson from their dashboard
- The lesson should appear instantly in the parent's "Live Classes" section
- Tap "Join Lesson" to enter the live video session

---

### 2. **Offline User Call Prevention** ✅

**What to Expect**:
When you attempt to call a user who is offline:

1. **Alert Dialog Appears**:
   ```
   Title: "User Offline"
   Message: "[Teacher Name] appears to be offline (Last seen 5 min ago). 
            They may not receive your call. Do you want to continue?"
   
   Buttons:
   - "Cancel" (gray, stops the call)
   - "Call Anyway" (blue, proceeds with call)
   ```

2. **Console Logs** (visible in Metro bundler/terminal):
   ```
   [CallProvider] Presence check: {
     userId: "...",
     userName: "Teacher Name",
     userOnline: false,
     lastSeenText: "Last seen 5 min ago"
   }
   [CallProvider] User offline, showing alert
   ```

3. **If User is Online**:
   - No alert appears
   - Call proceeds immediately
   - Console shows: `[CallProvider] User is online, starting call`

**Where This Applies**:
- Voice calls (phone icon in message threads)
- Video calls (video icon in message threads)
- Both parent-to-teacher and teacher-to-parent calls

---

### 3. **Improved Presence Detection** ✅

**Online Threshold**: User is considered "online" only if last seen within **30 seconds** (previously 2 minutes)

**What to Expect**:
- More accurate online/offline status in chat
- Faster status updates when users go offline
- Green dot only shows for actively connected users

**Console Logs**:
```
[usePresence] Loaded presence data: {
  count: 15,
  onlineCount: 3
}

[usePresence] isUserOnline check: {
  targetUserId: "...",
  status: "online",
  lastSeen: "2025-12-08T10:30:45.123Z",
  ageSeconds: 45,
  isOnline: false  // Because > 30 seconds
}
```

---

### 4. **Ringback Audio Diagnostics** ✅

**What to Expect During Calls**:

**Before Connection** (ringing state):
- You should hear ringback tone (ringing sound)
- Console logs show audio setup:
  ```
  [VoiceCall] Setting up audio mode for ringback
  [VoiceCall] Audio mode set, loading ringback sound
  [VoiceCall] Ringback loaded, starting playback
  [VoiceCall] Ringback playing
  ```

**After Connection**:
- Ringback stops
- Console shows:
  ```
  [VoiceCall] Stopping ringback
  [VoiceCall] Ringback stopped
  ```

**If Audio Fails**:
- Console will show detailed error:
  ```
  [VoiceCall] Failed to play ringback tone: [error details]
  ```

**Troubleshooting**:
- Check device volume is not muted
- Check silent mode is OFF
- Check app has audio permissions
- Check `assets/sounds/ringback.mp3` exists

---

## 📱 Step-by-Step Testing Guide

### Test 1: Live Classes Visibility
1. **Setup**: Have a teacher logged in on another device
2. **Action**: Teacher starts a live lesson from their dashboard
3. **Expected Result**: 
   - Parent sees lesson in "Live Classes" section immediately
   - Lesson shows "LIVE" badge
   - "Join Lesson" button is visible
4. **Verify**: Tap "Join Lesson" and confirm you enter the video call

### Test 2: Offline Call Prevention
1. **Setup**: Open parent app while teacher is logged out/offline
2. **Action**: Go to Messages → Select a teacher → Tap call icon
3. **Expected Result**:
   - Alert appears: "User Offline"
   - Shows last seen time (e.g., "Last seen 5 min ago")
   - Two buttons: "Cancel" and "Call Anyway"
4. **Verify**: 
   - Tap "Cancel" → Call stops
   - Tap "Call Anyway" → Call proceeds (but teacher won't answer)

### Test 3: Online Call Success
1. **Setup**: Have teacher logged in and actively using app
2. **Action**: Go to Messages → Select the teacher → Tap call icon
3. **Expected Result**:
   - NO alert appears
   - Call starts immediately
   - You hear ringback tone
4. **Verify**: Teacher receives incoming call notification

### Test 4: Presence Accuracy
1. **Setup**: Teacher is online
2. **Action**: Teacher closes/backgrounds app
3. **Expected Result**: 
   - Within 30 seconds, teacher shows as "offline" in chat
   - Green dot disappears
   - Subsequent call attempts trigger "User Offline" alert
4. **Verify**: Check console logs for presence updates

---

## 🐛 Known Issues & Limitations

### Issue 1: Ringback May Not Play on Some Devices
**Symptom**: Call shows "ringing" but no sound
**Possible Causes**:
- Device is in silent mode
- App lacks audio permissions
- Expo Audio not properly initialized
- Ringback.mp3 file missing or corrupted

**Debug Steps**:
1. Check console for: `[VoiceCall] Failed to play ringback tone`
2. Verify file exists: `ls -la assets/sounds/ringback.mp3`
3. Test with volume UP and silent mode OFF
4. Check Android audio focus settings

### Issue 2: Presence Data May Be Stale on First Load
**Symptom**: First call attempt shows user as offline even if online
**Cause**: Presence data loads asynchronously
**Workaround**: Wait 2-3 seconds after opening app before calling

### Issue 3: Live Lessons May Not Appear Immediately
**Symptom**: Teacher starts lesson but parent doesn't see it
**Cause**: Real-time subscription delay or network latency
**Workaround**: Pull-to-refresh the Live Classes section

---

## 📊 Console Log Reference

### Success Scenario (Online User)
```
[usePresence] Loaded presence data: { count: 10, onlineCount: 3 }
[CallProvider] Presence check: { userId: "abc123", userName: "Ms. Smith", userOnline: true, lastSeenText: "Online" }
[CallProvider] User is online, starting call
[VoiceCall] Setting up audio mode for ringback
[VoiceCall] Ringback playing
```

### Offline User Scenario
```
[usePresence] isUserOnline check: { targetUserId: "abc123", status: "online", ageSeconds: 120, isOnline: false }
[CallProvider] Presence check: { userId: "abc123", userName: "Ms. Smith", userOnline: false, lastSeenText: "Last seen 2 min ago" }
[CallProvider] User offline, showing alert
[CallProvider] User cancelled offline call  // If tapped Cancel
[CallProvider] User chose to call anyway    // If tapped Call Anyway
```

### Audio Failure Scenario
```
[VoiceCall] Setting up audio mode for ringback
[VoiceCall] Failed to play ringback tone: Error: Unable to load asset
```

---

## 🔍 Debugging Commands

### Check if Live Classes component is loaded:
```bash
# Search for JoinLiveLesson import
grep -r "JoinLiveLesson" components/dashboard/
```

### Check presence subscription:
```bash
# View Supabase realtime logs
supabase functions logs --function=realtime --tail
```

### Check call system initialization:
```bash
# View app logs in Metro bundler
# Look for: [CallProvider], [usePresence], [VoiceCall]
```

### Verify audio file exists:
```bash
ls -la assets/sounds/ringback.mp3
# Should show: -rw-r--r-- ... ringback.mp3
```

---

## 📝 What Changed in Code

### Files Modified:
1. **`components/dashboard/NewEnhancedParentDashboardRefactored.tsx`**
   - Added `JoinLiveLesson` import
   - Added "Live Classes" collapsible section after metrics

2. **`components/calls/CallProvider.tsx`**
   - Added detailed logging for presence checks
   - Enhanced Alert dialogs with Cancel/Call Anyway options
   - Added console logs for debugging call flow

3. **`hooks/usePresence.ts`**
   - Added logging for presence data loading
   - Added detailed logging for `isUserOnline()` checks
   - Shows age of presence data in seconds

4. **`components/calls/VoiceCallInterface.tsx`**
   - Added detailed audio setup logging
   - Shows each step of ringback playback
   - Error logging for audio failures

### Files Created Earlier (Already Exist):
- `components/calls/StartLiveLesson.tsx` (558 lines)
- `components/calls/JoinLiveLesson.tsx` (347 lines)

---

## ✅ Success Criteria

### You know it's working when:
1. ✅ You see "Live Classes" section on parent dashboard
2. ✅ Alert appears when calling offline users
3. ✅ No alert appears when calling online users
4. ✅ Console logs show presence checking details
5. ✅ Online status updates within 30 seconds of user going offline
6. ✅ Ringback plays during outgoing calls (check console if not)

### You have a problem if:
1. ❌ No "Live Classes" section visible → Check dashboard component loaded
2. ❌ No alert when calling offline users → Check presence data loaded
3. ❌ Alert appears for online users → Check 30-second threshold logic
4. ❌ No console logs → Check Metro bundler is running
5. ❌ No ringback sound → Check audio permissions and file existence

---

## 🚀 Next Steps

### If Everything Works:
1. Test with multiple users
2. Test network interruptions
3. Test background/foreground transitions
4. Deploy to production

### If Issues Persist:
1. Share console logs (look for errors)
2. Test on different devices (Android vs iOS)
3. Check Supabase realtime dashboard for connection issues
4. Verify audio files and permissions

---

## 📞 Quick Reference

**Problem**: "I don't see the live classes section"
**Solution**: Check that `JoinLiveLesson` is imported in dashboard component

**Problem**: "Calls still go through to offline users"
**Solution**: Check console logs for presence data - may need to wait for initial load

**Problem**: "No ringback sound"
**Solution**: Check device volume, silent mode, and console for audio errors

**Problem**: "Alert shows for online users"
**Solution**: Check system time is correct, 30-second threshold may be too strict

---

## 🎉 Summary

You should now see:
1. **Live Classes section** with real-time lesson updates
2. **Offline user warnings** before initiating calls
3. **Detailed console logs** for debugging
4. **Accurate online status** with 30-second threshold

All changes are backward compatible and won't break existing functionality. The system gracefully degrades if presence data isn't available (calls still work, just without warnings).
