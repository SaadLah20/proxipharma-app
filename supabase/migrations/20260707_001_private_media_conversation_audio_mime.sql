-- Autoriser les messages vocaux conversation dans le bucket private-media
-- (avant : images uniquement → erreur « mime type audio/webm is not supported »).

UPDATE storage.buckets
SET allowed_mime_types = array[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg'
]
WHERE id = 'private-media';
