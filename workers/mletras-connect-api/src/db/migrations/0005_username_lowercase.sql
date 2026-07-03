-- Usernames are stored lowercase for case-insensitive uniqueness.
-- If case-only duplicates already exist, disambiguate newer accounts first.
UPDATE users
SET username = username || '_' || substr(id, 1, 8)
WHERE id IN (
  SELECT u.id
  FROM users AS u
  INNER JOIN users AS o
    ON lower(o.username) = lower(u.username)
   AND o.id != u.id
   AND o.created_at < u.created_at
);

UPDATE users SET username = lower(trim(username));
