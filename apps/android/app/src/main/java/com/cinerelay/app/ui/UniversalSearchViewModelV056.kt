package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.ApiException
import com.cinerelay.app.data.IntelligenceHub
import com.cinerelay.app.data.UniversalSearchResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class UniversalSearchUiStateV056(
    val visible: Boolean = false,
    val query: String = "",
    val loading: Boolean = false,
    val result: UniversalSearchResult? = null,
    val hub: IntelligenceHub? = null,
    val error: String? = null,
) {
    val hasAnyResult: Boolean
        get() = result?.let {
            it.titles.isNotEmpty() || it.updates.isNotEmpty() || it.channels.isNotEmpty() || it.streaming.isNotEmpty()
        } == true
}

class UniversalSearchViewModelV056(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val searchClient = app.universalSearchClient
    private val intelligenceClient = app.intelligenceClient
    private val backend = app.backendClient
    private var searchJob: Job? = null
    private var requestGeneration = 0

    private val _state = MutableStateFlow(UniversalSearchUiStateV056())
    val state: StateFlow<UniversalSearchUiStateV056> = _state.asStateFlow()

    fun open() {
        _state.value = _state.value.copy(visible = true, error = null)
    }

    fun close() {
        searchJob?.cancel()
        ++requestGeneration
        _state.value = UniversalSearchUiStateV056()
    }

    fun back() {
        val current = _state.value
        if (current.hub != null) {
            _state.value = current.copy(hub = null, error = null)
        } else {
            close()
        }
    }

    fun updateQuery(value: String) {
        if (value.length > 80) return
        searchJob?.cancel()
        val normalized = value
        _state.value = _state.value.copy(
            query = normalized,
            result = if (normalized.trim().length < 2) null else _state.value.result,
            hub = null,
            error = null,
        )
        if (normalized.trim().length < 2) {
            ++requestGeneration
            _state.value = _state.value.copy(loading = false, result = null)
            return
        }
        searchJob = viewModelScope.launch {
            delay(280)
            searchNow()
        }
    }

    fun submitSearch() {
        searchJob?.cancel()
        searchNow()
    }

    private fun searchNow() {
        val query = _state.value.query.trim()
        if (query.length < 2) return
        val generation = ++requestGeneration
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, hub = null)
            runCatching { withContext(Dispatchers.IO) { searchClient.search(query) } }
                .onSuccess { result ->
                    if (generation != requestGeneration) return@onSuccess
                    _state.value = _state.value.copy(
                        loading = false,
                        result = result,
                        error = null,
                    )
                }
                .onFailure { error ->
                    if (generation != requestGeneration) return@onFailure
                    handleFailure(error)
                }
        }
    }

    fun openHub(entityId: String) {
        if (entityId.isBlank()) return
        val generation = ++requestGeneration
        searchJob?.cancel()
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching { withContext(Dispatchers.IO) { intelligenceClient.hub(entityId) } }
                .onSuccess { hub ->
                    if (generation != requestGeneration) return@onSuccess
                    _state.value = _state.value.copy(loading = false, hub = hub, error = null)
                }
                .onFailure { error ->
                    if (generation != requestGeneration) return@onFailure
                    handleFailure(error)
                }
        }
    }

    fun toggleFollow() {
        val hub = _state.value.hub ?: return
        val desired = !hub.entity.followed
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching {
                withContext(Dispatchers.IO) {
                    backend.setFollow(hub.entity.id, desired)
                    intelligenceClient.hub(hub.entity.id)
                }
            }.onSuccess { refreshed ->
                _state.value = _state.value.copy(loading = false, hub = refreshed, error = null)
            }.onFailure(::handleFailure)
        }
    }

    private fun handleFailure(error: Throwable) {
        val message = when {
            error is ApiException && error.statusCode == 401 -> "Your session expired. Sign in again to continue."
            else -> error.message ?: "Search is unavailable right now."
        }
        _state.value = _state.value.copy(loading = false, error = message)
    }
}
