package com.cinerelay.app.data

import com.cinerelay.app.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class BackendClient(
    private val sessionStore: SessionStore,
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build(),
) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY

    fun currentSession(): Session? = sessionStore.read()

    fun signOut() = sessionStore.clear()

    fun signIn(email: String, password: String): Session {
        val response = execute(
            Request.Builder()
                .url("$baseUrl/auth/v1/token?grant_type=password")
                .header("apikey", publishableKey)
                .post(
                    JSONObject()
                        .put("email", email.trim())
                        .put("password", password)
                        .toString()
                        .toRequestBody(jsonType),
                )
                .build(),
        )
        if (!response.ok) throw ApiException(response.errorMessage ?: "Sign in failed", response.code)
        return parseAndStoreSession(response.json)
    }

    fun signUp(email: String, password: String): SignUpResult {
        val response = execute(
            Request.Builder()
                .url("$baseUrl/auth/v1/signup")
                .header("apikey", publishableKey)
                .post(JSONObject().put("email", email.trim()).put("password", password).toString().toRequestBody(jsonType))
                .build(),
        )
        if (!response.ok) throw ApiException(response.errorMessage ?: "Account creation failed", response.code)

        val accessToken = response.json.optString("access_token")
        val refreshToken = response.json.optString("refresh_token")
        if (accessToken.isNotBlank() && refreshToken.isNotBlank()) {
            return SignUpResult(session = parseAndStoreSession(response.json), confirmationRequired = false)
        }

        return SignUpResult(session = null, confirmationRequired = true)
    }

    fun refreshSession(): Session {
        val current = sessionStore.read() ?: throw ApiException("No saved session", 401)
        val response = execute(
            Request.Builder()
                .url("$baseUrl/auth/v1/token?grant_type=refresh_token")
                .header("apikey", publishableKey)
                .post(JSONObject().put("refresh_token", current.refreshToken).toString().toRequestBody(jsonType))
                .build(),
        )
        if (!response.ok) {
            sessionStore.clear()
            throw ApiException(response.errorMessage ?: "Session expired", response.code)
        }
        return parseAndStoreSession(response.json)
    }

    fun bootstrap(): Bootstrap {
        val json = invokeAuthenticated("cinerelay-mobile-api", JSONObject().put("action", "bootstrap"))
        val user = json.optJSONObject("user") ?: JSONObject()
        val counts = json.optJSONObject("counts") ?: JSONObject()
        return Bootstrap(
            userId = user.optString("id"),
            email = user.optNullableString("email"),
            followCount = counts.optInt("follows", 0),
            alertCount = counts.optInt("alerts", 0),
        )
    }

    fun newsroom(platform: String = "YOUTUBE", limit: Int = 60): List<NewsroomSignal> {
        val json = invokeGuestAware(
            "cinerelay-newsroom-api",
            JSONObject()
                .put("action", "newsroom")
                .put("platform", platform.uppercase())
                .put("limit", limit.coerceIn(1, 100)),
        )
        return json.optJSONArray("items").toNewsroomSignals()
    }

    fun eventFeed(action: String, limit: Int = 40, allowGuest: Boolean = false): List<EventCard> {
        val body = JSONObject().put("action", action).put("limit", limit.coerceIn(1, 100))
        val json = if (allowGuest) invokeGuestAware("cinerelay-mobile-api", body) else invokeAuthenticated("cinerelay-mobile-api", body)
        return json.optJSONArray("items").toEventCards()
    }

    fun alerts(limit: Int = 50): List<AlertItem> {
        val json = invokeAuthenticated(
            "cinerelay-mobile-api",
            JSONObject().put("action", "alerts").put("limit", limit.coerceIn(1, 100)),
        )
        val array = json.optJSONArray("items") ?: JSONArray()
        return buildList {
            for (index in 0 until array.length()) {
                val row = array.optJSONObject(index) ?: continue
                add(
                    AlertItem(
                        id = row.optString("id"),
                        deliveryKind = row.optString("deliveryKind", "PUSH"),
                        status = row.optString("status", "PENDING"),
                        scheduledFor = row.optNullableString("scheduledFor"),
                        sentAt = row.optNullableString("sentAt"),
                        createdAt = row.optNullableString("createdAt"),
                        event = row.optJSONObject("event")?.toEventCard(),
                    ),
                )
            }
        }
    }

    fun setFollow(entityId: String, active: Boolean) {
        val result = invokeAuthenticated(
            "cinerelay-mobile-api",
            JSONObject().put("action", "setFollow").put("entityId", entityId).put("active", active),
        )
        if (!result.optBoolean("ok", false)) throw ApiException(result.optString("error", "Follow update failed"), 400)
    }

    fun registerDevice(fcmToken: String, installationId: String) {
        val result = invokeAuthenticated(
            "cinerelay-device-registration-api",
            JSONObject()
                .put("action", "register")
                .put("provider", "FCM")
                .put("targetKind", "TOKEN")
                .put("targetValue", fcmToken)
                .put("platform", "ANDROID")
                .put("installationId", installationId)
                .put("appId", "com.cinerelay.app"),
        )
        if (!result.optBoolean("ok", false)) throw ApiException(result.optString("error", "Device registration failed"), 400)
    }

    fun hasActiveDeviceRegistration(installationId: String): Boolean {
        val result = invokeAuthenticated(
            "cinerelay-device-registration-api",
            JSONObject().put("action", "list"),
        )
        if (!result.optBoolean("ok", false)) throw ApiException(result.optString("error", "Could not read device registration"), 400)
        val registrations = result.optJSONArray("registrations") ?: JSONArray()
        for (index in 0 until registrations.length()) {
            val row = registrations.optJSONObject(index) ?: continue
            if (
                row.optBoolean("active", false) &&
                row.optString("provider").equals("FCM", ignoreCase = true) &&
                row.optString("targetKind").equals("TOKEN", ignoreCase = true) &&
                row.optString("platform").equals("ANDROID", ignoreCase = true) &&
                row.optString("appId") == "com.cinerelay.app" &&
                row.optString("installationId") == installationId
            ) {
                return true
            }
        }
        return false
    }

    private fun invokeGuestAware(function: String, body: JSONObject): JSONObject {
        val session = sessionStore.read()
        if (session == null) {
            val response = invokeOnce(function, body, null)
            if (!response.ok) throw ApiException(response.errorMessage ?: "CineRelay request failed", response.code)
            return response.json
        }
        return invokeAuthenticated(function, body)
    }

    private fun invokeAuthenticated(function: String, body: JSONObject): JSONObject {
        var session = validSession()
        var response = invokeOnce(function, body, session.accessToken)
        if (response.code == 401) {
            session = refreshSession()
            response = invokeOnce(function, body, session.accessToken)
        }
        if (!response.ok) throw ApiException(response.errorMessage ?: "CineRelay request failed", response.code)
        return response.json
    }

    private fun validSession(): Session {
        val current = sessionStore.read() ?: throw ApiException("Please sign in", 401)
        val now = System.currentTimeMillis() / 1000L
        return if (current.expiresAtEpochSeconds <= now + 60L) refreshSession() else current
    }

    private fun invokeOnce(function: String, body: JSONObject, accessToken: String?): JsonResponse {
        val builder = Request.Builder()
            .url("$baseUrl/functions/v1/$function")
            .header("apikey", publishableKey)
            .header("X-Client-Info", "cinerelay-android/${BuildConfig.VERSION_NAME}")
            .post(body.toString().toRequestBody(jsonType))
        if (!accessToken.isNullOrBlank()) builder.header("Authorization", "Bearer $accessToken")
        return execute(builder.build())
    }

    private fun execute(request: Request): JsonResponse {
        try {
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = if (raw.isBlank()) JSONObject() else runCatching { JSONObject(raw) }.getOrElse { JSONObject().put("raw", raw) }
                val error = json.optNullableString("error") ?: json.optNullableString("msg") ?: json.optNullableString("message")
                return JsonResponse(response.code, response.isSuccessful, json, error)
            }
        } catch (error: IOException) {
            throw ApiException("Network unavailable: ${error.message ?: "request failed"}", -1)
        }
    }

    private fun parseAndStoreSession(json: JSONObject): Session {
        val accessToken = json.optString("access_token")
        val refreshToken = json.optString("refresh_token")
        if (accessToken.isBlank() || refreshToken.isBlank()) throw ApiException("Invalid auth response", 500)
        val user = json.optJSONObject("user") ?: JSONObject()
        val expiresIn = json.optLong("expires_in", 3600L).coerceAtLeast(60L)
        val session = Session(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = user.optString("id"),
            email = user.optNullableString("email"),
            expiresAtEpochSeconds = System.currentTimeMillis() / 1000L + expiresIn,
        )
        sessionStore.write(session)
        return session
    }

    private data class JsonResponse(
        val code: Int,
        val ok: Boolean,
        val json: JSONObject,
        val errorMessage: String?,
    )
}

