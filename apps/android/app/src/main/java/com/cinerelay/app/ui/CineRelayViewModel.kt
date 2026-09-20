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
enum class NewsroomPlatform { YOUTUBE, WEB, X }
enum class NewsroomFilter { ALL, VERIFIED, DEVELOPING, UNCONFIRMED, CONFLICT_RUMOR }
enum class NewsroomSourceRole { ALL, PRODUCTION, OTT, MUSIC }

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
    val newsroomPlatform: NewsroomPlatform = NewsroomPlatform.YOUTUBE,
    val newsroomFilter: NewsroomFilter = NewsroomFilter.ALL,
    val newsroomFilterCounts: Map<NewsroomFilter, Int> = emptyMap(),
    val newsroomSourceRole: NewsroomSourceRole = NewsroomSourceRole.ALL,
    val newsroomSourceRoleCounts: Map<NewsroomSourceRole, Int> = emptyMap(),
    val newsroomSignals: List<NewsroomSignal> = emptyList(),
    val homeSignals: List<NewsroomSignal> = emptyList(),
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
        if (_state.value.authenticated) refreshAll()
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

    fun setNewsroomPlatform(platform: NewsroomPlatform) {
        if (_state.value.newsroomPlatform == platform || _state.value.loading) return
        latestNewsroomSignals = emptyList()
        _state.value = _state.value.copy(
            newsroomPlatform = platform,
            newsroomSourceRole = NewsroomSourceRole.ALL,
            newsroomSourceRoleCounts = emptyMap(),
            newsroomFilterCounts = emptyMap(),
            newsroomSignals = emptyList(),
            error = null,
            notice = null,
        )
        if (_state.value.tab == AppTab.LIVE) refresh()
    }

    fun setNewsroomFilter(filter: NewsroomFilter) {
        if (_state.value.newsroomFilter == filter) return
        val current = _state.value
        _state.value = current.copy(
            newsroomFilter = filter,
            newsroomSignals = filterNewsroom(
                latestNewsroomSignals,
                filter,
                current.newsroomSourceRole,
                current.newsroomPlatform,
            ),
        )
    }

    fun setNewsroomSourceRole(role: NewsroomSourceRole) {
        val current = _state.value
        if (current.newsroomPlatform != NewsroomPlatform.YOUTUBE || current.newsroomSourceRole == role) return
        _state.value = current.copy(
            newsroomSourceRole = role,
            newsroomSignals = filterNewsroom(
                latestNewsroomSignals,
                current.newsroomFilter,
                role,
                current.newsroomPlatform,
            ),
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
                        notice = "Signed in. Loading your CineRelay setup.",
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
                            notice = "Account created. Loading first-time setup.",
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
            notice = "Signed out.",
            pushState = PushState(BuildConfig.FIREBASE_CONFIGURED),
        )
    }

    fun selectTab(tab: AppTab) {
        if (!_state.value.authenticated || _state.value.tab == tab) return
        _state.value = _state.value.copy(tab = tab, error = null, notice = null)
        if (tab == AppTab.ALERTS) refreshPushState()
        refresh()
    }

    fun refresh() {
        if (!_state.value.authenticated || _state.value.loading) return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching {
                withContext(Dispatchers.IO) {
                    when (_state.value.tab) {
                        AppTab.LIVE -> {
                            val youtube = backend.newsroom(NewsroomPlatform.YOUTUBE.name, limit = 100)
                            val web = backend.newsroom(NewsroomPlatform.WEB.name, limit = 80)
                            LoadResult.Home(youtube = youtube, web = web)
                        }
                        AppTab.FOLLOWING -> LoadResult.Events(backend.eventFeed("following"))
                        AppTab.RADAR -> LoadResult.Events(backend.eventFeed("radar", allowGuest = true))
                        AppTab.ALERTS -> LoadResult.Alerts(backend.alerts())
                    }
                }
            }.onSuccess { result ->
                _state.value = when (result) {
                    is LoadResult.Home -> {
                        val current = _state.value
                        val combined = (result.youtube + result.web)
                            .distinctBy { it.id }
                            .sortedWith(compareByDescending<NewsroomSignal> { it.observedAt ?: it.ingestedAt ?: "" })
                        val selectedLane = when (current.newsroomPlatform) {
                            NewsroomPlatform.YOUTUBE -> result.youtube
                            NewsroomPlatform.WEB -> result.web
                            NewsroomPlatform.X -> emptyList()
                        }
                        latestNewsroomSignals = selectedLane
                        current.copy(
                            loading = false,
                            homeSignals = combined,
                            newsroomFilterCounts = newsroomCounts(selectedLane),
                            newsroomSourceRoleCounts = newsroomSourceRoleCounts(selectedLane),
                            newsroomSignals = filterNewsroom(
                                selectedLane,
                                current.newsroomFilter,
                                current.newsroomSourceRole,
                                current.newsroomPlatform,
                            ),
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
                    val current = _state.value
                    val updatedHome = current.homeSignals.map { signal ->
                        val event = signal.canonicalEvent
                        if (event?.entityId == card.entityId) signal.copy(canonicalEvent = event.copy(followed = desired)) else signal
                    }
                    _state.value = current.copy(
                        homeSignals = updatedHome,
                        newsroomSignals = filterNewsroom(
                            latestNewsroomSignals,
                            current.newsroomFilter,
                            current.newsroomSourceRole,
                            current.newsroomPlatform,
                        ),
                        events = current.events.map { item ->
                            if (item.entityId == card.entityId) item.copy(followed = desired) else item
                        },
                        bootstrap = current.bootstrap?.let { value ->
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
                    refreshPushState()
                    refresh()
                }
                .onFailure(::handleFailure)
        }
    }

    private fun refreshPushState() {
        if (!_state.value.authenticated) return
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { pushManager.currentDeviceState() } }
                .onSuccess { push -> _state.value = _state.value.copy(pushState = push) }
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
                error = "Your session expired. Sign in again to continue.",
                pushState = PushState(BuildConfig.FIREBASE_CONFIGURED),
            )
            return
        }
        _state.value = _state.value.copy(
            loading = false,
            authBusy = false,
            error = error.message ?: "Something went wrong",
        )
    }

    private sealed interface LoadResult {
        data class Home(val youtube: List<NewsroomSignal>, val web: List<NewsroomSignal>) : LoadResult
        data class Events(val items: List<EventCard>) : LoadResult
        data class Alerts(val items: List<AlertItem>) : LoadResult
    }
}

