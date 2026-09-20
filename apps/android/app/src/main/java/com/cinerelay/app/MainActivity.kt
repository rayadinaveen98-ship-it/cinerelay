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
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.cinerelay.app.push.CineRelayMessagingService
import com.cinerelay.app.ui.AppTab
import com.cinerelay.app.ui.CineRelayRootV049
import com.cinerelay.app.ui.CineRelaySetupLoadingV050
import com.cinerelay.app.ui.CineRelayViewModel
import com.cinerelay.app.ui.ConsumerViewModelV055
import com.cinerelay.app.ui.ControlRoomV051
import com.cinerelay.app.ui.FirstRunAuthV050
import com.cinerelay.app.ui.IntelligenceSearchLauncherV053
import com.cinerelay.app.ui.IntelligenceSearchV053
import com.cinerelay.app.ui.IntelligenceViewModel
import com.cinerelay.app.ui.NotificationDetailV055
import com.cinerelay.app.ui.NotificationOnboardingV044
import com.cinerelay.app.ui.NotificationOnboardingViewModel
import com.cinerelay.app.ui.OttReleasesV054
import com.cinerelay.app.ui.OttViewModelV054
import com.cinerelay.app.ui.P6039BottomNavOverlay
import com.cinerelay.app.ui.PersonalizationOnboardingV055
import com.cinerelay.app.ui.SourcesDirectoryV039
import com.cinerelay.app.ui.SourcesViewModel
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
            val intelligenceViewModel: IntelligenceViewModel = viewModel()
            val ottViewModel: OttViewModelV054 = viewModel()
            val consumerViewModel: ConsumerViewModelV055 = viewModel()
            val state by viewModel.state.collectAsStateWithLifecycle()
            val sourcesState by sourcesViewModel.state.collectAsStateWithLifecycle()
            val onboardingState by onboardingViewModel.state.collectAsStateWithLifecycle()
            val intelligenceState by intelligenceViewModel.state.collectAsStateWithLifecycle()
            val ottState by ottViewModel.state.collectAsStateWithLifecycle()
            val consumerState by consumerViewModel.state.collectAsStateWithLifecycle()
            val pendingNotificationRoute by notificationRoute.collectAsStateWithLifecycle()
            val context = LocalContext.current
            var controlRoomVisible by remember { mutableStateOf(false) }
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
                    controlRoomVisible = false
                    ottVisible = false
                    intelligenceViewModel.close()
                    consumerViewModel.closeNotification()
                }
                onboardingViewModel.sync(state.authenticated)
                consumerViewModel.syncPersonalization(state.authenticated)
            }

            LaunchedEffect(pendingNotificationRoute, state.authenticated) {
                val route = pendingNotificationRoute ?: return@LaunchedEffect
                if (!state.authenticated) return@LaunchedEffect
                controlRoomVisible = false
                ottVisible = false
                intelligenceViewModel.close()
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

            val personalizationResolved = consumerState.personalization != null || consumerState.personalizationError != null
            val setupResolving = state.authenticated && (!onboardingState.authenticated || !personalizationResolved)
            val personalizationVisible = state.authenticated &&
                consumerState.personalization?.completed == false &&
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
                            onSave = { consumerViewModel.savePersonalization() },
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
                        CineRelayRootV049(viewModel)

                        if (
                            !controlRoomVisible &&
                            !intelligenceState.visible &&
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
                            !controlRoomVisible &&
                            !intelligenceState.visible &&
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

                        if (!controlRoomVisible && !intelligenceState.visible && state.authMode == null) {
                            P6039BottomNavOverlay(
                                selected = state.tab,
                                ottSelected = ottVisible,
                                onSelect = { tab ->
                                    ottVisible = false
                                    viewModel.selectTab(tab)
                                },
                                onOpenOtt = {
                                    controlRoomVisible = false
                                    ottVisible = true
                                    ottViewModel.load()
                                },
                                onOpenControlRoom = {
                                    ottVisible = false
                                    onboardingViewModel.sync(authenticated = true, force = true)
                                    consumerViewModel.syncPersonalization(authenticated = true, force = true)
                                    controlRoomVisible = true
                                },
                                modifier = Modifier.align(Alignment.BottomCenter),
                            )
                        }

                        if (
                            !controlRoomVisible &&
                            !intelligenceState.visible &&
                            !ottVisible &&
                            state.tab == AppTab.LIVE &&
                            state.authMode == null
                        ) {
                            IntelligenceSearchLauncherV053(
                                onClick = intelligenceViewModel::open,
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .padding(end = 16.dp, bottom = 92.dp),
                            )
                        }

                        if (controlRoomVisible && state.authMode == null) {
                            ControlRoomV051(
                                state = state,
                                notificationState = onboardingState,
                                onBack = { controlRoomVisible = false },
                                onSelectPlatform = viewModel::setNewsroomPlatform,
                                onSelectFilter = viewModel::setNewsroomFilter,
                                onSelectSourceRole = viewModel::setNewsroomSourceRole,
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
                                    controlRoomVisible = false
                                    ottVisible = false
                                    consumerViewModel.closeNotification()
                                    viewModel.signOut()
                                },
                                modifier = Modifier.fillMaxSize(),
                            )
                        }

                        if (intelligenceState.visible && !controlRoomVisible && state.authMode == null) {
                            IntelligenceSearchV053(
                                state = intelligenceState,
                                onBack = intelligenceViewModel::back,
                                onQueryChange = intelligenceViewModel::updateQuery,
                                onSearch = intelligenceViewModel::search,
                                onOpenHub = intelligenceViewModel::openHub,
                                onToggleFollow = intelligenceViewModel::toggleFollow,
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
        if (intent?.getBooleanExtra(CineRelayMessagingService.EXTRA_FROM_NOTIFICATION, false) != true) return
        notificationRoute.value = NotificationRouteV055(
            eventId = intent.getStringExtra(CineRelayMessagingService.EXTRA_EVENT_ID),
            rawItemId = intent.getStringExtra(CineRelayMessagingService.EXTRA_RAW_ITEM_ID),
            canonicalUrl = intent.getStringExtra(CineRelayMessagingService.EXTRA_CANONICAL_URL),
        )
        intent.removeExtra(CineRelayMessagingService.EXTRA_FROM_NOTIFICATION)
    }
}
