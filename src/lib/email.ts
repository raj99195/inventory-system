/**
 * email.ts — client-side welcome email via EmailJS (free tier, no backend needed).
 *
 * SETUP (one-time):
 *   1. Sign up at https://www.emailjs.com/
 *   2. Add an email service (Gmail / SMTP)
 *   3. Create a template with variables:
 *      {{to_name}}, {{to_email}}, {{temp_password}}, {{role}},
 *      {{department}}, {{designation}}, {{app_url}}
 *   4. Add to .env:
 *      VITE_EMAILJS_PUBLIC_KEY=xxx
 *      VITE_EMAILJS_SERVICE_ID=service_xxx
 *      VITE_EMAILJS_WELCOME_TEMPLATE_ID=template_xxx
 *
 * If any key is missing, sendWelcomeEmail() is a no-op (logs a warning) —
 * so local dev without EmailJS config just skips the email.
 */

import type emailjs from '@emailjs/browser';

type EmailJsApi = typeof emailjs;

let emailjsPromise: Promise<EmailJsApi> | null = null;

const isConfigured = (): boolean =>
  !!import.meta.env.VITE_EMAILJS_PUBLIC_KEY &&
  !!import.meta.env.VITE_EMAILJS_SERVICE_ID &&
  !!import.meta.env.VITE_EMAILJS_WELCOME_TEMPLATE_ID;

async function loadEmailJs(): Promise<EmailJsApi> {
  if (!emailjsPromise) {
    emailjsPromise = import('@emailjs/browser').then((mod) => {
      // v4 ships both a namespace and a default export; prefer default when present
      const api: EmailJsApi = mod.default ?? (mod as unknown as EmailJsApi);
      api.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string);
      return api;
    });
  }
  return emailjsPromise;
}

export interface WelcomeEmailParams {
  toEmail: string;
  toName?: string;
  tempPassword: string;
  role?: string;
  department?: string;
  designation?: string;
}

export interface EmailResult {
  sent: boolean;
  reason?: string;
}

export async function sendWelcomeEmail(
  params: WelcomeEmailParams
): Promise<EmailResult> {
  if (!isConfigured()) {
    console.warn('[email] EmailJS not configured — skipping welcome email');
    return { sent: false, reason: 'not-configured' };
  }

  try {
    const emailjsApi = await loadEmailJs();
    const templateParams = {
      to_name: params.toName || 'Team member',
      to_email: params.toEmail,
      temp_password: params.tempPassword,
      role: params.role || 'Employee',
      department: params.department || '—',
      designation: params.designation || '—',
      app_url:
        typeof window !== 'undefined' ? window.location.origin : '',
    };
    await emailjsApi.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID as string,
      import.meta.env.VITE_EMAILJS_WELCOME_TEMPLATE_ID as string,
      templateParams
    );
    return { sent: true };
  } catch (err) {
    console.error('[email] send failed:', err);
    return {
      sent: false,
      reason: err instanceof Error ? err.message : 'send-failed',
    };
  }
}
