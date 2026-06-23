import type { BrowserContext, Page } from 'playwright';

export interface PortalSession {
  cookies: Array<{ name: string; value: string; domain: string; path: string }>;
  lastUrl?: string;
  currentTab?: string;
}

export async function saveSession(page: Page): Promise<PortalSession> {
  const cookies = await page.context().cookies();
  return {
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    })),
    lastUrl: page.url(),
  };
}

export async function restoreSession(
  context: BrowserContext,
  session?: PortalSession | null,
): Promise<void> {
  if (!session?.cookies?.length) return;
  await context.addCookies(
    session.cookies.map((c) => ({
      ...c,
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    })),
  );
}
