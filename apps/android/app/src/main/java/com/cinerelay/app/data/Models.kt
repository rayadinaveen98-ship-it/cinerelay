package com.cinerelay.app.data

data class Session(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String?,
    val expiresAtEpochSeconds: Long,
)

data class Evidence(
    val sourceName: String?,
    val authorityTier: Int?,
    val sourceRole: String?,
    val platform: String?,
    val handle: String?,
    val title: String?,
    val canonicalUrl: String?,
    val publishedAt: String?,
)

data class RadarSignal(
    val score: Int,
    val label: String,
    val reasons: List<String>,
)

data class EventCard(
    val id: String,
    val entityId: String,
    val entityName: String?,
    val entityType: String?,
    val primaryLanguage: String?,
    val followed: Boolean,
    val eventType: String,
    val verificationState: String,
    val priorityBand: String,
    val headline: String,
    val summary: String?,
    val summaryStatus: String?,
    val evidenceCount: Int,
    val conflictingEvidenceCount: Int,
    val status: String,
    val detectedAt: String?,
    val evidence: Evidence?,
    val radar: RadarSignal?,
)

data class AlertItem(
    val id: String,
    val deliveryKind: String,
    val status: String,
    val scheduledFor: String?,
    val sentAt: String?,
    val createdAt: String?,
    val event: EventCard?,
)

data class Bootstrap(
    val userId: String,
    val email: String?,
    val followCount: Int,
    val alertCount: Int,
)

data class PushState(
    val firebaseConfigured: Boolean,
    val registered: Boolean = false,
    val message: String = if (firebaseConfigured) "Ready to register this device" else "Firebase client config not added yet",
)