data class SignUpResult(val session: Session?, val confirmationRequired: Boolean)

class ApiException(message: String, val statusCode: Int) : RuntimeException(message)

private fun JSONObject.optNullableString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
}

private fun JSONArray?.toNewsroomSignals(): List<NewsroomSignal> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            val source = row.optJSONObject("source") ?: JSONObject()
            add(
                NewsroomSignal(
                    id = row.optString("id"),
                    state = row.optString("state", "UNCONFIRMED"),
                    source = NewsroomSource(
                        name = source.optNullableString("name"),
                        authorityTier = if (source.has("authorityTier") && !source.isNull("authorityTier")) source.optInt("authorityTier") else null,
                        role = source.optNullableString("role"),
                        platform = source.optNullableString("platform"),
                        handle = source.optNullableString("handle"),
                        artworkUrl = source.optNullableString("artworkUrl"),
                    ),
                    itemType = row.optNullableString("itemType"),
                    mediaType = row.optNullableString("mediaType"),
                    languageCode = row.optNullableString("languageCode"),
                    title = row.optString("title", "Untitled source update"),
                    text = row.optNullableString("text"),
                    thumbnailUrl = row.optNullableString("thumbnailUrl"),
                    canonicalUrl = row.optNullableString("canonicalUrl"),
                    sourceObservedAt = row.optNullableString("sourceObservedAt"),
                    observedAt = row.optNullableString("observedAt"),
                    ingestedAt = row.optNullableString("ingestedAt"),
                    enrichmentState = row.optString("enrichmentState", "RAW"),
                    canonicalEvent = row.optJSONObject("canonicalEvent")?.toEventCard(),
                ),
            )
        }
    }
}

