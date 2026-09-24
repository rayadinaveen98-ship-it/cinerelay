package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.ArchiveClient
import com.cinerelay.app.data.ConsumerUpdate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class ArchiveUiStateV058(
    val loading: Boolean = false,
    val loadingMore: Boolean = false,
    val items: List<ConsumerUpdate> = emptyList(),
    val page: Int = 0,
    val total: Int = 0,
    val hasMore: Boolean = false,
    val retentionDays: Int = 90,
    val query: String = "",
    val error: String? = null,
)

class ArchiveViewModelV058(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val client = ArchiveClient(app.sessionStore, app.backendClient)
    private val _state = MutableStateFlow(ArchiveUiStateV058())
    val state: StateFlow<ArchiveUiStateV058> = _state.asStateFlow()

    fun load(force: Boolean = false) {
        if (_state.value.loading) return
        if (_state.value.items.isNotEmpty() && !force) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, page = 0)
            runCatching { withContext(Dispatchers.IO) { client.page(page = 0) } }
                .onSuccess { page ->
                    _state.value = _state.value.copy(
                        loading = false,
                        items = page.items,
                        page = page.page,
                        total = page.total,
                        hasMore = page.hasMore,
                        retentionDays = page.retentionDays,
                    )
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(loading = false, error = error.message ?: "Archive unavailable")
                }
        }
    }

    fun refresh() = load(force = true)

    fun loadMore() {
        val current = _state.value
        if (current.loading || current.loadingMore || !current.hasMore) return
        viewModelScope.launch {
            _state.value = current.copy(loadingMore = true, error = null)
            val nextPage = current.page + 1
            runCatching { withContext(Dispatchers.IO) { client.page(page = nextPage) } }
                .onSuccess { page ->
                    _state.value = _state.value.copy(
                        loadingMore = false,
                        items = (_state.value.items + page.items).distinctBy { it.id },
                        page = page.page,
                        total = page.total,
                        hasMore = page.hasMore,
                        retentionDays = page.retentionDays,
                    )
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(loadingMore = false, error = error.message ?: "Could not load more")
                }
        }
    }

    fun setQuery(value: String) {
        _state.value = _state.value.copy(query = value.take(80))
    }
}
