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
import com.cinerelay.app.data.NewsroomSignal
import com.cinerelay.app.data.PushState
import com.cinerelay.app.push.PushManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class AppTab { LIVE, FOLLOWING, RADAR, ALERTS }
enum class AuthMode { SIGN_IN, CREATE_ACCOUNT }
enum class NewsroomFilter { ALL, VERIFIED, DEVELOPING, UNCONFIRMED, CONFLICT_RUMOR }

data class CineRelayUiState(
    val authenticated: Boolean = false,
    val email: String? = null,
    val tab: AppTab = AppTab.LIVE,
    val loading: Boolean = false,
    val authBusy: Boolean = false,
    val authMode: AuthMode? = null,
    val notice: String? = null,
    val error: String? = null,
    val bootstrap: Bootstrap? = null,
    val newsroomFilter: NewsroomFilter = NewsroomFilter.ALL,
    val newsroomFilterCounts: Map<NewsroomFilter, Int> = emptyMap(),
    val newsroomSignals: List<NewsroomSignal> = emptyList(),
    val events: List<EventCard> = emptyList(),
    val alerts: List<AlertItem> = emptyList(),
    val pushState: PushState = PushState(BuildConfig.FIREBASE_CONFIGURED),
)

class CineRelayViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val backend = app.backendClient
    private val pushManager = PushManager(application, app.sessionStore, backend)
    private var latestNewsroomSignals: List<NewsroomSignal> = emptyList()

    private val existingSession = backend.currentSession()
    private val _state = MutableStateFlow(
        CineRelayUiState(
            authenticated = existingSession != null,
            email = existingSession?.email,
        ),
    )
    val state: StateFlow<CineRelayUiState> = _state.asStateFlow()

    init {
        if (_state.value.authenticated) refreshAll() else refresh()
    }

    fun openAuth(mode: AuthMode = AuthMode.SIGN_IN) {
        _state.value = _state.value.copy(authMode = mode, error = null, notice = null)
    }

    fun closeAuth() {
        if (_state.value.authBusy) return
        _state.value = _state.value.copy(authMode = null, error = null, notice = null)
    }

    fun switchAuthMode(mode: AuthMode) {
        if (_state.value.authBusy) return
        _state.value = _state.value.copy(authMode = mode, error = null, notice = null)
    }

    fun setNewsroomFilter(filter: NewsroomFilter) {
        if (_state.value.newsroomFilter == filter) return
        _state.value = _state.value.copy(
            newsroomFilter = filter,
            newsroomSignals = filterNewsroom(latestNewsroomSignals, filter),
        )
    }

    fun signIn(email: String, password: String) {
        if (!validCredentials(email, password)) return
        viewModelScope.launch {
            _state.value = _state.value.copy(authBusy = true, error = null, notice = null)
            runCatching { withContext(Dispatchers.IO) { backend.signIn(email, password) } }
                .onSuccess { session ->
                    _state.value = _state.value.copy(
                        authenticated = true,
                        email = session.email,
                        authBusy = false,
                        authMode = null,
                        notice = "Signed in. Following and alerts are now unlocked.",
                    )
                    refreshAll()
                }
                .onFailure(::handleFailure)
        }
    }

    fun createAccount(email: String, password: String) {
        if (!validCredentials(email, password)) return
        viewModelScope.launch {
            _state.value = _state.value.copy(authBusy = true, error = null, notice = null)
            runCatching { withContext(Dispatchers.IO) { backend.signUp(email, password) } }
                .onSuccess { result ->
                    val session = result.session
                    if (session != null) {
                        _state.value = _state.value.copy(
                            authenticated = true,
                            email = session.email,
                            authBusy = false,
                            authMode = null,
                            notice = "Account created. Welcome to CineRelay.",
                        )
                        refreshAll()
                    } else {
                        _state.value = _state.value.copy(
                            authBusy = false,
                            authMode = AuthMode.SIGN_IN,
                            notice = "Account created. Check your email to confirm it, then sign in.",
                            error = null,
                        )
                    }
                }
                .onFailure(::handleFailure)
        }
    }

    fun signOut() {
        backend.signOut()
        latestNewsroomSignals = emptyList()
        _state.value = CineRelayUiState(
            tab = AppTab.LIVE,
            notice = "Signed out. You can keep exploring as a guest.",
            pushState = PushState(BuildConfig.FIREBASE_CONFIGURED),
        )
        refresh()
    }

    fun selectTab(tab: AppTab) {
        if (_state.value.tab == tab) return
        _state.value = _state.value.copy(tab = tab, error = null, notice = null)
        if (!_state.value.authenticated && tab.requiresAccount()) {
            _state.value = _state.value.copy(newsroomSignals = emptyList(), events = emptyList(), alerts = emptyList())
            return
        }
        refresh()
    }

    fun refresh() {
        if (_state.value.loading) return
        if (!_state.value.authenticated && _state.value.tab.requiresAccount()) return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching {
                withContext(Dispatchers.IO) {
                    when (_state.value.tab) {
                        AppTab.LIVE -> LoadResult.Newsroom(backend.newsroom())
                        AppTab.FOLLOWING -> LoadResult.Events(backend.eventFeed("following"))
                        AppTab.RADAR -> LoadResult.Events(backend.eventFeed("radar", allowGuest = true))
                        AppTab.ALERTS -> LoadResult.Alerts(backend.alerts())
                    }
                }
            }.onSuccess { result ->
                _state.value = when (result) {
                    is LoadResult.Newsroom -> {
                        latestNewsroomSignals = result.items
                        _state.value.copy(
                            loading = false,
                            newsroomFilterCounts = newsroomCounts(result.items),
                            newsroomSignals = filterNewsroom(result.items, _state.value.newsroomFilter),
                            events = emptyList(),
                            alerts = emptyList(),
                        )
                    }
                    is LoadResult.Events -> _state.value.copy(
                        loading = false,
                        newsroomSignals = emptyList(),
                        events = result.items,
                        alerts = emptyList(),
                    )
                    is LoadResult.Alerts -> _state.value.copy(
                        loading = false,
                        newsroomSignals = emptyList(),
                        alerts = result.items,
                        events = emptyList(),
                    )
                }
            }.onFailure(::handleFailure)
        }
    }

    fun toggleFollow(card: EventCard) {
        if (!_state.value.authenticated) {
            openAuth(AuthMode.CREATE_ACCOUNT)
            return
        }
        if (card.entityId.isBlank()) return
        viewModelScope.launch {
            val desired = !card.followed
            runCatching { withContext(Dispatchers.IO) { backend.setFollow(card.entityId, desired) } }
                .onSuccess {
                    latestNewsroomSignals = latestNewsroomSignals.map { signal ->
                        val event = signal.canonicalEvent
                        if (event?.entityId == card.entityId) signal.copy(canonicalEvent = event.copy(followed = desired)) else signal
                    }
                    _state.value = _state.value.copy(
                        newsroomSignals = filterNewsroom(latestNewsroomSignals, _state.value.newsroomFilter),
                        events = _state.value.events.map { item ->
                            if (item.entityId == card.entityId) item.copy(followed = desired) else item
                        },
                        bootstrap = _state.value.bootstrap?.let { value ->
                            value.copy(followCount = (value.followCount + if (desired) 1 else -1).coerceAtLeast(0))
                        },
                        error = null,
                    )
                    if (_state.value.tab == AppTab.FOLLOWING && !desired) refresh()
                }
                .onFailure(::handleFailure)
        }
    }

    fun registerPush() {
        if (!_state.value.authenticated) {
            openAuth(AuthMode.SIGN_IN)
            return
        }
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching { withContext(Dispatchers.IO) { pushManager.registerCurrentDevice() } }
                .onSuccess { push -> _state.value = _state.value.copy(loading = false, pushState = push) }
                .onFailure(::handleFailure)
        }
    }

    private fun refreshAll() {
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { backend.bootstrap() } }
                .onSuccess { bootstrap ->
                    _state.value = _state.value.copy(
                        authenticated = true,
                        email = bootstrap.email ?: _state.value.email,
                        bootstrap = bootstrap,
                        error = null,
                    )
                    refresh()
                }
                .onFailure(::handleFailure)
        }
    }

    private fun validCredentials(email: String, password: String): Boolean {
        if (!email.contains('@') || email.substringAfter('@').isBlank()) {
            _state.value = _state.value.copy(error = "Enter a valid email address")
            return false
        }
        if (password.length < 6) {
            _state.value = _state.value.copy(error = "Password must be at least 6 characters")
            return false
        }
        return true
    }

    private fun handleFailure(error: Throwable) {
        if (error is ApiException && error.statusCode == 401 && _state.value.authenticated) {
            backend.signOut()
            latestNewsroomSignals = emptyList()
            _state.value = CineRelayUiState(
                authenticated = false,
                tab = AppTab.LIVE,
                error = "Your session expired. You can keep exploring as a guest or sign in again.",
                pushState = PushState(BuildConfig.FIREBASE_CONFIGURED),
            )
            refresh()
            return
        }
        _state.value = _state.value.copy(
            loading = false,
            authBusy = false,
            error = error.message ?: "Something went wrong",
        )
    }

    private sealed interface LoadResult {
        data class Newsroom(val items: List<NewsroomSignal>) : LoadResult
        data class Events(val items: List<EventCard>) : LoadResult
        data class Alerts(val items: List<AlertItem>) : LoadResult
    }
}