private fun filterNewsroom(
    items: List<NewsroomSignal>,
    filter: NewsroomFilter,
    sourceRole: NewsroomSourceRole,
    platform: NewsroomPlatform,
): List<NewsroomSignal> {
    val byState = when (filter) {
        NewsroomFilter.ALL -> items
        NewsroomFilter.VERIFIED -> items.filter { it.state == "VERIFIED" }
        NewsroomFilter.DEVELOPING -> items.filter { it.state == "DEVELOPING" }
        NewsroomFilter.UNCONFIRMED -> items.filter { it.state == "UNCONFIRMED" }
        NewsroomFilter.CONFLICT_RUMOR -> items.filter { it.state == "CONFLICT_RUMOR" }
    }
    if (platform != NewsroomPlatform.YOUTUBE || sourceRole == NewsroomSourceRole.ALL) return byState
    return byState.filter { signal ->
        when (sourceRole) {
            NewsroomSourceRole.ALL -> true
            NewsroomSourceRole.PRODUCTION -> signal.source.role == "PRODUCTION_HOUSE"
            NewsroomSourceRole.OTT -> signal.source.role == "OTT_PLATFORM"
            NewsroomSourceRole.MUSIC -> signal.source.role == "MUSIC_LABEL"
        }
    }
}

private fun newsroomCounts(items: List<NewsroomSignal>): Map<NewsroomFilter, Int> = buildMap {
    put(NewsroomFilter.ALL, items.size)
    put(NewsroomFilter.VERIFIED, items.count { it.state == "VERIFIED" })
    put(NewsroomFilter.DEVELOPING, items.count { it.state == "DEVELOPING" })
    put(NewsroomFilter.UNCONFIRMED, items.count { it.state == "UNCONFIRMED" })
    put(NewsroomFilter.CONFLICT_RUMOR, items.count { it.state == "CONFLICT_RUMOR" })
}

private fun newsroomSourceRoleCounts(items: List<NewsroomSignal>): Map<NewsroomSourceRole, Int> = buildMap {
    put(NewsroomSourceRole.ALL, items.size)
    put(NewsroomSourceRole.PRODUCTION, items.count { it.source.role == "PRODUCTION_HOUSE" })
    put(NewsroomSourceRole.OTT, items.count { it.source.role == "OTT_PLATFORM" })
    put(NewsroomSourceRole.MUSIC, items.count { it.source.role == "MUSIC_LABEL" })
}

private fun AppTab.requiresAccount(): Boolean = this == AppTab.FOLLOWING || this == AppTab.ALERTS
