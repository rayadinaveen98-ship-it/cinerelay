package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.NewsroomSignal
import com.cinerelay.app.data.SourceDirectoryItem
import com.cinerelay.app.data.SourcesClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class SourcesUiState(
    val platform: NewsroomPlatform = NewsroomPlatform.YOUTUBE,
    val loading: Boolean = false,
    val sourceCount: Int = 0,
    val activeInLast24h: Int = 0,
    val newItems24h: Int = 0,
    val sources: List<SourceDirectoryItem> = emptyList(),
    val selectedSource: SourceDirectoryItem? = null,
    val selectedSignals: List<NewsroomSignal> = emptyList(),
    val error: String? = null,
)

class SourcesViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val sourcesClient = SourcesClient()
    private var latestSignals: List<NewsroomSignal> = emptyList()

    private val _state = MutableStateFlow(SourcesUiState())
    val state: StateFlow<SourcesUiState> = _state.asStateFlow()

    fun load(platform: NewsroomPlatform, force: Boolean = false) {
        val current = _state.value
        if (current.loading) return
        if (!force && current.platform == platform && current.sources.isNotEmpty()) return

        viewModelScope.launch {
            _state.value = current.copy(
                platform = platform,
                loading = true,
                selectedSource = if (current.platform == platform) current.selectedSource else null,
                selectedSignals = if (current.platform == platform) current.selectedSignals else emptyList(),
                error = null,
            )
            runCatching {
                withContext(Dispatchers.IO) {
                    val directory = sourcesClient.sources(platform.name)
                    val signals = app.backendClient.newsroom(platform.name, 100)
                    directory to signals
                }
            }.onSuccess { (directory, signals) ->
                latestSignals = signals
                val selected = _state.value.selectedSource
                _state.value = _state.value.copy(
                    loading = false,
                    sourceCount = directory.sourceCount,
                    activeInLast24h = directory.activeInLast24h,
                    newItems24h = directory.newItems24h,
                    sources = directory.items,
                    selectedSignals = selected?.let { signalsFor(it, signals) } ?: emptyList(),
                    error = null,
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(
                    loading = false,
                    error = error.message ?: "Could not load sources",
                )
            }
        }
    }

    fun refresh() = load(_state.value.platform, force = true)

    fun openSource(source: SourceDirectoryItem) {
        _state.value = _state.value.copy(
            selectedSource = source,
            selectedSignals = signalsFor(source, latestSignals),
            error = null,
        )
    }

    fun closeSource() {
        _state.value = _state.value.copy(selectedSource = null, selectedSignals = emptyList())
    }

    private fun signalsFor(source: SourceDirectoryItem, signals: List<NewsroomSignal>): List<NewsroomSignal> {
        val handle = source.handle?.trim()?.lowercase()
        val name = source.name.trim().lowercase()
        return signals.filter { signal ->
            val signalHandle = signal.source.handle?.trim()?.lowercase()
            val signalName = signal.source.name?.trim()?.lowercase()
            if (!handle.isNullOrBlank()) signalHandle == handle else signalName == name
        }
    }
}