private fun filterNewsroom(items: List<NewsroomSignal>, filter: NewsroomFilter): List<NewsroomSignal> = when (filter) {
    NewsroomFilter.ALL -> items
    NewsroomFilter.VERIFIED -> items.filter { it.state == "VERIFIED" }
    NewsroomFilter.DEVELOPING -> items.filter { it.state == "DEVELOPING" }
    NewsroomFilter.UNCONFIRMED -> items.filter { it.state == "UNCONFIRMED" }
    NewsroomFilter.CONFLICT_RUMOR -> items.filter { it.state == "CONFLICT_RUMOR" }
}

private fun newsroomCounts(items: List<NewsroomSignal>): Map<NewsroomFilter, Int> = buildMap {
    put(NewsroomFilter.ALL, items.size)
    put(NewsroomFilter.VERIFIED, items.count { it.state == "VERIFIED" })
    put(NewsroomFilter.DEVELOPING, items.count { it.state == "DEVELOPING" })
    put(NewsroomFilter.UNCONFIRMED, items.count { it.state == "UNCONFIRMED" })
    put(NewsroomFilter.CONFLICT_RUMOR, items.count { it.state == "CONFLICT_RUMOR" })
}

private fun AppTab.requiresAccount(): Boolean = this == AppTab.FOLLOWING || this == AppTab.ALERTS
