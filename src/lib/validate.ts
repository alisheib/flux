import { toast } from "sonner";

// ─── Email ──────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function validateEmail(email: string, fieldName = "Email"): boolean {
  if (!email.trim()) {
    toast.error(`${fieldName} is required`, { description: "Please enter a valid email address." });
    return false;
  }
  if (!isValidEmail(email)) {
    toast.error("Invalid email format", { description: `"${email}" doesn't look like a valid email address.` });
    return false;
  }
  return true;
}

// ─── Password ───────────────────────────────────────────────────────────

export function validatePassword(password: string): boolean {
  if (!password) {
    toast.error("Password is required");
    return false;
  }
  if (password.length < 8) {
    toast.error("Password too short", { description: "Must be at least 8 characters." });
    return false;
  }
  if (!/[A-Z]/.test(password)) {
    toast.error("Weak password", { description: "Must contain at least one uppercase letter (A-Z)." });
    return false;
  }
  if (!/[a-z]/.test(password)) {
    toast.error("Weak password", { description: "Must contain at least one lowercase letter (a-z)." });
    return false;
  }
  if (!/[0-9]/.test(password)) {
    toast.error("Weak password", { description: "Must contain at least one number (0-9)." });
    return false;
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    toast.error("Weak password", { description: "Must contain at least one special character (!@#$%^&*)." });
    return false;
  }
  return true;
}

// ─── Required text ──────────────────────────────────────────────────────

export function validateRequired(value: string, fieldName: string): boolean {
  if (!value.trim()) {
    toast.error(`${fieldName} is required`, { description: `Please fill in the ${fieldName.toLowerCase()} field.` });
    return false;
  }
  return true;
}

// ─── Numbers only ───────────────────────────────────────────────────────

export function validateNumber(value: string | number, fieldName: string, opts?: { min?: number; max?: number; allowZero?: boolean }): boolean {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) {
    toast.error(`Invalid ${fieldName}`, { description: "Please enter a valid number." });
    return false;
  }
  if (!opts?.allowZero && num === 0) {
    toast.error(`${fieldName} cannot be zero`, { description: "Please enter a value greater than zero." });
    return false;
  }
  if (opts?.min !== undefined && num < opts.min) {
    toast.error(`${fieldName} too low`, { description: `Minimum value is ${opts.min}.` });
    return false;
  }
  if (opts?.max !== undefined && num > opts.max) {
    toast.error(`${fieldName} too high`, { description: `Maximum value is ${opts.max}.` });
    return false;
  }
  return true;
}

// ─── Phone ──────────────────────────────────────────────────────────────

export function validatePhone(phone: string): boolean {
  if (!phone) return true; // Optional
  const clean = phone.replace(/[\s\-()]/g, "");
  if (!/^\+?\d{7,15}$/.test(clean)) {
    toast.error("Invalid phone number", { description: "Please enter a valid international phone number." });
    return false;
  }
  return true;
}

// ─── Text patterns ──────────────────────────────────────────────────────

export function validateAlpha(value: string, fieldName: string): boolean {
  if (!/^[a-zA-Z\s\-'.]+$/.test(value.trim())) {
    toast.error(`Invalid ${fieldName}`, { description: `${fieldName} should only contain letters.` });
    return false;
  }
  return true;
}

export function validateSKU(value: string): boolean {
  if (!value) return true; // Optional
  if (!/^[a-zA-Z0-9\-_]+$/.test(value.trim())) {
    toast.error("Invalid SKU", { description: "SKU can only contain letters, numbers, dashes, and underscores." });
    return false;
  }
  return true;
}

// ─── Input restrictor helpers (prevent invalid keystrokes) ──────────────

export function numbersOnly(e: React.KeyboardEvent<HTMLInputElement>) {
  if (!/[\d.\-]/.test(e.key) && !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
    e.preventDefault();
  }
}

export function lettersOnly(e: React.KeyboardEvent<HTMLInputElement>) {
  if (!/[a-zA-Z\s\-']/.test(e.key) && !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
    e.preventDefault();
  }
}

export function alphanumericOnly(e: React.KeyboardEvent<HTMLInputElement>) {
  if (!/[a-zA-Z0-9\-_\s]/.test(e.key) && !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
    e.preventDefault();
  }
}
