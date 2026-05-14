-- Permet les patients créés uniquement par téléphone (OTP) sans e-mail obligatoire.
alter table public.profiles alter column email drop not null;
