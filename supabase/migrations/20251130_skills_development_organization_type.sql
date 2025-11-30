-- Skills Development Organization Type Migration
-- Adds 'skills_development' to the organization_type enum and creates
-- subscription plans specific to skills development centres
--
-- This migration supports:
-- - Skills development centres for adults (18+)
-- - Roles: Learner, Facilitator, Department Head, Centre Director
-- - SETA compliance tracking
-- - Certificate management
-- - Competency-based assessments

-- ============================================================================
-- STEP 1: Add skills_development to organization_type enum
-- ============================================================================

-- Check if enum value exists before adding
DO $$
BEGIN
    -- Add skills_development to organization_type enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'skills_development' 
        AND enumtypid = 'organization_type'::regtype
    ) THEN
        ALTER TYPE organization_type ADD VALUE 'skills_development';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Enum value already exists, do nothing
        NULL;
END
$$;

COMMENT ON TYPE organization_type IS 'Types of organizations supported by the platform. Includes skills_development for adult learners (18+)';

-- ============================================================================
-- STEP 2: Create Skills Development subscription plans
-- ============================================================================

-- Add skills-specific subscription plans
INSERT INTO public.subscription_plans (
    name, 
    tier, 
    price_monthly, 
    price_annual, 
    max_teachers, 
    max_students, 
    features, 
    is_active,
    description
)
SELECT * FROM (
    VALUES
    (
        'Skills Centre Free',
        'free',
        0,
        0,
        2,        -- 2 facilitators
        30,       -- 30 learners
        '["Basic dashboard", "Learner registration", "Certificate templates", "Email support", "Up to 3 programmes"]'::jsonb,
        TRUE,
        'Free tier for small skills development programmes'
    ),
    (
        'Skills Centre Starter',
        'starter',
        499,
        4990,
        5,        -- 5 facilitators
        100,      -- 100 learners
        '["Up to 5 facilitators", "100 learners", "AI-powered progress tracking", "Certificate generation", "WhatsApp notifications", "SETA report templates", "Email support"]'::jsonb,
        TRUE,
        'Starter plan for growing skills development centres'
    ),
    (
        'Skills Centre Premium',
        'premium',
        999,
        9990,
        20,       -- 20 facilitators
        500,      -- 500 learners
        '["Up to 20 facilitators", "500 learners", "Advanced reporting", "Competency assessment tools", "Priority support", "Custom branding", "API access", "SETA integration", "Bulk certificate generation"]'::jsonb,
        TRUE,
        'Premium plan for established skills development centres'
    ),
    (
        'Skills Centre Enterprise',
        'enterprise',
        0,        -- Custom pricing - contact sales
        0,        -- Custom pricing - contact sales
        -1,       -- Unlimited facilitators (custom)
        -1,       -- Unlimited learners (custom)
        '["Unlimited facilitators", "Unlimited learners", "Custom pricing", "Dedicated success manager", "SLA guarantee", "White-label solution", "Custom integrations", "24/7 priority support", "Full SETA compliance module", "Multi-site support", "Volume discounts available", "Contact sales for quote"]'::jsonb,
        TRUE,
        'Enterprise plan with custom pricing for large skills development organizations - contact sales'
    )
) AS new_plans (name, tier, price_monthly, price_annual, max_teachers, max_students, features, is_active, description)
WHERE NOT EXISTS (
    SELECT 1 FROM public.subscription_plans
    WHERE subscription_plans.name LIKE 'Skills Centre%'
    AND subscription_plans.tier = new_plans.tier
);

-- ============================================================================
-- STEP 3: Create skills_programmes table for programme management
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.skills_programmes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    code varchar(50),                    -- Programme code (e.g., NQF aligned code)
    description text,
    nqf_level integer,                   -- NQF level (1-10)
    credits integer,                     -- Total credits
    duration_weeks integer,              -- Duration in weeks
    seta_accredited boolean DEFAULT false,
    seta_code varchar(100),              -- SETA registration code
    department varchar(100),             -- Department/category
    max_learners integer,
    status varchar(20) DEFAULT 'active', -- active, draft, archived
    prerequisites jsonb DEFAULT '[]'::jsonb,
    learning_outcomes jsonb DEFAULT '[]'::jsonb,
    assessment_criteria jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    CONSTRAINT skills_programmes_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT skills_programmes_nqf_valid CHECK (nqf_level IS NULL OR (nqf_level >= 1 AND nqf_level <= 10))
);

