package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.ApiException
import com.cinerelay.app.data.OttProvider
import com.cinerelay.app.data.OttRelease
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.DayOfWeek
import java.time.LocalDate

enum class OttWindow(val apiValue: String) {
    TODAY("today"),
    THIS_WEEK("this_week"),
    UPCOMING("next_30_days"),
    RELEASED("released"),
}

enum class OttContentType(val apiValue: String?) {
    ALL(null),
    MOVIES("MOVIE"),
    SERIES("SERIES"),
}

enum class OttEvidenceFilter(val apiValue: String?) {
    ALL(null),
    CONFIRMED("CONFIRMED"),
    REPORTED("REPORTED"),
    TBA("TBA"),
}

data class OttUiState(
    val loading: Boolean = false,
    val loaded: Boolean = false,
    val window: OttWindow = OttWindow.UPCOMING,
    val providerCode: String? = null,
    val language: String? = null,
    val contentType: OttContentType = OttContentType.ALL,
    val evidence: OttEvidenceFilter = OttEvidenceFilter.ALL,
    val providers: List<OttProvider> = emptyList(),
    val items: List<OttRelease> = emptyList(),
    val todayItems: List<OttRelease> = emptyList(),
    val weekendItems: List<OttRelease> = emptyList(),
    val nowStreamingItems: List<OttRelease> = emptyList(),
    val upcomingItems: List<OttRelease> = emptyList(),
    val today: String? = null,
    val weekendStart: String? = null,
    val weekendEnd: String? = null,
    val windowEnd: String? = null,
    val error: String? = null,
)

class OttViewModelV054(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val client = app.ottCalendarClient

    private val _state = MutableStateFlow(OttUiState())
    val state: StateFlow<OttUiState> = _state.asStateFlow()

    fun load(force: Boolean = false) {
        val current = _state.value
        if (current.loading) return
        if (force && current.loaded) {
            refresh()
            return
        }
        // Reopening OTT always asks the backend again. OTT announcements can change
        // throughout the day, so the consumer surface should never be a stale
        // process-lifetime snapshot.
        refresh()
    }

    fun refresh() {
        val current = _state.value
        if (current.loading) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val request = _state.value
            runCatching {
                withContext(Dispatchers.IO) {
                    val todayFeed = client.ott(
                        window = OttWindow.TODAY.apiValue,
                        providerCode = request.providerCode,
                        language = request.language,
                        contentType = request.contentType.apiValue,
                        evidenceStatus = request.evidence.apiValue,
                        limit = 75,
                    )
                    val upcomingFeed = client.ott(
                        window = OttWindow.UPCOMING.apiValue,
                        providerCode = request.providerCode,
                        language = request.language,
                        contentType = request.contentType.apiValue,
                        evidenceStatus = request.evidence.apiValue,
                        limit = 100,
                    )
                    val releasedFeed = client.ott(
                        window = OttWindow.RELEASED.apiValue,
                        providerCode = request.providerCode,
                        language = request.language,
                        contentType = request.contentType.apiValue,
                        evidenceStatus = request.evidence.apiValue,
                        limit = 100,
                    )
                    Triple(todayFeed, upcomingFeed, releasedFeed)
                }
            }.onSuccess { (todayFeed, upcomingFeed, releasedFeed) ->
                val todayIso = todayFeed.today ?: upcomingFeed.today ?: releasedFeed.today
                val todayDate = todayIso?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
                val weekend = weekendRangeV060(todayIso)
                val weekendItems = if (weekend == null) {
                    emptyList()
                } else {
                    upcomingFeed.items.filter { release ->
                        val date = release.releaseDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
                        date != null && !date.isBefore(weekend.first) && !date.isAfter(weekend.second)
                    }
                }.distinctBy { it.id }
                val weekendIds = weekendItems.mapTo(mutableSetOf()) { it.id }
                val todayIds = todayFeed.items.mapTo(mutableSetOf()) { it.id }
                val nowStreamingItems = releasedFeed.items
                    .filter { it.id !in todayIds }
                    .sortedWith(
                        compareByDescending<OttRelease> { it.lastVerifiedAt ?: it.firstObservedAt ?: "" }
                            .thenBy { it.entity.name },
                    )
                    .distinctBy { it.id }
                    .take(30)
                val upcomingItems = upcomingFeed.items.filter { release ->
                    val date = release.releaseDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
                    date != null &&
                        (todayDate == null || date.isAfter(todayDate)) &&
                        release.id !in weekendIds
                }.distinctBy { it.id }
                val allItems = (todayFeed.items + weekendItems + nowStreamingItems + upcomingItems).distinctBy { it.id }
                val providers = (upcomingFeed.providers + todayFeed.providers + releasedFeed.providers).distinctBy { it.code }

                _state.value = _state.value.copy(
                    loading = false,
                    loaded = true,
                    providers = providers,
                    items = allItems,
                    todayItems = todayFeed.items.distinctBy { it.id },
                    weekendItems = weekendItems,
                    nowStreamingItems = nowStreamingItems,
                    upcomingItems = upcomingItems,
                    today = todayIso,
                    weekendStart = weekend?.first?.toString(),
                    weekendEnd = weekend?.second?.toString(),
                    windowEnd = upcomingFeed.windowEnd,
                    error = null,
                )
            }.onFailure(::handleFailure)
        }
    }

    // Kept for call-site compatibility while OTT is now organized into fixed consumer sections.
    fun selectWindow(window: OttWindow) {
        if (_state.value.window == window) return
        _state.value = _state.value.copy(window = window, error = null)
    }

    fun selectProvider(providerCode: String?) {
        val normalized = providerCode?.takeIf { it.isNotBlank() }
        if (_state.value.providerCode == normalized) return
        _state.value = _state.value.copy(providerCode = normalized, loaded = false, error = null)
        refresh()
    }

    fun selectLanguage(language: String?) {
        val normalized = language?.trim()?.lowercase()?.takeIf { it.isNotBlank() }
        if (_state.value.language == normalized) return
        _state.value = _state.value.copy(language = normalized, loaded = false, error = null)
        refresh()
    }

    fun selectContentType(contentType: OttContentType) {
        if (_state.value.contentType == contentType) return
        _state.value = _state.value.copy(contentType = contentType, loaded = false, error = null)
        refresh()
    }

    fun selectEvidence(evidence: OttEvidenceFilter) {
        if (_state.value.evidence == evidence) return
        _state.value = _state.value.copy(evidence = evidence, loaded = false, error = null)
        refresh()
    }

    private fun handleFailure(error: Throwable) {
        val message = when {
            error is ApiException && error.statusCode == 401 -> "Your session expired. Sign in again to refresh OTT releases."
            else -> error.message ?: "OTT releases could not be loaded"
        }
        _state.value = _state.value.copy(loading = false, loaded = true, error = message)
    }
}

private fun weekendRangeV060(todayIso: String?): Pair<LocalDate, LocalDate>? {
    val today = todayIso?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return null
    return when (today.dayOfWeek) {
        DayOfWeek.FRIDAY -> today to today.plusDays(2)
        DayOfWeek.SATURDAY -> today to today.plusDays(1)
        DayOfWeek.SUNDAY -> today to today
        else -> {
            val daysToFriday = (DayOfWeek.FRIDAY.value - today.dayOfWeek.value + 7) % 7
            val friday = today.plusDays(daysToFriday.toLong())
            friday to friday.plusDays(2)
        }
    }
}
