interface FieldErrorProps {
  message?: string | null
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-red-400">{message}</p>
}
