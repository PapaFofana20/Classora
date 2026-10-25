-- 00028 : correctif app_random_code — inscription de directeur cassée.
-- La migration 00022 utilisait (gen_random_bytes(1))[0] : PostgreSQL ne
-- supporte PAS la souscription de bytea (« cannot subscript type bytea »).
-- Toute inscription de directeur (Edge Functions et API Render) échouait
-- depuis l'application de 00022. Correctif : get_byte(gen_random_bytes(1), 0),
-- identique en sémantique (octet aléatoire 0..255).

create or replace function public.app_random_code(p_length int) returns text
language plpgsql volatile parallel unsafe
set search_path = public, extensions as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_digits   constant text := '23456789';
  v_letters  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code     text;
  v_has_digit boolean;
  v_has_letter boolean;
  i int;
begin
  if p_length < 2 then
    raise exception 'Longueur minimale 2 pour garantir lettres + chiffres';
  end if;

  loop
    v_code := '';
    v_has_digit := false;
    v_has_letter := false;

    for i in 1..p_length loop
      -- 30% de chiffres, 70% de lettres (pour plus de variété)
      if get_byte(gen_random_bytes(1), 0) % 100 < 30 then
        v_code := v_code || substr(v_digits, 1 + (get_byte(gen_random_bytes(1), 0) % 8)::int, 1);
        v_has_digit := true;
      else
        v_code := v_code || substr(v_letters, 1 + (get_byte(gen_random_bytes(1), 0) % 24)::int, 1);
        v_has_letter := true;
      end if;
    end loop;

    -- Garantir au moins 1 chiffre ET 1 lettre
    if v_has_digit and v_has_letter then
      return v_code;
    end if;
    -- Sinon on recommence (très rare avec cette logique)
  end loop;
end;
$$;