CREATE INDEX IF NOT EXISTS idx_skills_programmes_org ON skills_programmes(organization_id);
CREATE INDEX IF NOT EXISTS idx_skills_programmes_status ON skills_programmes(status);
CREATE INDEX IF NOT EXISTS idx_skills_programmes_department ON skills_programmes(department);
CREATE INDEX IF NOT EXISTS idx_skills_programmes_nqf_level ON skills_programmes(nqf_level);

COMMENT ON TABLE skills_programmes IS 'Skills development programmes offered by skills centres';

-- ============================================================================
-- STEP 4: Create programme_enrollments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.programme_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id uuid NOT NULL REFERENCES skills_programmes(id) ON DELETE CASCADE,
    learner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    facilitator_id uuid REFERENCES users(id) ON DELETE SET NULL,
    enrollment_date date NOT NULL DEFAULT CURRENT_DATE,
    expected_completion_date date,
    actual_completion_date date,
    status varchar(30) DEFAULT 'enrolled', -- enrolled, in_progress, completed, withdrawn, suspended
    progress_percentage integer DEFAULT 0,
    competencies_achieved jsonb DEFAULT '[]'::jsonb,
    assessment_scores jsonb DEFAULT '[]'::jsonb,
    attendance_percentage integer,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT programme_enrollments_unique UNIQUE (programme_id, learner_id),
    CONSTRAINT programme_enrollments_progress_valid CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

CREATE INDEX IF NOT EXISTS idx_programme_enrollments_programme ON programme_enrollments(programme_id);
CREATE INDEX IF NOT EXISTS idx_programme_enrollments_learner ON programme_enrollments(learner_id);
CREATE INDEX IF NOT EXISTS idx_programme_enrollments_facilitator ON programme_enrollments(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_programme_enrollments_status ON programme_enrollments(status);

COMMENT ON TABLE programme_enrollments IS 'Learner enrollments in skills programmes';

-- ============================================================================
-- STEP 5: Create skills_certificates table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.skills_certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES programme_enrollments(id) ON DELETE CASCADE,
    certificate_number varchar(100) NOT NULL UNIQUE,
    certificate_type varchar(50) NOT NULL, -- completion, competency, attendance
    issued_date date NOT NULL DEFAULT CURRENT_DATE,
    expiry_date date,                      -- For certificates that expire
    issuer_name varchar(255),
    issuer_signature_url text,
    template_id varchar(100),
    verification_code varchar(100),        -- QR/verification code
    pdf_url text,                          -- Generated PDF URL
    competencies_covered jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    status varchar(20) DEFAULT 'active',   -- active, revoked, expired
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES auth.users(id),
    revocation_reason text
);

