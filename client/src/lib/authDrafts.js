export function hasProtectedAuthDraft(kind, values = []) {
  if (kind !== 'create-account') return false;
  return values.some((value) => Boolean(value));
}
