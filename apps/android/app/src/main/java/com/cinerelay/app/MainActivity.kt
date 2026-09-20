package com.cinerelay.app

import android.Manifest
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
import com.cinerelay.app.ui.AppTab
import com.cinerelay.app.ui.CineRelayRootV049
import com.cinerelay.app.ui.CineRelaySetupLoadingV050
import com.cinerelay.app.ui.CineRelayViewModel
import com.cinerelay.app.ui.ControlRoomV051
import com.cinerelay.app.ui.FirstRunAuthV050
import com.cinerelay.app.ui.NotificationOnboardingV044
import com.cinerelay.app.ui.NotificationOnboardingViewModel
import com.cinerelay.app.ui.P6039BottomNavOverlay
import com.cinerelay.app.ui.SourcesDirectoryV039
import com.cinerelay.app.ui.SourcesViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent {
            val viewModel: CineRelayViewModel = viewModel()
            val sourcesViewModel: SourcesViewModel = viewModel()
            val onboardingViewModel: NotificationOnboardingViewModel = viewModel()
            val state by viewModel.state.collectAsStateWithLifecycle()
            val sourcesState by sourcesViewModel.state.collectAsStateWithLifecycle()
            val onboardingState by onboardingViewModel.state.collectAsStateWithLifecycle()
            val context = LocalContext.current
            var controlRoomVisible by remember { mutableStateOf(false) }

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
                if (!state.authenticated) controlRoomVisible = false
                onboardingViewModel.sync(state.authenticated)
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

            val setupResolving = state.authenticated && !onboardingState.authenticated
            val onboardingVisible = state.authenticated &&
                onboardingState.authenticated &&
                onboardingState.shouldShow &&
                state.authMode == null

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

                    setupResolving -> {
                        CineRelaySetupLoadingV050(Modifier.fillMaxSize())
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

                        if (!controlRoomVisible && state.tab == AppTab.FOLLOWING && state.authMode == null) {
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

                        if (!controlRoomVisible && state.authMode == null) {
                            P6039BottomNavOverlay(
                                selected = state.tab,
                                onSelect = viewModel::selectTab,
                                onOpenControlRoom = {
                                    onboardingViewModel.sync(authenticated = true, force = true)
                                    controlRoomVisible = true
                                },
                                modifier = Modifier.align(Alignment.BottomCenter),
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
                                    viewModel.signOut()
                                },
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }
                }
            }
        }
    }
}
