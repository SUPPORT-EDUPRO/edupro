# Deprecation & Migration Tasks

## RoleBasedHeader → DesktopLayout Migration

**Status:** In Progress  
**Priority:** Medium  
**Created:** 2025-12-08

### Overview
The `RoleBasedHeader` component (`components/RoleBasedHeader.tsx`) is deprecated in favor of `DesktopLayout` (`components/layout/DesktopLayout.tsx`), which provides a unified header experience across mobile and desktop platforms.

### Migration Instructions
Replace:
```tsx
import { RoleBasedHeader } from '@/components/RoleBasedHeader';

// In render:
<RoleBasedHeader title="Page Title" showBackButton />
<View>...content...</View>
```

With:
```tsx
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useAuth } from '@/contexts/AuthContext';

const { profile } = useAuth();
const userRole = profile?.role || 'parent';

// In render:
<DesktopLayout role={userRole} title="Page Title" showBackButton>
  ...content...
</DesktopLayout>
```

### Files Requiring Migration

| File | Status | Notes |
|------|--------|-------|
| `app/profiles-gate.tsx` | ⏳ Pending | 2 usages |
| `app/screens/parent-children.tsx` | ⏳ Pending | 2 usages |
| `app/screens/parent-proof-of-payment.tsx` | ⏳ Pending | 1 usage |
| `app/screens/theme-demo.tsx` | ⏳ Pending | 1 usage |
| `app/screens/account.tsx` | ⏳ Pending | 1 usage |
| `app/screens/admin/data-export.tsx` | ⏳ Pending | 2 usages |
| `app/screens/parent-pop-history.tsx` | ⏳ Pending | 2 usages |
| `app/screens/admin-ai-allocation.tsx` | ⏳ Pending | 1 usage |
| `app/screens/teacher-management.tsx` | ⏳ Pending | 1 usage |
| `app/screens/super-admin-leads.tsx` | ⏳ Pending | 1 usage |
| `app/screens/calendar.tsx` | ✅ Done | Migrated 2025-12-08 |

### Completion Checklist
- [ ] Migrate all listed files
- [ ] Remove `RoleBasedHeader` component
- [ ] Update `app/screens/_layout.tsx` comments
- [ ] Remove any remaining imports

### Notes
- The `@deprecated` JSDoc tag has been added to `RoleBasedHeader`
- IDE will show strikethrough for deprecated usage
- Some screens may need `showBackButton` prop passed to `DesktopLayout`
