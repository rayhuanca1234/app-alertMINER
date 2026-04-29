-- Create table for storing Web Push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own subscriptions
CREATE POLICY "Users can insert their own subscriptions" 
    ON public.push_subscriptions 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own subscriptions
CREATE POLICY "Users can view their own subscriptions" 
    ON public.push_subscriptions 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Allow users to update their own subscriptions
CREATE POLICY "Users can update their own subscriptions" 
    ON public.push_subscriptions 
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Allow users to delete their own subscriptions
CREATE POLICY "Users can delete their own subscriptions" 
    ON public.push_subscriptions 
    FOR DELETE 
    USING (auth.uid() = user_id);
