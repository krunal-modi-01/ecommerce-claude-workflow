import { env } from '../../lib/env'

export async function sendPasswordReset(
  to: string,
  resetToken: string,
  expiresAt: Date,
): Promise<void> {
  const link = `${env.baseUrl}/reset-password?token=${resetToken}`
  console.log(
    `[email-service] Password reset for ${to}: ${link} (expires ${expiresAt.toISOString()})`,
  )
}
