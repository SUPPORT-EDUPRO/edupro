# EduDash Pro - Skills Development Dashboard

## Overview

The **Skills Development Dashboard** is designed for organizations that offer skills development and vocational training to adult learners (18 years and above). This includes:

- Skills Development Centres
- Vocational Training Providers
- SETA-accredited Training Organizations
- Community Skills Programmes
- Adult Education Centres

## Database Migration Required

### Migration File
```
supabase/migrations/20251130_skills_development_organization_type.sql
```

### Run Migration
```bash
# Using Supabase CLI
supabase db push

# Verify no drift
supabase db diff
```

### What the Migration Creates

1. **Organization Type**
   - Adds `skills_development` to `organization_type` enum

2. **New Tables**
   - `skills_programmes` - Programme definitions with NQF levels, SETA codes
   - `programme_enrollments` - Learner enrollment tracking
   - `skills_certificates` - Certificate issuance and verification
   - `competency_assessments` - Individual competency unit assessments

3. **Subscription Plans** (see tier details below)

4. **Helper Functions**
   - `get_learner_progress(learner_id)` - Get learner's progress summary
   - `generate_certificate_number(org_id)` - Auto-generate unique certificate numbers

5. **RLS Policies**
   - Learners can view their own data
   - Facilitators can manage enrolled learners
   - Centre Directors have full access

## Organization Tiers

| Tier | Facilitators | Learners | Monthly Price | Annual Price |
|------|-------------|----------|---------------|--------------|
| Free | 2 | 30 | R0 | R0 |
| Starter | 5 | 100 | R499 | R4,990 |
| Premium | 20 | 500 | R999 | R9,990 |
| **Enterprise** | **Unlimited** | **Unlimited** | **Custom** | **Custom** |

### Tier Features

#### Free Tier
- Basic dashboard
- Learner registration
- Certificate templates
- Email support
- Up to 3 programmes

#### Starter Tier (R499/month)
- Up to 5 facilitators
- 100 learners
- AI-powered progress tracking
- Certificate generation
- WhatsApp notifications
- SETA report templates
- Email support

#### Premium Tier (R999/month)
- Up to 20 facilitators
- 500 learners
- Advanced reporting
- Competency assessment tools
- Priority support
- Custom branding
- API access
- SETA integration
- Bulk certificate generation

#### Enterprise Tier (Custom Pricing)
- **Unlimited facilitators**
- **Unlimited learners**
- **Custom pricing based on organization size**
- **Volume discounts available**
- Dedicated success manager
- SLA guarantee
- White-label solution
- Custom integrations
- 24/7 priority support
- Full SETA compliance module
- Multi-site support

> **Note**: Enterprise tier pricing is customized based on your organization's specific needs. Contact sales for a personalized quote.

## Dashboard Types by Role

### 1. Learner Dashboard (Hub: `learner`)

**Target Users**: Adult learners enrolled in skills programmes

**Dashboard Widgets**:
- **Announcements** - View centre announcements
- **Schedule** - View workshop and session schedules
- **Assignments** - View and submit assessments
- **Grades** - Track progress and competency achievements
- **Certifications** - View and download earned certificates

**Key Features**:
- Self-registration (no guardian approval needed for 18+)
- Programme enrollment tracking
- Competency progress visualization
- Digital portfolio building
- Certificate downloads with verification QR codes

### 2. Facilitator Dashboard (Hub: `instructor`)

**Target Users**: Skills programme facilitators, trainers

**Dashboard Widgets**:
- **Announcements** - View and manage announcements
- **Schedule** - View and manage teaching schedule
- **Assignments** - Manage and grade assignments
- **Grades** - Manage learner grades and assessments
- **Certifications** - Issue and manage certificates

**Key Features**:
- Programme management
- Learner progress tracking
- Competency assessments
- Certificate issuance
- Attendance tracking

### 3. Sponsor Dashboard (Hub: `guardian`)

**Target Users**: Organizations or individuals sponsoring learners

**Dashboard Widgets**:
- **Announcements** - View centre announcements
- **Progress Reports** - View learner progress and grades
- **Certificates** - View earned certificates

**Key Features**:
- Sponsored learner oversight
- Progress tracking
- Attendance reports
- ROI tracking

