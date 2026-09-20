package com.cinerelay.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.cinerelay.app.data.SourceDirectoryItem
import com.cinerelay.app.push.CineRelayMessagingService
import com.cinerelay.app.ui.AppTab
import com.cinerelay.app.ui.CineRelayHomeV055
import com.cinerelay.app.ui.CineRelayRootV049
import com.cinerelay.app.ui.CineRelaySetupLoadingV050
import com.cinerelay.app.ui.CineRelayViewModel
import com.cinerelay.app.ui.ConsumerViewModelV055
import com.cinerelay.app.ui.FirstRunAuthV050
import com.cinerelay.app.ui.NewsroomPlatform
import com.cinerelay.app.ui.NotificationDetailV055
import com.cinerelay.app.ui.NotificationOnboardingV044
import com.cinerelay.app.ui.NotificationOnboardingViewModel
import com.cinerelay.app.ui.OttReleasesV054
import com.cinerelay.app.ui.OttViewModelV054
import com.cinerelay.app.ui.P6039BottomNavOverlay
import com.cinerelay.app.ui.PersonalizationOnboardingV055
import com.cinerelay.app.ui.RadarV056
import com.cinerelay.app.ui.SettingsV055
import com.cinerelay.app.ui.SourcesDirectoryV039
import com.cinerelay.app.ui.SourcesViewModel
import com.cinerelay.app.ui.UniversalSearchV056
import com.cinerelay.app.ui.UniversalSearchViewModelV056
import kotlinx.coroutines.flow.MutableStateFlow

private data class NotificationRouteV055(
    val eventId: String?,
    val rawItemId: String?,
    val canonicalUrl: String?,
)

class MainActivity : ComponentActivity() {
    private val notificationRoute = MutableStateFlow<NotificationRouteV055?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        captureNotificationIntent(intent)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent {
            val viewModel: CineRelayViewModel = viewModel()
            val sourcesViewModel: SourcesViewModel = viewModel()
            val onboardingViewModel: NotificationOnboardingViewModel = viewModel()
            val searchViewModel: UniversalSearchViewModelV056 = viewModel()
            val ottViewModel: OttViewModelV054 = viewModel()
            val consumerViewModel: ConsumerViewModelV055 = viewModel()
            val state by viewModel.state.collectAsStateWithLifecycle()
            val sourcesState by sourcesViewModel.state.collectAsStateWithLifecycle()
            val onboardingState by onboardingViewModel.state.collectAsStateWithLifecycle()
            val searchState by searchViewModel.state.collectAsStateWithLifecycle()
            val ottState by ottViewModel.state.collectAsStateWithLifecycle()
            val consumerState by consumerViewModel.state.collectAsStateWithLifecycle()
            val pendingNotificationRoute by notificationRoute.collectAsStateWithLifecycle()
            val context = LocalContext.current
            var settingsVisible by remember { mutableStateOf(false) }
            var personalizationEditorVisible by remember { mutableStateOf(false) }
            var ottVisible by remember { mutableStateOf(false) }

            val notificationPermissionLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.RequestPermission(),
            ) { granted ->
                onboardingViewModel.completeSetup(enableNotifications = granted)
            }

