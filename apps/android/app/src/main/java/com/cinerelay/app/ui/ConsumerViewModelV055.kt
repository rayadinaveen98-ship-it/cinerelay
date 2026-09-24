package com.cinerelay.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.ApiException
import com.cinerelay.app.data.ConsumerDeepLinkTarget
import com.cinerelay.app.data.OnThisDayMovie
import com.cinerelay.app.data.PersonalizationState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class ConsumerUiStateV055(
    val personalizationLoading: Boolean = false,
    val personalization: PersonalizationState? = null,
    val selectedLanguages: Set<String> = emptySet(),
    val selectedSourceIds: Set<String> = emptySet(),
    val personalizationBusy: Boolean = false,
    val personalizationError: String? = null,
    val onThisDayLoading: Boolean = false,
    val onThisDayDate: String? = null,
    val onThisDayMovies: List<OnThisDayMovie> = emptyList(),
    val onThisDayError: String? = null,
    val deepLinkLoading: Boolean = false,
    val deepLinkTarget: ConsumerDeepLinkTarget? = null,
    val deepLinkError: String? = null,
    val deepLinkFallbackUrl: String? = null,
)

class ConsumerViewModelV055(application: Application) : AndroidViewModel(application) {
    private val app = application as CineRelayApplication
    private val consumer = app.consumerClient
    private val onThisDay = app.onThisDayClient

    private val _state = MutableStateFlow(ConsumerUiStateV055())
    val state: StateFlow<ConsumerUiStateV055> = _state.asStateFlow()

    fun syncPersonalization(authenticated: Boolean, force: Boolean = false) {
        if (!authenticated) {
            _state.value = ConsumerUiStateV055()
            return
        }
        if (_state.value.personalizationLoading) return
        if (!force && _state.value.personalization != null) return

        viewModelScope.launch {
            _state.value = _state.value.copy(personalizationLoading = true, personalizationError = null)
            runCatching { withContext(Dispatchers.IO) { consumer.personalization() } }
                .onSuccess { personalization ->
                    _state.value = _state.value.copy(
                        personalizationLoading = false,
                        personalization = personalization,
                        selectedLanguages = personalization.favoriteLanguages,
                        selectedSourceIds = personalization.favoriteSourceIdentityIds,
                        personalizationError = null,
                    )
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(
                        personalizationLoading = false,
                        personalizationError = friendlyError(error),
                    )
                }
        }
    }

    fun loadOnThisDay(force: Boolean = false, date: String? = null) {
        val current = _state.value
        if (current.onThisDayLoading) return
        if (!force && date == null && current.onThisDayDate != null && current.onThisDayMovies.isNotEmpty()) return

        viewModelScope.launch {
            _state.value = _state.value.copy(onThisDayLoading = true, onThisDayError = null)
            runCatching { withContext(Dispatchers.IO) { onThisDay.load(date = date) } }
                .onSuccess { snapshot ->
                    _state.value = _state.value.copy(
                        onThisDayLoading = false,
                        onThisDayDate = snapshot.selectedDate,
                        onThisDayMovies = snapshot.movies,
                        onThisDayError = null,
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        onThisDayLoading = false,
                        onThisDayError = "Cinema history is temporarily unavailable.",
                    )
                }
        }
    }

    fun toggleLanguage(code: String) {
        if (_state.value.personalizationBusy) return
        val normalized = code.trim().lowercase()
        if (normalized.isBlank()) return
        val current = _state.value.selectedLanguages
        _state.value = _state.value.copy(
            selectedLanguages = if (normalized in current) current - normalized else current + normalized,
            personalizationError = null,
        )
    }

    fun toggleFavoriteSource(identityId: String) {
        if (_state.value.personalizationBusy) return
        val normalized = identityId.trim()
        if (normalized.isBlank()) return
        val current = _state.value.selectedSourceIds
        _state.value = _state.value.copy(
            selectedSourceIds = if (normalized in current) current - normalized else current + normalized,
            personalizationError = null,
        )
    }

    fun savePersonalization(onSaved: (() -> Unit)? = null) {
        val current = _state.value
        if (current.personalizationBusy) return
        if (current.selectedLanguages.isEmpty()) {
            _state.value = current.copy(personalizationError = "Choose at least one language you care about.")
            return
        }
        if (current.selectedSourceIds.isEmpty()) {
            _state.value = current.copy(personalizationError = "Choose at least one favorite channel.")
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(personalizationBusy = true, personalizationError = null)
            runCatching {
                withContext(Dispatchers.IO) {
                    consumer.savePersonalization(
                        sourceIdentityIds = current.selectedSourceIds,
                        languageCodes = current.selectedLanguages,
                        complete = true,
                    )
                    consumer.personalization()
                }
            }.onSuccess { personalization ->
                _state.value = _state.value.copy(
                    personalizationBusy = false,
                    personalization = personalization,
                    selectedLanguages = personalization.favoriteLanguages,
                    selectedSourceIds = personalization.favoriteSourceIdentityIds,
                    personalizationError = null,
                )
                onSaved?.invoke()
            }.onFailure { error ->
                _state.value = _state.value.copy(
                    personalizationBusy = false,
                    personalizationError = friendlyError(error),
                )
            }
        }
    }

    fun openNotification(eventId: String?, rawItemId: String?, canonicalUrl: String?) {
        val normalizedEventId = eventId?.trim().orEmpty()
        val normalizedRawItemId = rawItemId?.trim().orEmpty()
        if (normalizedEventId.isBlank() && normalizedRawItemId.isBlank()) {
            _state.value = _state.value.copy(
                deepLinkLoading = false,
                deepLinkTarget = null,
                deepLinkError = "This notification no longer has a CineRelay detail to open.",
                deepLinkFallbackUrl = canonicalUrl?.takeIf { it.isNotBlank() },
            )
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(
                deepLinkLoading = true,
                deepLinkTarget = null,
                deepLinkError = null,
                deepLinkFallbackUrl = canonicalUrl?.takeIf { it.isNotBlank() },
            )
            runCatching {
                withContext(Dispatchers.IO) {
                    if (normalizedEventId.isNotBlank()) consumer.event(normalizedEventId)
                    else consumer.rawItem(normalizedRawItemId)
                }
            }.onSuccess { target ->
                _state.value = _state.value.copy(
                    deepLinkLoading = false,
                    deepLinkTarget = target,
                    deepLinkError = null,
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(
                    deepLinkLoading = false,
                    deepLinkTarget = null,
                    deepLinkError = friendlyError(error),
                )
            }
        }
    }

    fun closeNotification() {
        _state.value = _state.value.copy(
            deepLinkLoading = false,
            deepLinkTarget = null,
            deepLinkError = null,
            deepLinkFallbackUrl = null,
        )
    }

    private fun friendlyError(error: Throwable): String {
        if (error is ApiException && error.statusCode == 401) return "Your session expired. Sign in again to continue."
        return error.message ?: "Something went wrong. Please try again."
    }
}