CREATE INDEX IF NOT EXISTS idx_skills_certificates_enrollment ON skills_certificates(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_skills_certificates_number ON skills_certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_skills_certificates_verification ON skills_certificates(verification_code);
CREATE INDEX IF NOT EXISTS idx_skills_certificates_status ON skills_certificates(status);

COMMENT ON TABLE skills_certificates IS 'Certificates issued to learners upon programme completion';

-- ============================================================================
-- STEP 6: Create competency_assessments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competency_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES programme_enrollments(id) ON DELETE CASCADE,
    assessor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assessment_date date NOT NULL DEFAULT CURRENT_DATE,
    competency_unit varchar(255) NOT NULL,
    competency_code varchar(100),
    assessment_type varchar(50) NOT NULL, -- practical, theory, portfolio, workplace
    result varchar(20) NOT NULL,          -- competent, not_yet_competent, absent
    score numeric(5,2),                   -- Optional percentage score
    feedback text,
    evidence_urls jsonb DEFAULT '[]'::jsonb,
    moderation_status varchar(20) DEFAULT 'pending', -- pending, approved, rejected
    moderated_by uuid REFERENCES users(id),
    moderated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competency_assessments_enrollment ON competency_assessments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_competency_assessments_assessor ON competency_assessments(assessor_id);
CREATE INDEX IF NOT EXISTS idx_competency_assessments_result ON competency_assessments(result);
CREATE INDEX IF NOT EXISTS idx_competency_assessments_moderation ON competency_assessments(moderation_status);

COMMENT ON TABLE competency_assessments IS 'Individual competency unit assessments for learners';

-- ============================================================================
-- STEP 7: RLS Policies for new tables
-- ============================================================================

ALTER TABLE skills_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_assessments ENABLE ROW LEVEL SECURITY;

-- Skills Programmes policies
CREATE POLICY "Users can view programmes in their organization"
ON skills_programmes FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        UNION
        SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Facilitators and admins can manage programmes"
ON skills_programmes FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM users 
        WHERE auth_user_id = auth.uid() 
        AND role IN ('admin', 'principal', 'superadmin', 'facilitator', 'centre_director', 'department_head')
    )
);

-- Programme Enrollments policies
CREATE POLICY "Learners can view their own enrollments"
ON programme_enrollments FOR SELECT
USING (
    learner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR facilitator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (
        SELECT 1 FROM users u
        JOIN skills_programmes sp ON sp.organization_id = u.organization_id
        WHERE u.auth_user_id = auth.uid()
        AND sp.id = programme_enrollments.programme_id
        AND u.role IN ('admin', 'principal', 'superadmin', 'centre_director', 'department_head')
    )
);

CREATE POLICY "Staff can manage enrollments"
ON programme_enrollments FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users u
        JOIN skills_programmes sp ON sp.organization_id = u.organization_id
        WHERE u.auth_user_id = auth.uid()
        AND sp.id = programme_enrollments.programme_id
        AND u.role IN ('admin', 'principal', 'superadmin', 'facilitator', 'centre_director', 'department_head')
    )
);

-- Skills Certificates policies
CREATE POLICY "Users can view their own certificates"
ON skills_certificates FOR SELECT
USING (
    enrollment_id IN (
        SELECT id FROM programme_enrollments WHERE learner_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    )
    OR EXISTS (
        SELECT 1 FROM programme_enrollments pe
        JOIN skills_programmes sp ON sp.id = pe.programme_id
        JOIN users u ON u.organization_id = sp.organization_id
        WHERE pe.id = skills_certificates.enrollment_id
        AND u.auth_user_id = auth.uid()
        AND u.role IN ('admin', 'principal', 'superadmin', 'facilitator', 'centre_director')
    )
);

CREATE POLICY "Staff can manage certificates"
ON skills_certificates FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM programme_enrollments pe
        JOIN skills_programmes sp ON sp.id = pe.programme_id
        JOIN users u ON u.organization_id = sp.organization_id
        WHERE pe.id = skills_certificates.enrollment_id
        AND u.auth_user_id = auth.uid()
        AND u.role IN ('admin', 'principal', 'superadmin', 'facilitator', 'centre_director')
    )
);

-- Competency Assessments policies
CREATE POLICY "Users can view assessments for their enrollments"
ON competency_assessments FOR SELECT
USING (
    enrollment_id IN (
        SELECT id FROM programme_enrollments WHERE learner_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    )
    OR assessor_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (
        SELECT 1 FROM programme_enrollments pe
        JOIN skills_programmes sp ON sp.id = pe.programme_id
        JOIN users u ON u.organization_id = sp.organization_id
        WHERE pe.id = competency_assessments.enrollment_id
        AND u.auth_user_id = auth.uid()
        AND u.role IN ('admin', 'principal', 'superadmin', 'centre_director', 'department_head')
    )
);

CREATE POLICY "Assessors and admins can manage assessments"
ON competency_assessments FOR ALL
USING (
    assessor_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (
        SELECT 1 FROM programme_enrollments pe
        JOIN skills_programmes sp ON sp.id = pe.programme_id
        JOIN users u ON u.organization_id = sp.organization_id
        WHERE pe.id = competency_assessments.enrollment_id
        AND u.auth_user_id = auth.uid()
        AND u.role IN ('admin', 'principal', 'superadmin', 'centre_director', 'department_head')
    )
);