            val masterNotificationPermissionLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.RequestPermission(),
            ) { granted ->
                if (granted) onboardingViewModel.setMasterEnabled(true)
                else onboardingViewModel.notificationPermissionDenied()
            }

            LaunchedEffect(state.authenticated) {
                if (!state.authenticated) {
                    settingsVisible = false
                    personalizationEditorVisible = false
                    ottVisible = false
                    searchViewModel.close()
                    consumerViewModel.closeNotification()
                }
                onboardingViewModel.sync(state.authenticated)
                consumerViewModel.syncPersonalization(state.authenticated)
            }

            LaunchedEffect(pendingNotificationRoute, state.authenticated) {
                val route = pendingNotificationRoute ?: return@LaunchedEffect
                if (!state.authenticated) return@LaunchedEffect
                settingsVisible = false
                personalizationEditorVisible = false
                ottVisible = false
                searchViewModel.close()
                consumerViewModel.openNotification(
                    eventId = route.eventId,
                    rawItemId = route.rawItemId,
                    canonicalUrl = route.canonicalUrl,
                )
                notificationRoute.value = null
            }

            LaunchedEffect(state.tab, state.authenticated) {
                if (state.tab == AppTab.ALERTS && state.authenticated) {
                    onboardingViewModel.sync(authenticated = true, force = true)
                }
            }

            LaunchedEffect(state.tab, state.newsroomPlatform, state.authMode, state.authenticated) {
                if (state.authenticated && state.tab == AppTab.FOLLOWING && state.authMode == null) {
                    sourcesViewModel.load(state.newsroomPlatform, authenticated = true)
                }
            }

            LaunchedEffect(ottVisible, state.authenticated) {
                if (ottVisible && state.authenticated) ottViewModel.load()
            }

            val personalizationResolved = consumerState.personalization != null
            val setupResolving = state.authenticated && (!onboardingState.authenticated || !personalizationResolved)
            val personalizationVisible = state.authenticated &&
                (consumerState.personalization?.completed == false || personalizationEditorVisible) &&
                state.authMode == null
            val onboardingVisible = state.authenticated &&
                onboardingState.authenticated &&
                onboardingState.shouldShow &&
                state.authMode == null
            val deepLinkVisible = consumerState.deepLinkLoading ||
                consumerState.deepLinkTarget != null ||
                consumerState.deepLinkError != null
            val notificationRouteWaiting = state.authenticated && pendingNotificationRoute != null && !deepLinkVisible

            Box(Modifier.fillMaxSize()) {
                when {
                    !state.authenticated -> {
                        FirstRunAuthV050(
                            state = state,
                            onChooseMode = viewModel::openAuth,
                            onBack = viewModel::closeAuth,
                            onSignIn = viewModel::signIn,
                            onCreateAccount = viewModel::createAccount,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }

                    notificationRouteWaiting -> {
                        CineRelaySetupLoadingV050(Modifier.fillMaxSize())
                    }

                    deepLinkVisible -> {
                        NotificationDetailV055(
                            state = consumerState,
                            onBack = consumerViewModel::closeNotification,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }

                    setupResolving -> {
                        CineRelaySetupLoadingV050(Modifier.fillMaxSize())
                    }

                    personalizationVisible -> {
                        PersonalizationOnboardingV055(
                            state = consumerState,
                            onToggleLanguage = consumerViewModel::toggleLanguage,
                            onToggleSource = consumerViewModel::toggleFavoriteSource,
                            onSave = {
                                consumerViewModel.savePersonalization {
                                    personalizationEditorVisible = false
                                }
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }

                    onboardingVisible -> {
                        NotificationOnboardingV044(
                            state = onboardingState,
                            onRetry = onboardingViewModel::retry,
                            onToggleSource = onboardingViewModel::toggleSource,
                            onSetVideos = onboardingViewModel::setIncludeVideos,
                            onSetShorts = onboardingViewModel::setIncludeShorts,
                            onValidateSelection = onboardingViewModel::validateSelection,
                            onEnableNotifications = {
                                val needsRuntimePermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                                    ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                                if (needsRuntimePermission) {
                                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                } else {
                                    onboardingViewModel.completeSetup(enableNotifications = true)
                                }
                            },
                            onFinishWithoutNotifications = {
                                onboardingViewModel.completeSetup(enableNotifications = false)
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }

                    else -> {
                        val personalization = consumerState.personalization!!
                        if (state.tab == AppTab.LIVE && state.authMode == null) {
                            CineRelayHomeV055(
                                state = state,
                                personalization = personalization,
                                onRefresh = viewModel::refresh,
                                onSearch = searchViewModel::open,
                                onOpenUpdate = { signal ->
                                    consumerViewModel.openNotification(
                                        eventId = signal.canonicalEvent?.id,
                                        rawItemId = signal.id,
                                        canonicalUrl = signal.canonicalUrl,
                                    )
                                },
                                modifier = Modifier.fillMaxSize(),
                            )
                        } else {
                            CineRelayRootV049(viewModel)
                        }

                        if (
                            !settingsVisible &&
                            !searchState.visible &&
                            !ottVisible &&
                            state.tab == AppTab.FOLLOWING &&
                            state.authMode == null
                        ) {
                            SourcesDirectoryV039(
                                state = sourcesState,
                                onRefresh = sourcesViewModel::refresh,
                                onOpenSource = sourcesViewModel::openSource,
                                onCloseSource = sourcesViewModel::closeSource,
                                onToggleNotification = { source, enabled ->
                                    sourcesViewModel.toggleNotification(source, enabled)
                                },
                                modifier = Modifier.fillMaxSize(),
                            )
                        }

                        if (
                            !settingsVisible &&
                            !searchState.visible &&
                            !ottVisible &&
                            state.tab == AppTab.RADAR &&
                            state.authMode == null
                        ) {
                            RadarV056(
                                state = state,
                                onRefresh = viewModel::refresh,
                                onOpen = { event ->
                                    consumerViewModel.openNotification(
                                        eventId = event.id,
                                        rawItemId = null,
                                        canonicalUrl = event.evidence?.canonicalUrl,
                                    )
                                },
                                modifier = Modifier.fillMaxSize(),
                            )
                        }

                        if (
                            !settingsVisible &&
                            !searchState.visible &&
                            ottVisible &&
                            state.authMode == null
                        ) {
                            OttReleasesV054(
                                state = ottState,
                                onRefresh = ottViewModel::refresh,
                                onSelectWindow = ottViewModel::selectWindow,
                                onSelectProvider = ottViewModel::selectProvider,
                                onSelectLanguage = ottViewModel::selectLanguage,
                                onSelectContentType = ottViewModel::selectContentType,
                                onSelectEvidence = ottViewModel::selectEvidence,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }

                        if (!settingsVisible && !searchState.visible && state.authMode == null) {
                            P6039BottomNavOverlay(
                                selected = state.tab,
                                ottSelected = ottVisible,
                                onSelect = { tab ->
                                    ottVisible = false
                                    viewModel.selectTab(tab)
                                },
                                onOpenOtt = {
                                    settingsVisible = false
                                    ottVisible = true
                                    ottViewModel.load()
                                },
                                onOpenControlRoom = {
                                    ottVisible = false
                                    onboardingViewModel.sync(authenticated = true, force = true)
                                    consumerViewModel.syncPersonalization(authenticated = true, force = true)
                                    settingsVisible = true
                                },
                                modifier = Modifier.align(Alignment.BottomCenter),
                            )
                        }

                        if (settingsVisible && state.authMode == null) {
                            SettingsV055(
                                state = state,
                                notificationState = onboardingState,
                                consumerState = consumerState,
                                onBack = { settingsVisible = false },
                                onEditFavorites = {
                                    settingsVisible = false
                                    personalizationEditorVisible = true
                                },
                                onOpenSources = {
                                    settingsVisible = false
                                    ottVisible = false
                                    viewModel.selectTab(AppTab.FOLLOWING)
                                },
                                onToggleNotificationMaster = { enabled ->
                                    if (!enabled) {
                                        onboardingViewModel.setMasterEnabled(false)
                                    } else {
                                        val needsRuntimePermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                                            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                                        if (needsRuntimePermission) {
                                            masterNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                        } else {
                                            onboardingViewModel.setMasterEnabled(true)
                                        }
                                    }
                                },
                                onSignOut = {
                                    settingsVisible = false
                                    personalizationEditorVisible = false
                                    ottVisible = false
                                    consumerViewModel.closeNotification()
                                    searchViewModel.close()
                                    viewModel.signOut()
                                },
                                modifier = Modifier.fillMaxSize(),
                            )
                        }

                        if (searchState.visible && !settingsVisible && state.authMode == null) {
                            UniversalSearchV056(
                                state = searchState,
                                onBack = searchViewModel::back,
                                onQueryChange = searchViewModel::updateQuery,
                                onSearch = searchViewModel::submitSearch,
                                onOpenHub = searchViewModel::openHub,
                                onToggleFollow = searchViewModel::toggleFollow,
                                onOpenUpdate = { update ->
                                    consumerViewModel.openNotification(
                                        eventId = null,
                                        rawItemId = update.id,
                                        canonicalUrl = update.canonicalUrl,
                                    )
                                },
                                onOpenChannel = { channel ->
                                    searchViewModel.close()
                                    settingsVisible = false
                                    ottVisible = false
                                    if (state.newsroomPlatform != NewsroomPlatform.YOUTUBE) {
                                        viewModel.setNewsroomPlatform(NewsroomPlatform.YOUTUBE)
                                    }
                                    viewModel.selectTab(AppTab.FOLLOWING)
                                    sourcesViewModel.openSource(
                                        SourceDirectoryItem(
                                            identityId = channel.identityId,
                                            sourceId = channel.sourceId,
                                            name = channel.name,
                                            handle = channel.handle,
                                            platform = channel.platform,
                                            role = channel.role,
                                            authorityTier = channel.authorityTier,
                                            canonicalUrl = channel.canonicalUrl,
                                            artworkUrl = channel.artworkUrl,
                                            newCount24h = 0,
                                            latestObservedAt = null,
                                        ),
                                    )
                                },
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureNotificationIntent(intent)
    }

    private fun captureNotificationIntent(intent: Intent?) {
        intent ?: return
        val eventId = intent.getStringExtra(CineRelayMessagingService.EXTRA_EVENT_ID)
            ?: intent.getStringExtra("eventId")
        val rawItemId = intent.getStringExtra(CineRelayMessagingService.EXTRA_RAW_ITEM_ID)
            ?: intent.getStringExtra("rawItemId")
        val canonicalUrl = intent.getStringExtra(CineRelayMessagingService.EXTRA_CANONICAL_URL)
            ?: intent.getStringExtra("canonicalUrl")
        val markedNotification = intent.getBooleanExtra(CineRelayMessagingService.EXTRA_FROM_NOTIFICATION, false)
        if (!markedNotification && eventId.isNullOrBlank() && rawItemId.isNullOrBlank()) return

        notificationRoute.value = NotificationRouteV055(
            eventId = eventId?.takeIf { it.isNotBlank() },
            rawItemId = rawItemId?.takeIf { it.isNotBlank() },
            canonicalUrl = canonicalUrl?.takeIf { it.isNotBlank() },
        )
        intent.removeExtra(CineRelayMessagingService.EXTRA_FROM_NOTIFICATION)
        intent.removeExtra(CineRelayMessagingService.EXTRA_EVENT_ID)
        intent.removeExtra(CineRelayMessagingService.EXTRA_RAW_ITEM_ID)
        intent.removeExtra(CineRelayMessagingService.EXTRA_CANONICAL_URL)
        intent.removeExtra("eventId")
        intent.removeExtra("rawItemId")
        intent.removeExtra("canonicalUrl")
    }
}
