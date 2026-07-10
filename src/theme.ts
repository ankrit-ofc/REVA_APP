/** Shared design tokens for the staff app (single light theme for v1). */
export const colors = {
  bg: '#f4f5f7',
  surface: '#ffffff',
  border: '#e2e5ea',
  text: '#1a1d21',
  textMuted: '#6b7280',
  primary: '#2563eb',
  primaryText: '#ffffff',
  danger: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  // Order-item status accents (mirror the web OrderItemStatus palette intent).
  status: {
    PENDING_APPROVAL: '#d97706',
    NEW: '#2563eb',
    PREPARING: '#7c3aed',
    READY: '#16a34a',
    SERVED: '#6b7280',
    CANCELLED: '#9ca3af',
  } as Record<string, string>,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
}

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
}
