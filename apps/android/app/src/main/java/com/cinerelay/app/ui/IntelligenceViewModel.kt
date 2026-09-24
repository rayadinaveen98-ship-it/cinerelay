package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.ApiException
import com.cinerelay.app.data.IntelligenceEntity
import com.cinerelay.app.data.IntelligenceHub
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class IntelligenceUiState(
    val visible: Boolean = false,
    val query: String = "",
    val loading: Boolean = false,
    val results: List<IntelligenceEntity> = emptyList(),
    val hub: IntelligenceHub? = null,
    val error: String? = null,
)

class IntelligenceViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val client = app.intelligenceClient
    private val backend = app.backendClient

    private val _state = MutableStateFlow(IntelligenceUiState())
    val state: StateFlow<IntelligenceUiState> = _state.asStateFlow()

    fun open() {
        _state.value = _state.value.copy(visible = true, error = null)
    }

    fun close() {
        if (_state.value.loading) return
        _state.value = IntelligenceUiState()
    }

    fun back() {
        val current = _state.value
        if (current.loading) return
        _state.value = if (current.hub != null) current.copy(hub = null, error = null) else IntelligenceUiState()
    }

    fun updateQuery(value: String) {
        if (value.length > 80) return
        val current = _state.value
        _state.value = current.copy(
            query = value,
            error = null,
            results = if (value.trim().length < 2) emptyList() else current.results,
        )
    }

    fun search() {
        val query = _state.value.query.trim()
        if (query.length < 2 || _state.value.loading) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, hub = null)
            runCatching { withContext(Dispatchers.IO) { client.search(query) } }
                .onSuccess { results ->
                    _state.value = _state.value.copy(
                        loading = false,
                        results = results,
                        error = null,
                    )
                }
                .onFailure(::handleFailure)
        }
    }

    fun openHub(entity: IntelligenceEntity) {
        if (entity.id.isBlank() || _state.value.loading) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching { withContext(Dispatchers.IO) { client.hub(entity.id) } }
                .onSuccess { hub ->
                    _state.value = _state.value.copy(
                        loading = false,
                        hub = hub,
                        error = null,
                    )
                }
                .onFailure(::handleFailure)
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
                    client.hub(hub.entity.id)
                }
            }.onSuccess { refreshed ->
                _state.value = _state.value.copy(loading = false, hub = refreshed, error = null)
            }.onFailure(::handleFailure)
        }
    }

    private fun handleFailure(error: Throwable) {
        val message = when {
            error is ApiException && error.statusCode == 401 -> "Your session expired. Sign in again from CineRelay."
            else -> error.message ?: "CineRelay intelligence request failed"
        }
        _state.value = _state.value.copy(loading = false, error = message)
    }
}
