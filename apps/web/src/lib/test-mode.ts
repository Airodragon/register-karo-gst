export function isTestMode(): boolean {
  return typeof window !== 'undefined' && window.__test__ === true;
}

/** True when automation runs without a visible browser window. */
export function isHeadlessAutomation(): boolean {
  return !isTestMode();
}
