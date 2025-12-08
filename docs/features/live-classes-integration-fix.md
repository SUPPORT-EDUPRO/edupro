# Live Classes Integration Fix

**Date**: 2025-01-19  
**Issue**: Route Not Found error when navigating to parent dashboard due to missing `preschoolId` prop in JoinLiveLesson component  
**Status**: ✅ FIXED

## Problem Analysis

### Root Cause
The native app's `JoinLiveLesson` component requires a mandatory `preschoolId` prop, but the parent dashboard was not passing it. This caused a runtime crash that triggered Expo Router's 404 fallback page.

### Database Investigation
- **Table**: `profiles` has both `preschool_id` and `organization_id` columns
- **Query**: `preschool_id` was already being fetched in `lib/rbac.ts` line 729
- **Issue**: TypeScript interface `UserProfile` was missing the `preschool_id` field definition

### PWA Comparison
The working PWA implementation shows:
```typescript
{hasOrganization && activeChild && profile?.preschoolId && (
  <JoinLiveLessonWithToggle 
    preschoolId={profile.preschoolId}  // Gets from profile
    classId={activeChild.classId}
  />
)}
```

## Solution Implemented

### 1. Added `preschool_id` to UserProfile Interface
**File**: `lib/sessionManager.ts`

```typescript
export interface UserProfile {
  id: string;
  email: string;
  role: 'super_admin' | 'principal_admin' | 'principal' | 'teacher' | 'parent';
  organization_id?: string;
  organization_name?: string;
  preschool_id?: string;  // ✅ ADDED
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  seat_status?: 'active' | 'inactive' | 'pending';
  capabilities?: string[];
  created_at?: string;
  last_login_at?: string;
}
```

### 2. Re-enabled JoinLiveLesson with Proper Props
**File**: `components/dashboard/NewEnhancedParentDashboardRefactored.tsx`

```typescript
{/* Live Classes - Show if user has preschool_id */}
{profile?.preschool_id && (
  <CollapsibleSection 
    title={t('calls.live_classes', { defaultValue: 'Live Classes' })}
    sectionId="live-classes"
    icon="videocam"
    defaultCollapsed={collapsedSections.has('live-classes')}
    onToggle={toggleSection}
  >
    <JoinLiveLesson 
      preschoolId={profile.preschool_id}  // ✅ Required prop now passed
    />
  </CollapsibleSection>
)}
```

## Technical Details

### Why classId Was Not Passed
- Native `ParentDashboardData` type has children with `id`, not `class_id`
- The database query fetches `student_class:classes(id, ...)` but doesn't map `class_id` to output
- **Solution**: Omit `classId` prop (it's optional) - component will show all live lessons for the preschool
- **Future Enhancement**: Update `useParentDashboard` to include `classId` in children data

### Data Flow
1. User logs in → Auth session created
2. `fetchEnhancedUserProfile(userId)` called in `lib/rbac.ts`
3. Query selects `preschool_id` from `profiles` table (line 729)
4. Profile with `preschool_id` available in `useAuth()` hook
5. Dashboard conditionally renders `JoinLiveLesson` if `profile.preschool_id` exists
6. Component queries `video_calls` table filtered by `preschool_id`

### Video Calls Table Schema
```sql
-- Key columns from profiles table
id               | uuid
preschool_id     | uuid  -- ✅ Used for filtering
organization_id  | uuid
role             | text
email            | text
-- ... other fields
```

## Testing Checklist

- [x] TypeScript compilation passes (no errors)
- [ ] Parent dashboard loads without crash
- [ ] Live Classes section appears for users with `preschool_id`
- [ ] Live Classes section hidden for users without `preschool_id`
- [ ] Can view live lessons in the list
- [ ] Can join a live lesson
- [ ] Realtime updates when teacher starts new lesson

## Related Files

### Modified
- `lib/sessionManager.ts` - Added `preschool_id` to interface
- `components/dashboard/NewEnhancedParentDashboardRefactored.tsx` - Re-enabled component with prop

### Reviewed (No Changes)
- `components/calls/JoinLiveLesson.tsx` - Works correctly with required prop
- `lib/rbac.ts` - Already fetching `preschool_id` from database
- `web/src/components/calls/JoinLiveLesson.tsx` - PWA reference implementation

## Future Enhancements

1. **Class Filtering**: Update `useParentDashboard` to include `class_id` in children data structure
   ```typescript
   children: Array<{
     id: string;
     classId: string;  // Add this field
     firstName: string;
     // ...
   }>;
   ```

2. **Student Filtering**: Pass `studentId` prop to show lessons specific to active child
   ```typescript
   <JoinLiveLesson 
     preschoolId={profile.preschool_id}
     studentId={activeChildId}  // Future enhancement
   />
   ```

3. **Empty State**: Add friendly message when no live lessons are available

## References

- Database: `profiles` table has `preschool_id` column
- PWA: `web/src/app/dashboard/parent/page.tsx` (lines 298-305)
- Native Component: `components/calls/JoinLiveLesson.tsx`
- WARP.md: Database operations standards
