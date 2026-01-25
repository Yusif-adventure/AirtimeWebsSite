-- 1. Create a table for Networks (MTN, Telecel, etc.)
create table public.networks (
  id text primary key, -- e.g., 'mtn'
  name text not null, -- e.g., 'MTN'
  color text not null, -- e.g., '#FFCC00'
  text_color text not null -- e.g., '#000000'
);

-- 2. Create a table for Data Bundles
create table public.bundles (
  id text primary key, -- e.g., 'mtn-1'
  network_id text references public.networks(id) not null,
  data_amount text not null, -- e.g., '1GB'
  price text not null, -- e.g., 'GH₵6'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Drop the table if it exists to ensure a clean slate
DROP TABLE IF EXISTS public.orders;

-- Create the Orders table
CREATE TABLE public.orders (
  id TEXT PRIMARY KEY,                       -- Order ID (e.g., 'ord_123...')
  network TEXT NOT NULL,                     -- Network (e.g., 'MTN', 'Telecel')
  bundle_data TEXT NOT NULL,                 -- The Item Bought (e.g., '1GB')
  amount NUMERIC NOT NULL,                   -- Amount Paid (e.g., 6.00)
  recipient_number TEXT NOT NULL,            -- Who receives the airtime
  payment_number TEXT NOT NULL,              -- Buyer's Phone Number
  email TEXT,                                -- Buyer's Email (Optional but good for Paystack)
  status TEXT DEFAULT 'pending_payment',     -- pending_payment, paid, processing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- LOW SECURITY POLICY (FOR DEV): Allow anyone to read orders
CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
-- LOW SECURITY POLICY (FOR DEV): Allow anyone to insert/update
CREATE POLICY "Public write orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update orders" ON public.orders FOR UPDATE USING (true);

  ('mtn', 'MTN', '#FFCC00', '#000000'),
  ('telecel', 'Telecel', '#E30613', '#FFFFFF'),
  ('airteltigo', 'AirtelTigo', '#ED1C24', '#FFFFFF');

insert into public.bundles (id, network_id, data_amount, price) values
  -- MTN
  ('mtn-1', 'mtn', '1GB', 'GH₵6'),
  ('mtn-2', 'mtn', '2GB', 'GH₵11.5'),
  ('mtn-3', 'mtn', '3GB', 'GH₵16'),
  ('mtn-4', 'mtn', '5GB', 'GH₵25'),
  ('mtn-5', 'mtn', '10GB', 'GH₵50'),
  ('mtn-6', 'mtn', '20GB', 'GH₵95'),
  -- Telecel
  ('telecel-1', 'telecel', '1GB', 'GH₵7'),
  ('telecel-2', 'telecel', '3GB', 'GH₵18'),
  ('telecel-3', 'telecel', '5GB', 'GH₵23'),
  ('telecel-4', 'telecel', '10GB', 'GH₵50'),
  ('telecel-5', 'telecel', '15GB', 'GH₵60'),
  ('telecel-6', 'telecel', '25GB', 'GH₵100'),
  -- AirtelTigo
  ('airteltigo-1', 'airteltigo', '1GB', 'GH₵5'),
  ('airteltigo-2', 'airteltigo', '2GB', 'GH₵10'),
  ('airteltigo-3', 'airteltigo', '5GB', 'GH₵22'),
  ('airteltigo-4', 'airteltigo', '10GB', 'GH₵45'),
  ('airteltigo-5', 'airteltigo', '15GB', 'GH₵65'),
  ('airteltigo-6', 'airteltigo', '30GB', 'GH₵120');