### 4. Centre Director Dashboard (Hub: `admin`)

**Target Users**: Skills Centre administrators

**Dashboard Widgets**:
- **Announcements** - Manage organizational announcements
- **Schedule Overview** - View organizational schedules

**Key Features**:
- Centre analytics and KPIs
- Staff management
- Programme oversight
- Financial reports
- SETA compliance tracking
- Accreditation management

## Key Differences from Preschool/K-12 Dashboards

| Aspect | Preschool/K-12 | Skills Development |
|--------|----------------|-------------------|
| Age Range | 2-18 years | 18+ years (adults) |
| Learners | Students (minors) | Learners (adults) |
| Guardians | Parents (required) | Sponsors (optional) |
| Consent | Parental consent required | Self-consent |
| Registration | Via parent/school | Self-registration |
| Terminology | Student, Teacher, Class | Learner, Facilitator, Programme |
| Assessments | Grades (A-F, %) | Competency (Competent/Not Yet Competent) |
| Certificates | Report cards | NQF-aligned certificates |

## Terminology Mapping

| Generic Term | Skills Development Term |
|-------------|------------------------|
| Student | Learner |
| Teacher | Facilitator |
| Principal | Centre Director |
| Parent | Sponsor |
| Class | Programme |
| Grade | Level |
| School | Skills Centre |
| Curriculum | Skills Programme |
| Assignment | Assessment |

## Registration Flow

### Learner Self-Registration
Since skills development targets adults (18+), learners can self-register:

1. **Sign Up** → Select "Skills Development Centre"
2. **Role Selection** → Choose "Learner"
3. **ID Verification** → Provide SA ID or passport number
4. **Age Confirmation** → Verify 18+ years
5. **Centre Selection** → Join specific centre OR browse programmes
6. **Programme Enrollment** → Enroll in available programmes

### Centre Director Setup
1. **Sign Up** → Select "Skills Development Centre"
2. **Role Selection** → Choose "Centre Director"
3. **Organization Setup**:
   - Centre name
   - SETA affiliation (if applicable)
   - Accreditation details
   - Categories/Departments offered
4. **Initial Configuration**:
   - Add facilitators
   - Create programmes
   - Set up assessment criteria

## AI Capabilities by Tier

### Free Tier
- Basic chat (10 messages/day)
- Simple progress tracking

### Starter Tier
- AI-powered progress tracking
- Lesson suggestions
- Basic reporting

### Premium Tier
- Full AI assistant access
- Predictive analytics
- Custom AI workflows
- Bulk operations

### Enterprise Tier (Custom)
- All Premium features
- Custom AI training
- API access
- White-label AI
- Dedicated AI resources

## Echo Cancellation for Voice/Video Calls

When multiple users are in the same physical room on the same call:

### Current Implementation
```typescript
const mediaConstraints = {
  audio: {
    echoCancellation: true,  // ✅ Enabled
    noiseSuppression: true,  // ✅ Enabled
  }
};
```

### Best Practices for Multi-User Same-Room Scenarios
1. **Use Headphones**: Most effective solution
2. **Designate One Device**: Have only one person join the call
3. **Mute When Not Speaking**: Reduces cross-talk pickup
4. **Physical Separation**: If multiple devices needed, sit apart
5. **Lower Speaker Volume**: Reduces microphone pickup

## Configuration Files

| File | Purpose |
|------|---------|
| `lib/types/organization.ts` | Skills Development org type definition |
| `lib/tenant/types.ts` | Organization type enum |
| `lib/tenant/terminology.ts` | Skills-specific terminology |
| `lib/dashboard/DashboardRegistry.ts` | Dashboard widget configuration |
| `components/auth/OrganizationSetup.tsx` | Organization setup form |
| `components/auth/RoleSelectionScreen.tsx` | Role selection with skills-specific options |
| `supabase/migrations/20251130_skills_development_organization_type.sql` | Database migration |

## Contact Sales for Enterprise

For large organizations with many learners, the Enterprise tier offers:
- **Custom pricing** based on organization size
- **Volume discounts** for high learner counts
- **Flexible payment terms**
- **Dedicated support**

Contact: enterprise@edudashpro.org.za

---

**Last Updated**: November 30, 2025
**Status**: ✅ Implementation Complete with Custom Enterprise Pricing
