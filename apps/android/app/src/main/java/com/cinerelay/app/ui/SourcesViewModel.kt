package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
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
    private val sourcesClient = SourcesClient()
    private var directoryRequest = 0
    private var feedRequest = 0

    private val _state = MutableStateFlow(SourcesUiState())
    val state: StateFlow<SourcesUiState> = _state.asStateFlow()

    fun load(platform: NewsroomPlatform, force: Boolean = false) {
        val current = _state.value
        if (!force && current.platform == platform && current.sources.isNotEmpty()) return
        val requestId = ++directoryRequest
        ++feedRequest

        viewModelScope.launch {
            _state.value = current.copy(
                platform = platform,
                loading = true,
                selectedSource = if (current.platform == platform) current.selectedSource else null,
                selectedSignals = if (current.platform == platform) current.selectedSignals else emptyList(),
                error = null,
            )
            runCatching {
                withContext(Dispatchers.IO) { sourcesClient.sources(platform.name) }
            }.onSuccess { directory ->
                if (requestId != directoryRequest) return@onSuccess
                _state.value = _state.value.copy(
                    loading = false,
                    sourceCount = directory.sourceCount,
                    activeInLast24h = directory.activeInLast24h,
                    newItems24h = directory.newItems24h,
                    sources = directory.items,
                    error = null,
                )
            }.onFailure { error ->
                if (requestId != directoryRequest) return@onFailure
                _state.value = _state.value.copy(
                    loading = false,
                    error = error.message ?: "Could not load sources",
                )
            }
        }
    }

    fun refresh() {
        val selected = _state.value.selectedSource
        if (selected != null) openSource(selected) else load(_state.value.platform, force = true)
    }

    fun openSource(source: SourceDirectoryItem) {
        val platform = _state.value.platform
        val requestId = ++feedRequest
        _state.value = _state.value.copy(
            selectedSource = source,
            selectedSignals = emptyList(),
            loading = true,
            error = null,
        )

        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    sourcesClient.sourceFeed(platform.name, source.identityId, 100)
                }
            }.onSuccess { signals ->
                if (requestId != feedRequest || _state.value.selectedSource?.identityId != source.identityId) return@onSuccess
                _state.value = _state.value.copy(
                    loading = false,
                    selectedSignals = signals,
                    error = null,
                )
            }.onFailure { error ->
                if (requestId != feedRequest || _state.value.selectedSource?.identityId != source.identityId) return@onFailure
                _state.value = _state.value.copy(
                    loading = false,
                    selectedSignals = emptyList(),
                    error = error.message ?: "Could not load this source feed",
                )
            }
        }
    }

    fun closeSource() {
        ++feedRequest
        _state.value = _state.value.copy(
            selectedSource = null,
            selectedSignals = emptyList(),
            loading = false,
            error = null,
        )
    }
}
