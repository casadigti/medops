-- Add user_id to surgeons table to link with profiles/auth.users
ALTER TABLE surgeons ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL UNIQUE;

-- Add comment for documentation
COMMENT ON COLUMN surgeons.user_id IS 'Link to the user profile for portal access';
