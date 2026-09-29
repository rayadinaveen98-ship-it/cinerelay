export type PushTrustLabel = 'Verified' | 'Developing' | 'Rumor' | 'Unconfirmed';

export function pushTrustLabel(verificationState: string | null | undefined): PushTrustLabel {
  switch ((verificationState ?? '').trim().toUpperCase()) {
    case 'OFFICIAL':
    case 'CONFIRMED':
      return 'Verified';
    case 'DEVELOPING':
    case 'RELIABLE_REPORT':
      return 'Developing';
    case 'RUMOR':
      return 'Rumor';
    default:
      return 'Unconfirmed';
  }
}

export function pushNotificationTitle(verificationState: string | null | undefined): string {
  const label = pushTrustLabel(verificationState);
  return label === 'Verified' ? 'CineRelay' : `CineRelay • ${label}`;
}
