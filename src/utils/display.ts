export function blankToNull(value: FormDataEntryValue | string | null) {
  const stringValue = String(value ?? '').trim()
  return stringValue === '' ? null : stringValue
}

export function currency(value: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency',
  }).format(value)
}

export function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}