-- ============================================================================
-- STEP 8: Helper functions for Skills Development
-- ============================================================================

-- Get learner's overall progress across all programmes
CREATE OR REPLACE FUNCTION get_learner_progress(p_learner_id uuid)
RETURNS TABLE (
    total_programmes integer,
    completed_programmes integer,
    average_progress numeric,
    total_certificates integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        COUNT(*)::integer AS total_programmes,
        COUNT(*) FILTER (WHERE status = 'completed')::integer AS completed_programmes,
        COALESCE(AVG(progress_percentage), 0)::numeric AS average_progress,
        (SELECT COUNT(*) FROM skills_certificates sc 
         JOIN programme_enrollments pe ON pe.id = sc.enrollment_id 
         WHERE pe.learner_id = p_learner_id AND sc.status = 'active')::integer AS total_certificates
    FROM programme_enrollments
    WHERE learner_id = p_learner_id;
$$;

-- Generate certificate number
CREATE OR REPLACE FUNCTION generate_certificate_number(p_organization_id uuid)
RETURNS varchar(100)
LANGUAGE plpgsql
AS $$
DECLARE
    v_prefix varchar(10);
    v_year varchar(4);
    v_sequence integer;
    v_certificate_number varchar(100);
BEGIN
    -- Get organization code prefix
    SELECT COALESCE(UPPER(LEFT(name, 3)), 'EDU')
    INTO v_prefix
    FROM organizations
    WHERE id = p_organization_id;
    
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Get next sequence number with FOR UPDATE SKIP LOCKED to handle concurrent access
    -- This prevents race conditions by locking the row we're reading
    SELECT COALESCE(MAX(seq_num), 0) + 1
    INTO v_sequence
    FROM (
        SELECT 
            CASE 
                WHEN certificate_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$')
                THEN CAST(SPLIT_PART(certificate_number, '-', 3) AS integer)
                ELSE 0
            END AS seq_num
        FROM skills_certificates sc
        JOIN programme_enrollments pe ON pe.id = sc.enrollment_id
        JOIN skills_programmes sp ON sp.id = pe.programme_id
        WHERE sp.organization_id = p_organization_id
        AND sc.certificate_number LIKE v_prefix || '-' || v_year || '-%'
        FOR UPDATE SKIP LOCKED
    ) subq;
    
    -- Handle null case
    IF v_sequence IS NULL THEN
        v_sequence := 1;
    END IF;
    
    v_certificate_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::text, 5, '0');
    
    RETURN v_certificate_number;
END;
$$;

-- ============================================================================
-- STEP 9: Triggers for updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_skills_tables_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_skills_programmes_updated ON skills_programmes;
CREATE TRIGGER trigger_skills_programmes_updated
BEFORE UPDATE ON skills_programmes
FOR EACH ROW
EXECUTE FUNCTION update_skills_tables_timestamp();

DROP TRIGGER IF EXISTS trigger_programme_enrollments_updated ON programme_enrollments;
CREATE TRIGGER trigger_programme_enrollments_updated
BEFORE UPDATE ON programme_enrollments
FOR EACH ROW
EXECUTE FUNCTION update_skills_tables_timestamp();

DROP TRIGGER IF EXISTS trigger_competency_assessments_updated ON competency_assessments;
CREATE TRIGGER trigger_competency_assessments_updated
BEFORE UPDATE ON competency_assessments
FOR EACH ROW
EXECUTE FUNCTION update_skills_tables_timestamp();

-- ============================================================================
-- STEP 10: Enterprise Custom Pricing System
-- ============================================================================

