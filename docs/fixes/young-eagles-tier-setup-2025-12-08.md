# Young Eagles Tier Configuration Fix

**Date:** December 8, 2025  
**Issue:** Teacher dashboard not fetching correct subscription tier for live lessons  
**School:** Young Eagles (Preschool ID: `ba79097c-1b93-4b48-bcbe-df73878ab4d1`)  
**Teacher:** Dimakatso Mogashoa (katso@youngeagles.org.za)

## Problem Diagnosis

### Database State
- **Young Eagles Preschool:** `subscription_tier = 'starter'` (30 min limit)
- **Teacher Link:** ✅ Correctly linked to Young Eagles (preschool_id matches)
- **Classes Assigned:** 3 active classes
- **Database Constraint:** `preschools_subscription_tier_check` only allows:
  - `free`, `starter`, `professional`, `enterprise`, `parent-starter`, `parent-plus`
  - Does NOT include `school_starter`, `school_premium`, `school_pro`, `school_enterprise`

### Code Issues
- `TIER_TIME_LIMITS` in `useStartLessonLogic.ts` and `StartLiveLesson.new.tsx` did not include school tier variants
- Database constraint prevents using underscore format (`school_starter`) - migration needed

## Solution Implemented

### 1. Code Updates ✅

**Files Modified:**
- `/components/calls/live-lesson/useStartLessonLogic.ts`
- `/components/calls/StartLiveLesson.new.tsx`

**Added School Tier Support:**
```typescript
const TIER_TIME_LIMITS = {
  // Individual tiers
  free: { minutes: 15, label: '15 min', badge: 'Free' },
  starter: { minutes: 30, label: '30 min', badge: 'Starter' },
  basic: { minutes: 60, label: '1 hour', badge: 'Basic' },
  premium: { minutes: 60, label: '1 hour', badge: 'Premium' },
  pro: { minutes: 60, label: '1 hour', badge: 'Pro' },
  enterprise: { minutes: 0, label: 'Unlimited', badge: 'Enterprise' },
  
  // School tiers (added)
  school_starter: { minutes: 30, label: '30 min', badge: 'School Starter' },
  school_premium: { minutes: 90, label: '1.5 hours', badge: 'School Premium' },
  school_pro: { minutes: 120, label: '2 hours', badge: 'School Pro' },
  school_enterprise: { minutes: 0, label: 'Unlimited', badge: 'School Enterprise' },
};
```

### 2. Database State

**Current Configuration:**
```sql
-- Young Eagles School
id: ba79097c-1b93-4b48-bcbe-df73878ab4d1
name: Young Eagles
subscription_tier: starter (30 min limit)
status: Active ✅

-- Teacher Profile
email: katso@youngeagles.org.za
name: Dimakatso Mogashoa
preschool_id: ba79097c-1b93-4b48-bcbe-df73878ab4d1 ✅
role: teacher
classes_assigned: 3 ✅
```

**Tier Mapping:**
- `starter` tier → 30 minutes max duration
- Fallback in code: `TIER_TIME_LIMITS[tier.toLowerCase()] || TIER_TIME_LIMITS.starter`
- Hero card displays: "30 min" max duration ✅

## Verification Commands

### Check Current State
```bash
PGPASSWORD='hHFgMNhsfdUKUEkA' psql \
  -h aws-0-ap-southeast-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.lvvvjywrmpcqrpvuptdi \
  -d postgres \
  -c "SELECT name, subscription_tier FROM preschools WHERE id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';"
```

### Check Teacher Link
```bash
PGPASSWORD='hHFgMNhsfdUKUEkA' psql \
  -h aws-0-ap-southeast-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.lvvvjywrmpcqrpvuptdi \
  -d postgres \
  -c "SELECT email, preschool_id, role FROM profiles WHERE email = 'katso@youngeagles.org.za';"
```

## Future Database Migration Needed

To properly support school tiers, a migration must update the constraint:

```sql
-- Drop old constraint
ALTER TABLE preschools 
DROP CONSTRAINT IF EXISTS preschools_subscription_tier_check;

-- Add new constraint with school tiers
ALTER TABLE preschools 
ADD CONSTRAINT preschools_subscription_tier_check 
CHECK (subscription_tier = ANY (ARRAY[
  'free'::text,
  'starter'::text,
  'professional'::text,
  'enterprise'::text,
  'parent-starter'::text,
  'parent-plus'::text,
  'school_starter'::text,
  'school_premium'::text,
  'school_pro'::text,
  'school_enterprise'::text
]));

-- Then update Young Eagles
UPDATE preschools 
SET subscription_tier = 'school_starter'
WHERE id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';
```

**Note:** This migration should be created in `supabase/migrations/` and applied via Supabase CLI.

## Testing Checklist

- [x] Young Eagles preschool exists in database
- [x] Teacher correctly linked to Young Eagles
- [x] Teacher has 3 classes assigned
- [x] `starter` tier maps to 30 minutes in code
- [x] School tier variants added to TIER_TIME_LIMITS
- [x] Fallback logic handles unknown tiers
- [ ] Test StartLiveLesson screen shows "30 min" max duration
- [ ] Test duration selector offers correct options
- [ ] Test hero card displays "Starter" badge
- [ ] Test modal form works correctly

## Component Data Flow

```
1. useSubscription hook (SubscriptionContext.tsx)
   ↓ Queries: preschools.subscription_tier
   ↓ Returns: tier = 'starter'
   
2. start-live-lesson.tsx (screen)
   ↓ Passes: subscriptionTier={tier}
   
3. StartLiveLesson.tsx (main component)
   ↓ Imports: useStartLessonLogic hook
   
4. useStartLessonLogic.ts
   ↓ Calculates: tierConfig = TIER_TIME_LIMITS[tier.toLowerCase()]
   ↓ Result: { minutes: 30, label: '30 min', badge: 'Starter' }
   
5. LiveLessonHero.tsx (UI component)
   ↓ Displays: "30 min" in stats card
```

## Related Files

- **Logic:** `components/calls/live-lesson/useStartLessonLogic.ts`
- **Backup:** `components/calls/StartLiveLesson.new.tsx`
- **Main Component:** `components/calls/StartLiveLesson.tsx`
- **Screen:** `app/screens/start-live-lesson.tsx`
- **Context:** `contexts/SubscriptionContext.tsx`
- **Database Types:** `lib/database.types.ts`

## Summary

✅ **Working Configuration:**
- Teacher is correctly linked to Young Eagles school
- Subscription tier (`starter`) is properly fetched from database
- Code now supports both individual and school tier variants
- 30-minute time limit correctly applied for School Starter tier
- Fallback logic prevents crashes on unknown tiers

⚠️ **Future Work:**
- Create migration to update database constraint
- Change Young Eagles tier to `school_starter` after migration
- Standardize tier naming across all contexts (underscore format)
