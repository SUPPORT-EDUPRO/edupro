# EduDash Pro - Enterprise Sales Pricing Guide

## Overview

This document provides the official pricing structure for Enterprise tier subscriptions for Skills Development Centres and training institutions. Sales team members should use this guide when preparing quotes for large organizations.

## Quick Reference: Enterprise Pricing Tiers

| Tier | Learners | Base Price | Per Learner | Facilitators Included | Annual Discount |
|------|----------|------------|-------------|----------------------|-----------------|
| **Small** | 501-1,000 | R1,499/mo | R2.50 | 10 | 15% |
| **Medium** | 1,001-2,500 | R2,499/mo | R2.00 | 25 | 18% |
| **Large** | 2,501-5,000 | R3,999/mo | R1.50 | 50 | 20% |
| **XL** | 5,001-10,000 | R5,999/mo | R1.00 | 100 | 22% |
| **Mega** | 10,001+ | R8,999/mo | R0.75 | 200 | 25% |

## Detailed Pricing Structure

### 1. Enterprise Small (501-1,000 learners)

**Base Price**: R1,499/month
**Per Learner Fee**: R2.50 per learner above 500
**Facilitators Included**: 10
**Additional Facilitators**: R50/month each
**Annual Discount**: 15%

**Features Included**:
- All Premium features
- Dedicated success manager
- Priority email support
- Custom branding
- API access
- SETA integration
- Bulk certificate generation
- Quarterly business reviews

**Example Quote**:
- 750 learners, 12 facilitators
- Base: R1,499
- Learners: 250 × R2.50 = R625
- Facilitators: 2 extra × R50 = R100
- **Monthly Total**: R2,224
- **Annual (15% off)**: R22,684.80

---

### 2. Enterprise Medium (1,001-2,500 learners)

**Base Price**: R2,499/month
**Per Learner Fee**: R2.00 per learner above 1,000
**Facilitators Included**: 25
**Additional Facilitators**: R40/month each
**Annual Discount**: 18%

**Features Included**:
- All Small Enterprise features
- 24/7 phone support
- SLA guarantee (99.9% uptime)
- Custom integrations
- Multi-site support
- Advanced analytics
- Monthly business reviews

**Example Quote**:
- 1,500 learners, 30 facilitators
- Base: R2,499
- Learners: 500 × R2.00 = R1,000
- Facilitators: 5 extra × R40 = R200
- **Monthly Total**: R3,699
- **Annual (18% off)**: R36,390.24

---

### 3. Enterprise Large (2,501-5,000 learners)

**Base Price**: R3,999/month
**Per Learner Fee**: R1.50 per learner above 2,500
**Facilitators Included**: 50
**Additional Facilitators**: R30/month each
**Annual Discount**: 20%

**Features Included**:
- All Medium Enterprise features
- White-label solution
- Dedicated account manager
- Custom training (4 hours/month)
- Compliance audit support
- Weekly sync calls

**Example Quote**:
- 3,500 learners, 60 facilitators
- Base: R3,999
- Learners: 1,000 × R1.50 = R1,500
- Facilitators: 10 extra × R30 = R300
- **Monthly Total**: R5,799
- **Annual (20% off)**: R55,670.40

---

### 4. Enterprise XL (5,001-10,000 learners)

**Base Price**: R5,999/month
**Per Learner Fee**: R1.00 per learner above 5,000
**Facilitators Included**: 100
**Additional Facilitators**: R25/month each
**Annual Discount**: 22%

**Features Included**:
- All Large Enterprise features
- On-premise deployment option
- Custom feature development (8 hours/month)
- Executive sponsor
- Quarterly on-site reviews

**Example Quote**:
- 7,500 learners, 120 facilitators
- Base: R5,999
- Learners: 2,500 × R1.00 = R2,500
- Facilitators: 20 extra × R25 = R500
- **Monthly Total**: R8,999
- **Annual (22% off)**: R84,230.64

---

### 5. Enterprise Mega (10,001+ learners)

**Base Price**: R8,999/month
**Per Learner Fee**: R0.75 per learner above 10,000
**Facilitators Included**: 200
**Additional Facilitators**: R20/month each
**Annual Discount**: 25%

**Features Included**:
- All XL Enterprise features
- Unlimited everything
- Custom SLA terms
- Dedicated infrastructure
- 24/7 dedicated support team
- Custom development hours (16 hours/month)
- Board-level reporting

**Example Quote**:
- 15,000 learners, 250 facilitators
- Base: R8,999
- Learners: 5,000 × R0.75 = R3,750
- Facilitators: 50 extra × R20 = R1,000
- **Monthly Total**: R13,749
- **Annual (25% off)**: R123,741.00

---

## Pricing Calculator Formula

```
Monthly Total = Base Price 
              + (Extra Learners × Price Per Learner)
              + (Extra Facilitators × Price Per Facilitator)

Annual Total = Monthly Total × 12 × (1 - Annual Discount %)
```

## Special Discounts

### Volume Discounts (Stackable with Annual)

| Condition | Additional Discount |
|-----------|---------------------|
| Multi-year contract (2 years) | +5% |
| Multi-year contract (3 years) | +10% |
| Government/NPO organization | +10% |
| SETA-accredited provider | +5% |
| Early payment (annual upfront) | +3% |

### Maximum Combined Discount
- Maximum total discount capped at **40%**

---

## Quote Process

### Step 1: Gather Information
- Organization name and contact details
- Estimated number of learners
- Estimated number of facilitators
- Number of sites/campuses
- SETA affiliation
- Special requirements

### Step 2: Calculate Price
Use the database function:
```sql
SELECT * FROM calculate_enterprise_price(
    p_learners := 2000,    -- Number of learners
    p_facilitators := 35   -- Number of facilitators
);
```

### Step 3: Generate Quote
Create quote in the system:
```sql
INSERT INTO enterprise_quotes (
    organization_name,
    contact_name,
    contact_email,
    estimated_learners,
    estimated_facilitators,
    quote_valid_until,
    status
) VALUES (
    'ABC Training Centre',
    'John Smith',
    'john@abc.co.za',
    2000,
    35,
    CURRENT_DATE + INTERVAL '30 days',
    'draft'
);
```

### Step 4: Approval & Sending
- Quotes over R10,000/month require manager approval
- Standard quote validity: 30 days
- Custom discounts require director approval

---

## Competitor Price Comparison

| Competitor | Similar Tier | Their Price | Our Price | Savings |
|------------|--------------|-------------|-----------|---------|
| Provider A | 1000 learners | ~R4,500/mo | R2,999/mo | 33% |
| Provider B | 2500 learners | ~R7,500/mo | R4,999/mo | 33% |
| Provider C | 5000 learners | ~R12,000/mo | R6,999/mo | 42% |

---

## Objection Handling

### "It's too expensive"
- Break down the per-learner cost (as low as R0.75/learner for Mega tier)
- Compare to competitor pricing (33-42% savings)
- Highlight included features (success manager, support, etc.)
- Offer annual payment discount

### "We need time to decide"
- Quote valid for 30 days
- Offer pilot program (50 learners free for 3 months)
- Schedule follow-up demo

### "Can we get a better price?"
- Check qualification for NPO/Government discount
- Multi-year commitment discounts available
- SETA accreditation discount
- Bundle with additional services

---

## Contact Information

**Sales Team**: sales@edudashpro.org.za
**Enterprise Support**: enterprise@edudashpro.org.za
**Phone**: +27 XX XXX XXXX

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Nov 30, 2025 | Initial pricing structure |

---

**CONFIDENTIAL**: This pricing guide is for internal sales team use only. Do not share with customers.