-- Create enterprise_pricing_tiers table for sales team reference
CREATE TABLE IF NOT EXISTS public.enterprise_pricing_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name varchar(100) NOT NULL,
    min_learners integer NOT NULL,
    max_learners integer,                    -- NULL means unlimited
    base_price_monthly numeric(10,2) NOT NULL,
    price_per_learner numeric(10,2) NOT NULL,
    min_facilitators integer DEFAULT 1,
    facilitator_price numeric(10,2) DEFAULT 0,
    discount_annual_percent integer DEFAULT 15,
    features jsonb DEFAULT '[]'::jsonb,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_pricing_learner_range ON enterprise_pricing_tiers(min_learners, max_learners);

COMMENT ON TABLE enterprise_pricing_tiers IS 'Enterprise custom pricing tiers for sales team reference';

-- Insert enterprise pricing tiers for sales team
INSERT INTO public.enterprise_pricing_tiers (
    tier_name, min_learners, max_learners, base_price_monthly, price_per_learner, 
    min_facilitators, facilitator_price, discount_annual_percent, features, notes
)
VALUES
-- Small Enterprise (501-1000 learners)
(
    'Enterprise Small',
    501,
    1000,
    1499.00,          -- Base price R1,499/month
    2.50,             -- R2.50 per learner above 500
    10,               -- Minimum 10 facilitators included
    50.00,            -- R50 per additional facilitator
    15,               -- 15% annual discount
    '["All Premium features", "Dedicated success manager", "Priority email support", "Custom branding", "API access", "SETA integration", "Bulk certificate generation", "Quarterly business reviews"]'::jsonb,
    'Recommended for mid-sized training centres. Example: 750 learners = R1,499 + (250 x R2.50) = R2,124/month'
),
-- Medium Enterprise (1001-2500 learners)
(
    'Enterprise Medium',
    1001,
    2500,
    2499.00,          -- Base price R2,499/month
    2.00,             -- R2.00 per learner above 1000
    25,               -- Minimum 25 facilitators included
    40.00,            -- R40 per additional facilitator
    18,               -- 18% annual discount
    '["All Small Enterprise features", "24/7 phone support", "SLA guarantee (99.9%)", "Custom integrations", "Multi-site support", "Advanced analytics", "Monthly business reviews"]'::jsonb,
    'Recommended for established training providers. Example: 1500 learners = R2,499 + (500 x R2.00) = R3,499/month'
),
-- Large Enterprise (2501-5000 learners)
(
    'Enterprise Large',
    2501,
    5000,
    3999.00,          -- Base price R3,999/month
    1.50,             -- R1.50 per learner above 2500
    50,               -- Minimum 50 facilitators included
    30.00,            -- R30 per additional facilitator
    20,               -- 20% annual discount
    '["All Medium Enterprise features", "White-label solution", "Dedicated account manager", "Custom training", "Compliance audit support", "Weekly sync calls"]'::jsonb,
    'Recommended for large SETA-accredited providers. Example: 3500 learners = R3,999 + (1000 x R1.50) = R5,499/month'
),
-- Extra Large Enterprise (5001-10000 learners)
(
    'Enterprise XL',
    5001,
    10000,
    5999.00,          -- Base price R5,999/month
    1.00,             -- R1.00 per learner above 5000
    100,              -- Minimum 100 facilitators included
    25.00,            -- R25 per additional facilitator
    22,               -- 22% annual discount
    '["All Large Enterprise features", "On-premise deployment option", "Custom feature development", "Executive sponsor", "Quarterly on-site reviews"]'::jsonb,
    'Recommended for major training institutions. Example: 7500 learners = R5,999 + (2500 x R1.00) = R8,499/month'
),
-- Mega Enterprise (10001+ learners)
(
    'Enterprise Mega',
    10001,
    NULL,             -- Unlimited
    8999.00,          -- Base price R8,999/month
    0.75,             -- R0.75 per learner above 10000
    200,              -- Minimum 200 facilitators included
    20.00,            -- R20 per additional facilitator
    25,               -- 25% annual discount
    '["All XL Enterprise features", "Unlimited everything", "Custom SLA terms", "Dedicated infrastructure", "24/7 dedicated support team", "Custom development hours included"]'::jsonb,
    'For national/multi-provincial providers. Example: 15000 learners = R8,999 + (5000 x R0.75) = R12,749/month'
);

