// The Black November offer ends on 30/11/2026. From this moment (midnight, Brasília time) /black redirects to /pro.
// The Worker can override the moment with a BLACK_ENDS variable (used by the tests). An unreadable date never redirects.
export const BLACK_ENDS = '2026-12-01T00:00:00-03:00';

export function blackEnded(now = Date.now(), endsAt = BLACK_ENDS) {
  return now >= Date.parse(endsAt);
}
