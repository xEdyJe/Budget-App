-- 1. Add 'savings' to card_type enum
ALTER TYPE card_type ADD VALUE IF NOT EXISTS 'savings';

-- 2. Create Enable Banking Accounts table
CREATE TABLE enable_banking_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_uid TEXT NOT NULL UNIQUE,
  account_name TEXT,
  iban TEXT,
  currency TEXT,
  type TEXT NOT NULL, -- e.g., 'main' or 'savings'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE enable_banking_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own enable_banking_accounts" ON enable_banking_accounts FOR ALL USING (auth.uid() = user_id);

-- 4. Cleanup old GoCardless table (optional, but good practice)
DROP TABLE IF EXISTS gocardless_connections;