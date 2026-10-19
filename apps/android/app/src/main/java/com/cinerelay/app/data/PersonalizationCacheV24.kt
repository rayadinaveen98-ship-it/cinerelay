package com.cinerelay.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Account-scoped cache of previously server-confirmed onboarding preferences.
 * Not a source of authorization: all remote requests still use the real session.
 */
class PersonalizationCacheV24(context: Context) {
    private val prefs = context.getSharedPreferences("cinerelay_personalization_cache", Context.MODE_PRIVATE)

    fun read(userId: String): PersonalizationState? {
        if (userId.isBlank()) return null
        val raw = prefs.getString("user_$userId", null) ?: return null
        return runCatching {
            val j = JSONObject(raw)
            PersonalizationState(
                completed = j.optBoolean("completed", false),
                onboardingVersion = j.optInt("onboardingVersion", 0),
                requiredVersion = j.optInt("requiredVersion", 1),
                favoriteSourceIdentityIds = j.optJSONArray("favoriteSources").stringSetV24(),
                favoriteLanguages = j.optJSONArray("favoriteLanguages").stringSetV24(),
                availableLanguages = j.optJSONArray("languages").let { values ->
                    (0 until (values?.length() ?: 0)).mapNotNull { i ->
                        values?.optJSONObject(i)?.let {
                            PersonalizationLanguage(it.optString("code"), it.optString("label"))
                        }
                    }
                },
                availableSources = j.optJSONArray("sources").let { values ->
                    (0 until (values?.length() ?: 0)).mapNotNull { i ->
                        values?.optJSONObject(i)?.let {
                            PersonalizationSource(
                                identityId = it.optString("id"),
                                sourceId = it.optString("sourceId"),
                                name = it.optString("name"),
                                handle = it.optString("handle").ifBlank { null },
                                role = it.optString("role").ifBlank { null },
                                artworkUrl = it.optString("artwork").ifBlank { null },
                            )
                        }
                    }
                },
            )
        }.getOrNull()?.takeIf { it.completed }
    }

    fun write(userId: String, state: PersonalizationState) {
        if (userId.isBlank() || !state.completed) return
        val json = JSONObject()
            .put("completed", state.completed)
            .put("onboardingVersion", state.onboardingVersion)
            .put("requiredVersion", state.requiredVersion)
            .put("favoriteSources", JSONArray(state.favoriteSourceIdentityIds.toList()))
            .put("favoriteLanguages", JSONArray(state.favoriteLanguages.toList()))
            .put("languages", JSONArray(state.availableLanguages.map {
                JSONObject().put("code", it.code).put("label", it.label)
            }))
            .put("sources", JSONArray(state.availableSources.map {
                JSONObject().put("id", it.identityId)
                    .put("sourceId", it.sourceId)
                    .put("name", it.name)
                    .put("handle", it.handle)
                    .put("role", it.role)
                    .put("artwork", it.artworkUrl)
            }))
        prefs.edit().putString("user_$userId", json.toString()).apply()
    }

    fun clearAll() { prefs.edit().clear().commit() }
}

private fun JSONArray?.stringSetV24(): Set<String> =
    (0 until (this?.length() ?: 0)).mapNotNull { i ->
        this?.optString(i)?.takeIf { it.isNotBlank() }
    }.toSet()
