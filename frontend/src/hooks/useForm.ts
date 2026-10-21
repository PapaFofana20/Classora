import { useState, type ChangeEvent } from "react";

type Errors<T> = Partial<Record<keyof T, string>>;

/** Formulaire avec validation en direct (messages en français). */
export function useForm<T extends Record<string, string>>(initial: T, validate: (values: T) => Errors<T>) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const errors = validate(values);

  const field = (key: keyof T) => ({
    value: values[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setTouched((t) => ({ ...t, [key]: true }));
    },
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    error: touched[key] ? errors[key] ?? null : null,
  });

  const touchAll = () => setTouched(Object.keys(values).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
  const set = (key: keyof T, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const reset = () => {
    setValues(initial);
    setTouched({});
  };
  const isValid = Object.keys(errors).length === 0;
  return { values, set, setValues, field, errors, isValid, touchAll, reset };
}
