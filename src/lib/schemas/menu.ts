import { z } from 'zod'

/**
 * The restaurant's payment QR, readable by billing staff so the app can show it
 * to a guest. `payment_qr_url` is a relative /media path (resolve against
 * API_BASE_URL) or null when no QR is configured.
 */
export const paymentQrResponseSchema = z.object({
  payment_qr_url: z.string().nullable(),
})

export type PaymentQrResponse = z.infer<typeof paymentQrResponseSchema>
