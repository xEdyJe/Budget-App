-- Create Custom Types
CREATE TYPE expense_category AS ENUM ('food', 'transport', 'entertainment', 'utilities', 'other');
CREATE TYPE card_type AS ENUM ('main', 'voucher');
CREATE TYPE expense_source AS ENUM ('manual', 'gocardless', 'gmail');

-- 1. Work Days
CREATE TABLE work_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours_worked NUMERIC DEFAULT 8.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Salary Entries
CREATE TABLE salary_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC NOT NULL,
  days_worked INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Expenses
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category expense_category NOT NULL,
  card card_type NOT NULL,
  date DATE NOT NULL,
  source expense_source NOT NULL,
  external_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Card Balances
CREATE TABLE card_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  card card_type NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0.0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. GoCardless Connections
CREATE TABLE gocardless_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  requisition_id TEXT,
  account_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE work_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE gocardless_connections ENABLE ROW LEVEL SECURITY;

-- Create Policies (Users can only see/modify their own data)
CREATE POLICY "Users can manage their own work_days" ON work_days FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own salary_entries" ON salary_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own expenses" ON expenses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own card_balances" ON card_balances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own gocardless_connections" ON gocardless_connections FOR ALL USING (auth.uid() = user_id);