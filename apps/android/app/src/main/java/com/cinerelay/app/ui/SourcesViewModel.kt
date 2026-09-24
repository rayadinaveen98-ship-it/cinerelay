package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.NewsroomSignal
import com.cinerelay.app.data.NotificationPreferencesClient
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
    val authenticated: Boolean = false,
    val loading: Boolean = false,
    val sourceCount: Int = 0,
    val activeInLast24h: Int = 0,
    val newItems24h: Int = 0,
    val sources: List<SourceDirectoryItem> = emptyList(),
    val selectedSource: SourceDirectoryItem? = null,
    val selectedSignals: List<NewsroomSignal> = emptyList(),
    val notificationSourceIds: Set<String> = emptySet(),
    val notificationMasterEnabled: Boolean = false,
    val notificationIncludeVideos: Boolean = true,
    val notificationIncludeShorts: Boolean = false,
    val notificationSetupCompleted: Boolean = false,
    val notificationBusySourceId: String? = null,
    val error: String? = null,
)

class SourcesViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val sourcesClient = SourcesClient()
    private val notificationClient = NotificationPreferencesClient(app.sessionStore, app.backendClient)
    private var directoryRequest = 0
    private var feedRequest = 0

    private val _state = MutableStateFlow(SourcesUiState())
    val state: StateFlow<SourcesUiState> = _state.asStateFlow()

    fun load(platform: NewsroomPlatform, authenticated: Boolean = false, force: Boolean = false) {
        val current = _state.value
        if (
            !force &&
            current.platform == platform &&
            current.sources.isNotEmpty() &&
            current.authenticated == authenticated
        ) return

        val requestId = ++directoryRequest
        ++feedRequest

        viewModelScope.launch {
            _state.value = current.copy(
                platform = platform,
                authenticated = authenticated,
                loading = true,
                selectedSource = if (current.platform == platform) current.selectedSource else null,
                selectedSignals = if (current.platform == platform) current.selectedSignals else emptyList(),
                notificationSourceIds = if (authenticated && platform == NewsroomPlatform.YOUTUBE) current.notificationSourceIds else emptySet(),
                notificationMasterEnabled = if (authenticated && platform == NewsroomPlatform.YOUTUBE) current.notificationMasterEnabled else false,
                error = null,
            )
            runCatching {
                withContext(Dispatchers.IO) {
                    val directory = sourcesClient.sources(platform.name)
                    val preferences = if (authenticated && platform == NewsroomPlatform.YOUTUBE) notificationClient.get() else null
                    directory to preferences
                }
            }.onSuccess { (directory, preferences) ->
                if (requestId != directoryRequest) return@onSuccess
                _state.value = _state.value.copy(
                    loading = false,
                    sourceCount = directory.sourceCount,
                    activeInLast24h = directory.activeInLast24h,
                    newItems24h = directory.newItems24h,
                    sources = directory.items,
                    notificationSourceIds = preferences?.selectedSourceIds ?: emptySet(),
                    notificationMasterEnabled = preferences?.masterEnabled ?: false,
                    notificationIncludeVideos = preferences?.includeVideos ?: true,
                    notificationIncludeShorts = preferences?.includeShorts ?: false,
                    notificationSetupCompleted = preferences?.setupCompleted ?: false,
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
        if (selected != null) openSource(selected) else load(
            platform = _state.value.platform,
            authenticated = _state.value.authenticated,
            force = true,
        )
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

    fun toggleNotification(source: SourceDirectoryItem, enabled: Boolean) {
        val current = _state.value
        if (!current.authenticated || current.platform != NewsroomPlatform.YOUTUBE || current.notificationBusySourceId != null) return

        _state.value = current.copy(notificationBusySourceId = source.identityId, error = null)
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    notificationClient.setSource(
                        sourceIdentityId = source.identityId,
                        enabled = enabled,
                        includeVideos = current.notificationIncludeVideos,
                        includeShorts = current.notificationIncludeShorts,
                    )
                }
            }.onSuccess { preferences ->
                _state.value = _state.value.copy(
                    notificationSourceIds = preferences.selectedSourceIds,
                    notificationMasterEnabled = preferences.masterEnabled,
                    notificationIncludeVideos = preferences.includeVideos,
                    notificationIncludeShorts = preferences.includeShorts,
                    notificationSetupCompleted = preferences.setupCompleted,
                    notificationBusySourceId = null,
                    error = null,
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(
                    notificationBusySourceId = null,
                    error = error.message ?: "Could not update this source notification",
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
