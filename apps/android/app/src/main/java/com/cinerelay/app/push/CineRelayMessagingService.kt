package com.cinerelay.app.push

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.MainActivity
import com.cinerelay.app.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class CineRelayMessagingService : FirebaseMessagingService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val app = application as? CineRelayApplication ?: return
        serviceScope.launch {
            runCatching {
                PushManager(this@CineRelayMessagingService, app.sessionStore, app.backendClient).registerToken(token)
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return

        val eventId = message.data["eventId"]
        val rawItemId = message.data["rawItemId"]
        val canonicalUrl = message.data["canonicalUrl"]
        val sourceIdentityId = message.data["sourceIdentityId"]
        val notificationClass = message.data["notificationClass"]
        val stableTarget = eventId ?: rawItemId ?: canonicalUrl ?: message.messageId ?: "cinerelay"

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_FROM_NOTIFICATION, true)
            eventId?.takeIf { it.isNotBlank() }?.let { putExtra(EXTRA_EVENT_ID, it) }
            rawItemId?.takeIf { it.isNotBlank() }?.let { putExtra(EXTRA_RAW_ITEM_ID, it) }
            canonicalUrl?.takeIf { it.isNotBlank() }?.let { putExtra(EXTRA_CANONICAL_URL, it) }
            sourceIdentityId?.takeIf { it.isNotBlank() }?.let { putExtra(EXTRA_SOURCE_IDENTITY_ID, it) }
            notificationClass?.takeIf { it.isNotBlank() }?.let { putExtra(EXTRA_NOTIFICATION_CLASS, it) }
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            stableTarget.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val title = message.notification?.title ?: "CineRelay"
        val body = message.notification?.body ?: message.data["headline"] ?: "New movie or streaming update"
        val notification = NotificationCompat.Builder(this, CineRelayApplication.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_cinerelay_notification)
            .setColor(ContextCompat.getColor(this, R.color.cinerelay_gold))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(this).notify(message.messageId?.hashCode() ?: stableTarget.hashCode(), notification)
    }

    companion object {
        const val EXTRA_FROM_NOTIFICATION = "cinerelay.fromNotification"
        const val EXTRA_EVENT_ID = "cinerelay.eventId"
        const val EXTRA_RAW_ITEM_ID = "cinerelay.rawItemId"
        const val EXTRA_CANONICAL_URL = "cinerelay.canonicalUrl"
        const val EXTRA_SOURCE_IDENTITY_ID = "cinerelay.sourceIdentityId"
        const val EXTRA_NOTIFICATION_CLASS = "cinerelay.notificationClass"
    }
}
