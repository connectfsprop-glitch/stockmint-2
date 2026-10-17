-- Create the profiles table to store user data linked to auth
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  role text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.profiles IS 'Stores role and profile information for each authenticated user.';

-- Enable Row Level Security (RLS) for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the profiles table
-- 1. Allow users to read their own profile.
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
-- 2. Allow users to update their own profile.
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
-- 3. (Optional but recommended) Allow admins to manage all profiles.
-- CREATE POLICY "Admins can manage all profiles." ON public.profiles FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