private fun JSONArray?.toEventCards(): List<EventCard> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) array.optJSONObject(index)?.let { add(it.toEventCard()) }
    }
}

private fun JSONObject.toEventCard(): EventCard {
    val evidenceJson = optJSONObject("evidence")
    val radarJson = optJSONObject("radar")
    val reasons = radarJson?.optJSONArray("reasons") ?: JSONArray()
    return EventCard(
        id = optString("id"),
        entityId = optString("entityId"),
        entityName = optNullableString("entityName"),
        entityType = optNullableString("entityType"),
        primaryLanguage = optNullableString("primaryLanguage"),
        followed = optBoolean("followed", false),
        eventType = optString("eventType"),
        verificationState = optString("verificationState"),
        priorityBand = optString("priorityBand"),
        headline = optString("headline"),
        summary = optNullableString("summary"),
        summaryStatus = optNullableString("summaryStatus"),
        evidenceCount = optInt("evidenceCount", 0),
        conflictingEvidenceCount = optInt("conflictingEvidenceCount", 0),
        status = optString("status"),
        detectedAt = optNullableString("detectedAt"),
        evidence = evidenceJson?.let {
            Evidence(
                sourceName = it.optNullableString("sourceName"),
                authorityTier = if (it.has("authorityTier") && !it.isNull("authorityTier")) it.optInt("authorityTier") else null,
                sourceRole = it.optNullableString("sourceRole"),
                platform = it.optNullableString("platform"),
                handle = it.optNullableString("handle"),
                title = it.optNullableString("title"),
                canonicalUrl = it.optNullableString("canonicalUrl"),
                publishedAt = it.optNullableString("publishedAt"),
            )
        },
        radar = radarJson?.let {
            RadarSignal(
                score = it.optInt("score", 0),
                label = it.optString("label", "NO_ACTION"),
                reasons = buildList { for (index in 0 until reasons.length()) add(reasons.optString(index)) },
            )
        },
    )
}
