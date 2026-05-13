-- Community feed persistence

CREATE TABLE IF NOT EXISTS public.community_posts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT 'Community member',
  area TEXT NOT NULL DEFAULT 'Community wide',
  region TEXT NOT NULL DEFAULT 'CBD & City Bowl',
  category TEXT NOT NULL DEFAULT 'Community Update',
  message TEXT NOT NULL,
  image TEXT,
  coords JSONB,
  anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.community_chat_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT 'Community chat',
  area TEXT NOT NULL DEFAULT 'Community wide',
  region TEXT NOT NULL DEFAULT 'CBD & City Bowl',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parent_id TEXT REFERENCES public.community_comments(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'Community member',
  text TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'CBD & City Bowl',
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.community_active_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT 'community-member',
  region TEXT NOT NULL DEFAULT 'CBD & City Bowl',
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_region ON public.community_posts(region);
CREATE INDEX IF NOT EXISTS idx_community_chat_sessions_updated_at ON public.community_chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_region ON public.community_comments(region);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent_id ON public.community_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_community_active_users_last_seen_at ON public.community_active_users(last_seen_at);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_active_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read community posts" ON public.community_posts;
CREATE POLICY "Anyone can read community posts" ON public.community_posts
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can read community chats" ON public.community_chat_sessions;
CREATE POLICY "Anyone can read community chats" ON public.community_chat_sessions
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can read community comments" ON public.community_comments;
CREATE POLICY "Anyone can read community comments" ON public.community_comments
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can read community active users" ON public.community_active_users;
CREATE POLICY "Anyone can read community active users" ON public.community_active_users
  FOR SELECT USING (TRUE);

-- Writes are performed by server routes with the service-role key after app-level validation.
