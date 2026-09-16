package com.cinerelay.app.push

import android.content.Context
import com.cinerelay.app.BuildConfig
import com.cinerelay.app.data.BackendClient
import com.cinerelay.app.data.PushState
import com.cinerelay.app.data.SessionStore
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

class PushManager(
    private val context: Context,
    private val sessionStore: SessionStore,
    private val backendClient: BackendClient,
) {
    fun firebaseReady(): Boolean =
        BuildConfig.FIREBASE_CONFIGURED && FirebaseApp.getApps(context).isNotEmpty()

    suspend fun registerCurrentDevice(): PushState {
        if (!firebaseReady()) {
            return PushState(
                firebaseConfigured = false,
                registered = false,
                message = "Add google-services.json to activate the real-device FCM canary",
            )
        }
        if (sessionStore.read() == null) {
            return PushState(true, false, "Sign in before registering this device")
        }

        val token = awaitToken()
        backendClient.registerDevice(token, sessionStore.installationId())
        return PushState(true, true, "This Android device is registered with CineRelay")
    }

    suspend fun registerToken(token: String) {
        if (!firebaseReady() || sessionStore.read() == null || token.isBlank()) return
        backendClient.registerDevice(token, sessionStore.installationId())
    }

    private suspend fun awaitToken(): String = suspendCoroutine { continuation ->
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful && !task.result.isNullOrBlank()) {
                continuation.resume(task.result)
            } else {
                continuation.resumeWithException(task.exception ?: IllegalStateException("FCM token unavailable"))
            }
        }
    }
}
