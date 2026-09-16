package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.BuildConfig
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.AlertItem
import com.cinerelay.app.data.ApiException
import com.cinerelay.app.data.Bootstrap
import com.cinerelay.app.data.EventCard
import com.cinerelay.app.data.PushState
import com.cinerelay.app.push.PushManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class AppTab { LIVE, FOLLOWING, RADAR, ALERTS }

data class CineRelayUiState(
    val authenticated: Boolean = false,
    val email: String? = null,
    val tab: AppTab = AppTab.LIVE,
    val loading: Boolean = false,
    val signingIn: Boolean = false,
    val error: String? = null,
    val bootstrap: Bootstrap? = null,
    val events: List<EventCard> = emptyList(),
    val alerts: List<AlertItem> = emptyList(),
    val pushState: PushState = PushState(BuildConfig.FIREBASE_CONFIGURED),
)

class CineRelayViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val backend = app.backendClient
    private val pushManager = PushManager(application, app.sessionStore, backend)

    private val _state = MutableStateFlow(
        CineRelayUiState(
            authenticated = backend.currentSession() != null,
            email = backend.currentSession()?.email,
        ),
    )
    val state: StateFlow<CineRelayUiState> = _state.asStateFlow()

    init {
        if (_state.value.authenticated) refreshAll()
    }

    fun signIn(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _state.value = _state.value.copy(error = "Enter your CineRelay email and password")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(signingIn = true, error = null)
            runCatching {
                withContext(Dispatchers.IO) { backend.signIn(email, password) }
            }.onSuccess { session ->
                _state.value = _state.value.copy(
                    authenticated = true,
                    email = session.email,
                    signingIn = false,
                )
                refreshAll()
            }.onFailure(::handleFailure)
        }
    }

    fun signOut() {
        backend.signOut()
        _state.value = CineRelayUiState(pushState = PushState(BuildConfig.FIREBASE_CONFIGURED))
    }

    fun selectTab(tab: AppTab) {
        if (_state.value.tab == tab) return
        _state.value = _state.value.copy(tab = tab, error = null)
        refresh()
    }

    fun refresh() {
        if (!_state.value.authenticated || _state.value.loading) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching {
                withContext(Dispatchers.IO) {
                    when (_state.value.tab) {
                        AppTab.LIVE -> LoadResult.Events(backend.eventFeed("live"))
                        AppTab.FOLLOWING -> LoadResult.Events(backend.eventFeed("following"))
                        AppTab.RADAR -> LoadResult.Events(backend.eventFeed("radar"))
                        AppTab.ALERTS -> LoadResult.Alerts(backend.alerts())
                    }
                }
            }.onSuccess { result ->
                _state.value = when (result) {
                    is LoadResult.Events -> _state.value.copy(loading = false, events = result.items, alerts = emptyList())
                    is LoadResult.Alerts -> _state.value.copy(loading = false, alerts = result.items, events = emptyList())
                }
            }.onFailure(::handleFailure)
        }
    }

    fun toggleFollow(card: EventCard) {
        if (card.entityId.isBlank()) return
        viewModelScope.launch {
            val desired = !card.followed
            runCatching {
                withContext(Dispatchers.IO) { backend.setFollow(card.entityId, desired) }
            }.onSuccess {
                _state.value = _state.value.copy(
                    events = _state.value.events.map {
                        if (it.entityId == card.entityId) it.copy(followed = desired) else it
                    },
                    bootstrap = _state.value.bootstrap?.let { value ->
                        value.copy(followCount = (value.followCount + if (desired) 1 else -1).coerceAtLeast(0))
                    },
                    error = null,
                )
                if (_state.value.tab == AppTab.FOLLOWING && !desired) refresh()
            }.onFailure(::handleFailure)
        }
    }

    fun registerPush() {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching {
                withContext(Dispatchers.IO) { pushManager.registerCurrentDevice() }
            }.onSuccess { push ->
                _state.value = _state.value.copy(loading = false, pushState = push)
            }.onFailure(::handleFailure)
        }
    }

    private fun refreshAll() {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { backend.bootstrap() }
            }.onSuccess { bootstrap ->
                _state.value = _state.value.copy(
                    authenticated = true,
                    email = bootstrap.email ?: _state.value.email,
                    bootstrap = bootstrap,
                    error = null,
                )
                refresh()
            }.onFailure(::handleFailure)
        }
    }

    private fun handleFailure(error: Throwable) {
        if (error is ApiException && error.statusCode == 401) {
            backend.signOut()
            _state.value = CineRelayUiState(
                authenticated = false,
                error = "Your session expired. Sign in again.",
                pushState = PushState(BuildConfig.FIREBASE_CONFIGURED),
            )
            return
        }
        _state.value = _state.value.copy(
            loading = false,
            signingIn = false,
            error = error.message ?: "Something went wrong",
        )
    }

    private sealed interface LoadResult {
        data class Events(val items: List<EventCard>) : LoadResult
        data class Alerts(val items: List<AlertItem>) : LoadResult
    }
}