-- Create custom_quotes table to track sales quotes
CREATE TABLE IF NOT EXISTS public.enterprise_quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name varchar(255) NOT NULL,
    contact_name varchar(255),
    contact_email varchar(255),
    contact_phone varchar(50),
    estimated_learners integer NOT NULL,
    estimated_facilitators integer NOT NULL,
    pricing_tier_id uuid REFERENCES enterprise_pricing_tiers(id),
    calculated_monthly_price numeric(10,2),
    calculated_annual_price numeric(10,2),
    discount_percent integer DEFAULT 0,
    final_monthly_price numeric(10,2),
    final_annual_price numeric(10,2),
    quote_valid_until date,
    notes text,
    status varchar(50) DEFAULT 'draft',       -- draft, sent, accepted, rejected, expired
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz,
    converted_to_subscription_id uuid
);

CREATE INDEX IF NOT EXISTS idx_enterprise_quotes_status ON enterprise_quotes(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_quotes_org ON enterprise_quotes(organization_name);

COMMENT ON TABLE enterprise_quotes IS 'Sales team quotes for enterprise customers';

-- Function to calculate enterprise pricing
CREATE OR REPLACE FUNCTION calculate_enterprise_price(
    p_learners integer,
    p_facilitators integer DEFAULT 0
)
RETURNS TABLE (
    tier_name varchar(100),
    base_price numeric(10,2),
    learner_cost numeric(10,2),
    facilitator_cost numeric(10,2),
    total_monthly numeric(10,2),
    total_annual numeric(10,2),
    annual_discount_percent integer
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_tier enterprise_pricing_tiers%ROWTYPE;
    v_extra_learners integer;
    v_extra_facilitators integer;
    v_learner_cost numeric(10,2);
    v_facilitator_cost numeric(10,2);
    v_total_monthly numeric(10,2);
BEGIN
    -- Find the appropriate pricing tier
    SELECT * INTO v_tier
    FROM enterprise_pricing_tiers
    WHERE p_learners >= min_learners
    AND (max_learners IS NULL OR p_learners <= max_learners)
    AND is_active = true
    ORDER BY min_learners DESC
    LIMIT 1;
    
    -- If no tier found, use the highest tier
    IF v_tier IS NULL THEN
        SELECT * INTO v_tier
        FROM enterprise_pricing_tiers
        WHERE is_active = true
        ORDER BY min_learners DESC
        LIMIT 1;
    END IF;
    
    -- Calculate extra learners cost
    v_extra_learners := GREATEST(0, p_learners - v_tier.min_learners);
    v_learner_cost := v_extra_learners * v_tier.price_per_learner;
    
    -- Calculate extra facilitators cost
    v_extra_facilitators := GREATEST(0, p_facilitators - v_tier.min_facilitators);
    v_facilitator_cost := v_extra_facilitators * v_tier.facilitator_price;
    
    -- Calculate total
    v_total_monthly := v_tier.base_price_monthly + v_learner_cost + v_facilitator_cost;
    
    RETURN QUERY SELECT
        v_tier.tier_name,
        v_tier.base_price_monthly,
        v_learner_cost,
        v_facilitator_cost,
        v_total_monthly,
        v_total_monthly * 12 * (1 - v_tier.discount_annual_percent::numeric / 100),
        v_tier.discount_annual_percent;
END;
$$;

-- RLS policies for pricing tables (sales team only)
ALTER TABLE enterprise_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage pricing tiers"
ON enterprise_pricing_tiers FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE auth_user_id = auth.uid() 
        AND role = 'superadmin'
    )
);

CREATE POLICY "Superadmins can view all quotes"
ON enterprise_quotes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE auth_user_id = auth.uid() 
        AND role = 'superadmin'
    )
);

CREATE POLICY "Superadmins can manage quotes"
ON enterprise_quotes FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE auth_user_id = auth.uid() 
        AND role = 'superadmin'
    )
);

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON SCHEMA public IS 'Skills Development schema migration completed. Supports adult learner programmes with SETA compliance features and enterprise custom pricing.';
