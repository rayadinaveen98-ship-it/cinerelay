type AdminClient = any;

type CountFilter = (query: any) => any;

async function exactCount(admin: AdminClient, table: string, filter?: CountFilter): Promise<number> {
  let query = admin.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getPushReadiness(admin: AdminClient) {
  const [devicesResult, followsResult, developingResult, pending, deferred, sent, failed, suppressed] = await Promise.all([
    admin.from('push_device_registrations').select('user_id').eq('provider', 'FCM').eq('active', true),
    admin.from('user_entity_follows').select('user_id,entity_id').eq('active', true),
    admin.from('events').select('id,primary_entity_id,priority_band').eq('status', 'ACTIVE').eq('verification_state', 'DEVELOPING'),
    exactCount(admin, 'alert_deliveries', (q) => q.eq('delivery_kind', 'PUSH').eq('status', 'PENDING')),
    exactCount(admin, 'alert_deliveries', (q) => q.eq('delivery_kind', 'PUSH').eq('status', 'DEFERRED')),
    exactCount(admin, 'alert_deliveries', (q) => q.eq('delivery_kind', 'PUSH').eq('status', 'SENT')),
    exactCount(admin, 'alert_deliveries', (q) => q.eq('delivery_kind', 'PUSH').eq('status', 'FAILED')),
    exactCount(admin, 'alert_deliveries', (q) => q.eq('delivery_kind', 'PUSH').eq('status', 'SUPPRESSED')),
  ]);

  for (const result of [devicesResult, followsResult, developingResult]) {
    if (result.error) throw result.error;
  }

  const devices = devicesResult.data ?? [];
  const follows = followsResult.data ?? [];
  const developingEvents = developingResult.data ?? [];
  const deviceUsers = new Set<string>(devices.map((row: { user_id: string }) => row.user_id));
  const followUsers = new Set<string>(follows.map((row: { user_id: string }) => row.user_id));
  const pushReadyUsers = new Set<string>([...deviceUsers].filter((userId) => followUsers.has(userId)));
  const developingEntityIds = new Set<string>(developingEvents.map((row: { primary_entity_id: string }) => row.primary_entity_id));
  const developingTargetUsers = new Set<string>(
    follows
      .filter((row: { user_id: string; entity_id: string }) => deviceUsers.has(row.user_id) && developingEntityIds.has(row.entity_id))
      .map((row: { user_id: string }) => row.user_id),
  );

  return {
    activeFcmDevices: devices.length,
    activeDeviceUsers: deviceUsers.size,
    activeFollows: follows.length,
    activeFollowUsers: followUsers.size,
    pushReadyUsers: pushReadyUsers.size,
    canonicalDevelopingEvents: developingEvents.length,
    highPriorityDevelopingEvents: developingEvents.filter((row: { priority_band: string }) => row.priority_band === 'HIGH' || row.priority_band === 'CRITICAL').length,
    developingTargetUsers: developingTargetUsers.size,
    outbox: { pending, deferred, sent, failed, suppressed },
  };
}
