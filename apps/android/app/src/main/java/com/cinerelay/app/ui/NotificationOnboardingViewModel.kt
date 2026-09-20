package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.NotificationPreferenceState
import com.cinerelay.app.data.NotificationPreferencesClient
import com.cinerelay.app.data.SourceDirectoryItem
import com.cinerelay.app.data.SourcesClient
import com.cinerelay.app.push.PushManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class NotificationOnboardingState(
    val authenticated: Boolean = false,
    val setupKnown: Boolean = false,
    val setupCompleted: Boolean = false,
    val loading: Boolean = false,
    val saving: Boolean = false,
    val sources: List<SourceDirectoryItem> = emptyList(),
    val selectedSourceIds: Set<String> = emptySet(),
    val includeVideos: Boolean = true,
    val includeShorts: Boolean = false,
    val masterEnabled: Boolean = false,
    val error: String? = null,
) {
    val shouldShow: Boolean
        get() = authenticated && (!setupKnown || !setupCompleted)
}

class NotificationOnboardingViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val sourcesClient = SourcesClient()
    private val preferencesClient = NotificationPreferencesClient(app.sessionStore, app.backendClient)
    private val pushManager = PushManager(application, app.sessionStore, app.backendClient)
    private var syncGeneration = 0

    private val _state = MutableStateFlow(NotificationOnboardingState())
    val state: StateFlow<NotificationOnboardingState> = _state.asStateFlow()

    fun sync(authenticated: Boolean, force: Boolean = false) {
        val current = _state.value
        if (!authenticated) {
            ++syncGeneration
            _state.value = NotificationOnboardingState(authenticated = false, setupKnown = true)
            return
        }
        if (!force && current.authenticated && current.setupKnown) return

        val generation = ++syncGeneration
        _state.value = current.copy(
            authenticated = true,
            setupKnown = false,
            loading = true,
            error = null,
        )

        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val preferences = preferencesClient.get()
                    val directory = if (preferences.setupCompleted) null else sourcesClient.sources("YOUTUBE")
                    preferences to directory
                }
            }.onSuccess { (preferences, directory) ->
                if (generation != syncGeneration) return@onSuccess
                val firstRun = !preferences.setupCompleted
                _state.value = NotificationOnboardingState(
                    authenticated = true,
                    setupKnown = true,
                    setupCompleted = preferences.setupCompleted,
                    loading = false,
                    sources = directory?.items ?: emptyList(),
                    selectedSourceIds = if (firstRun) emptySet() else preferences.selectedSourceIds,
                    includeVideos = if (firstRun) true else preferences.includeVideos,
                    includeShorts = if (firstRun) false else preferences.includeShorts,
                    masterEnabled = preferences.masterEnabled,
                    error = null,
                )
            }.onFailure { error ->
                if (generation != syncGeneration) return@onFailure
                _state.value = _state.value.copy(
                    authenticated = true,
                    setupKnown = false,
                    loading = false,
                    error = error.message ?: "Could not load notification setup",
                )
            }
        }
    }

    fun retry() = sync(authenticated = true, force = true)

    fun toggleSource(sourceIdentityId: String) {
        if (_state.value.saving) return
        val selected = _state.value.selectedSourceIds.toMutableSet()
        if (!selected.add(sourceIdentityId)) selected.remove(sourceIdentityId)
        _state.value = _state.value.copy(selectedSourceIds = selected, error = null)
    }

    fun setIncludeVideos(value: Boolean) {
        if (_state.value.saving) return
        _state.value = _state.value.copy(includeVideos = value, error = null)
    }

    fun setIncludeShorts(value: Boolean) {
        if (_state.value.saving) return
        _state.value = _state.value.copy(includeShorts = value, error = null)
    }

    fun validateSelection(): Boolean {
        if (_state.value.selectedSourceIds.isNotEmpty()) return true
        _state.value = _state.value.copy(error = "Choose at least one source to continue")
        return false
    }

    fun completeSetup(enableNotifications: Boolean) {
        val snapshot = _state.value
        if (snapshot.saving || snapshot.selectedSourceIds.isEmpty()) {
            if (snapshot.selectedSourceIds.isEmpty()) {
                _state.value = snapshot.copy(error = "Choose at least one source before finishing setup")
            }
            return
        }

        viewModelScope.launch {
            _state.value = snapshot.copy(saving = true, error = null)
            runCatching {
                withContext(Dispatchers.IO) {
                    var effectiveEnable = enableNotifications
                    if (enableNotifications) {
                        val push = pushManager.registerCurrentDevice()
                        if (!push.registered) effectiveEnable = false
                    }
                    val preferences = preferencesClient.replace(
                        sourceIdentityIds = snapshot.selectedSourceIds,
                        includeVideos = snapshot.includeVideos,
                        includeShorts = snapshot.includeShorts,
                        masterEnabled = effectiveEnable,
                        completeSetup = true,
                    )
                    preferences to effectiveEnable
                }
            }.onSuccess { (preferences, effectiveEnable) ->
                applyCompleted(preferences, effectiveEnable)
            }.onFailure { error ->
                _state.value = _state.value.copy(
                    saving = false,
                    error = error.message ?: "Could not finish notification setup",
                )
            }
        }
    }

    private fun applyCompleted(preferences: NotificationPreferenceState, effectiveEnable: Boolean) {
        _state.value = _state.value.copy(
            setupKnown = true,
            setupCompleted = true,
            saving = false,
            selectedSourceIds = preferences.selectedSourceIds,
            includeVideos = preferences.includeVideos,
            includeShorts = preferences.includeShorts,
            masterEnabled = effectiveEnable && preferences.masterEnabled,
            error = null,
        )
    }
}
