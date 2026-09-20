package com.cinerelay.app.data

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit

data class OnThisDayMovie(
    val id: String,
    val title: String,
    val nativeTitle: String?,
    val language: String?,
    val countryCode: String?,
    val releaseDate: String,
    val releaseYear: Int,
    val yearsAgo: Int,
    val verificationStatus: String?,
    val posterUrl: String?,
    val backdropUrl: String?,
)

data class OnThisDaySnapshot(
    val selectedDate: String,
    val movies: List<OnThisDayMovie>,
)

class OnThisDayClient(
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build(),
) {
    fun load(date: String? = null, language: String? = null, limit: Int = 80): OnThisDaySnapshot {
        val query = buildList {
            date?.trim()?.takeIf { it.isNotBlank() }?.let { add("date=${encode(it)}") }
            language?.trim()?.takeIf { it.isNotBlank() }?.let { add("language=${encode(it)}") }
            add("limit=${limit.coerceIn(1, 200)}")
        }.joinToString("&")
        val request = Request.Builder()
            .url("$BASE_URL/api/on-this-day?$query")
            .header("Accept", "application/json")
            .header("User-Agent", "CineRelay-Android-OnThisDay/1.0")
            .get()
            .build()

        try {
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw ApiException("Cinema history is temporarily unavailable", response.code)
                }
                val json = runCatching { JSONObject(raw) }
                    .getOrElse { throw ApiException("Cinema history returned an invalid response", response.code) }
                val selectedDate = json.optString("selectedDate").takeIf { it.isNotBlank() }
                    ?: throw ApiException("Cinema history date is missing", response.code)
                val rows = json.optJSONArray("movies")
                val movies = buildList {
                    if (rows != null) {
                        for (index in 0 until rows.length()) {
                            val row = rows.optJSONObject(index) ?: continue
                            val id = row.optString("id")
                            val title = row.optString("title")
                            val releaseDate = row.optString("releaseDate")
                            if (id.isBlank() || title.isBlank() || releaseDate.isBlank()) continue
                            add(
                                OnThisDayMovie(
                                    id = id,
                                    title = title,
                                    nativeTitle = row.optionalOnThisDayString("nativeTitle"),
                                    language = row.optionalOnThisDayString("language"),
                                    countryCode = row.optionalOnThisDayString("countryCode"),
                                    releaseDate = releaseDate,
                                    releaseYear = row.optInt("releaseYear", releaseDate.take(4).toIntOrNull() ?: 0),
                                    yearsAgo = row.optInt("yearsAgo", 0).coerceAtLeast(0),
                                    verificationStatus = row.optionalOnThisDayString("verificationStatus"),
                                    posterUrl = row.optionalOnThisDayString("posterUrl"),
                                    backdropUrl = row.optionalOnThisDayString("backdropUrl"),
                                ),
                            )
                        }
                    }
                }
                return OnThisDaySnapshot(selectedDate = selectedDate, movies = movies)
            }
        } catch (error: IOException) {
            throw ApiException("Cinema history is temporarily unavailable", -1)
        }
    }

    private fun encode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())

    companion object {
        private const val BASE_URL = "https://cinema-and-series.rayadinaveen98.workers.dev"
    }
}

private fun JSONObject.optionalOnThisDayString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
}
