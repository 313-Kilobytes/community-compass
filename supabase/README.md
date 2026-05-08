# Supabase Setup

This project uses Supabase for authentication and user profile management.

## Setup Instructions

1. Create a new Supabase project at https://supabase.com

2. Go to Settings > API in your Supabase dashboard and copy the following values:
   - Project URL
   - Project API Key (anon/public)
   - Project API Key (service_role) - keep this secret!

3. Update your `.env.local` file with the Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. Run the SQL migration in your Supabase SQL editor:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase/migrations/001_initial_setup.sql`
   - Run the migration

## Database Schema

The migration creates:
- `profiles` table with user profile information
- Row Level Security policies for data protection
- Triggers for automatic profile creation and timestamp updates

## Authentication Flow

- Users sign up with email/password through Supabase Auth
- Profile data is stored in the `profiles` table
- Authentication state is managed through Supabase's auth state changes
- User sessions are automatically handled by Supabase

## Environment Variables

- `VITE_SUPABASE_URL`: Your Supabase project URL (safe to expose in client)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key (safe to expose in client)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (keep secret, server-side only)