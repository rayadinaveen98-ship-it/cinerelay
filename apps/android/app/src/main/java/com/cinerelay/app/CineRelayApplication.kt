package com.cinerelay.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.cinerelay.app.data.BackendClient
import com.cinerelay.app.data.ConsumerClient
import com.cinerelay.app.data.EvidenceClient
import com.cinerelay.app.data.IntelligenceClient
import com.cinerelay.app.data.OttCalendarClient
import com.cinerelay.app.data.SessionStore
import com.google.firebase.FirebaseApp

class CineRelayApplication : Application() {
    lateinit var sessionStore: SessionStore
        private set
    lateinit var backendClient: BackendClient
        private set
    lateinit var evidenceClient: EvidenceClient
        private set
    lateinit var intelligenceClient: IntelligenceClient
        private set
    lateinit var ottCalendarClient: OttCalendarClient
        private set
    lateinit var consumerClient: ConsumerClient
        private set

    override fun onCreate() {
        super.onCreate()
        sessionStore = SessionStore(this)
        backendClient = BackendClient(sessionStore)
        evidenceClient = EvidenceClient(sessionStore, backendClient)
        intelligenceClient = IntelligenceClient(sessionStore, backendClient)
        ottCalendarClient = OttCalendarClient(sessionStore, backendClient)
        consumerClient = ConsumerClient(sessionStore, backendClient)

        if (BuildConfig.FIREBASE_CONFIGURED && FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this)
        }
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "CineRelay alerts",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Movie, series and streaming updates you follow in CineRelay"
            enableVibration(true)
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val NOTIFICATION_CHANNEL_ID = "cinerelay_alerts"
    }
}
