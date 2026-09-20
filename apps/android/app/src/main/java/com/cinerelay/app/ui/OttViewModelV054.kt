package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.ApiException
import com.cinerelay.app.data.OttProvider
import com.cinerelay.app.data.OttRelease
import com.cinerelay.app.data.OttReleaseFeed
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

enum class OttWindow(val apiValue: String) {
    TODAY("today"),
    THIS_WEEK("this_week"),
    UPCOMING("upcoming"),
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
    val today: String? = null,
    val windowEnd: String? = null,
    val error: String? = null,
)

class OttViewModelV054(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val client = app.intelligenceClient

    private val _state = MutableStateFlow(OttUiState())
    val state: StateFlow<OttUiState> = _state.asStateFlow()

    fun load(force: Boolean = false) {
        val current = _state.value
        if (current.loading) return
        // OTT sources are continuously refreshed server-side. Reopening the OTT
        // destination should always pick up newer canonical evidence rather than
        // keeping a process-lifetime snapshot. `force` remains for call-site
        // compatibility and documents the intent when an explicit refresh is used.
        if (force || current.loaded || !current.loaded) refresh()
    }

    fun refresh() {
        val current = _state.value
        if (current.loading) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val request = _state.value
            runCatching {
                withContext(Dispatchers.IO) {
                    client.ott(
                        window = request.window.apiValue,
                        providerCode = request.providerCode,
                        language = request.language,
                        contentType = request.contentType.apiValue,
                        evidenceStatus = request.evidence.apiValue,
                        limit = 75,
                    )
                }
            }.onSuccess { feed ->
                val rolling = rollingWindow(feed, request.window)
                _state.value = _state.value.copy(
                    loading = false,
                    loaded = true,
                    providers = feed.providers,
                    items = rolling.items,
                    today = feed.today,
                    windowEnd = rolling.windowEnd,
                    error = null,
                )
            }.onFailure(::handleFailure)
        }
    }

    fun selectWindow(window: OttWindow) {
        if (_state.value.window == window) return
        _state.value = _state.value.copy(window = window, loaded = false, error = null)
        refresh()
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

    private fun rollingWindow(feed: OttReleaseFeed, window: OttWindow): RollingOttWindow {
        if (window != OttWindow.UPCOMING) return RollingOttWindow(feed.items, feed.windowEnd)
        val start = feed.today?.let(::parseDateOrNull) ?: return RollingOttWindow(feed.items, feed.windowEnd)
        val end = start.plusDays(29)
        val items = feed.items.filter { release ->
            val date = release.releaseDate?.let(::parseDateOrNull) ?: return@filter false
            !date.isBefore(start) && !date.isAfter(end)
        }
        return RollingOttWindow(items, end.toString())
    }

    private fun parseDateOrNull(value: String): LocalDate? = runCatching { LocalDate.parse(value) }.getOrNull()

    private fun handleFailure(error: Throwable) {
        val message = when {
            error is ApiException && error.statusCode == 401 -> "Your session expired. Sign in again to refresh OTT releases."
            else -> error.message ?: "OTT releases could not be loaded"
        }
        _state.value = _state.value.copy(loading = false, loaded = true, error = message)
    }

    private data class RollingOttWindow(
        val items: List<OttRelease>,
        val windowEnd: String?,
    )
}
