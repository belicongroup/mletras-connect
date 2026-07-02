export interface PasswordChecks {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  match: boolean;
}

export function getPasswordChecks(password: string, confirmPassword: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    match: password.length > 0 && password === confirmPassword,
  };
}

export function isPasswordValid(checks: PasswordChecks): boolean {
  return (
    checks.minLength && checks.uppercase && checks.lowercase && checks.number && checks.match
  );
}
